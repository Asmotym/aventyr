import { authorizeDevBagUser } from '../services/rooms/room-dev-tools.service';
import { HttpError } from '../core/errors/http-errors';
import { pool } from '../core/database/client';
import { authorizeBag, bagRows, handleBagAction } from '../services/rooms/room-bag.service';
import { getRoomById } from '../core/database/tables/rooms.table';
import { parseRoomOverrides, resolveRoomRights } from '../core/utils/room-permissions';
import type { BagPresence, BagScope, BagSnapshot } from '../core/types/bag.types';
import type { RowDataPacket } from 'mysql2/promise';
import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { DiscordClient } from '../core/discord/client';
import { isTrustedFrontendHost } from '../core/config/origins';
import { getMember, touchMember } from '../core/database/tables/room-members.table';
import { getUser } from '../core/database/tables/users.table';
import type { RoomRealtimeEvent } from '../core/types/data.types';
import { createLogger } from '../core/utils/logger';
import {
    createRoomRealtimeEvent,
    parseRoomRealtimeAuthentication,
    readRealtimeRoomId
} from './room-realtime.protocol';

const AUTHENTICATION_TIMEOUT_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const BAG_RECONCILE_INTERVAL_MS = 2_000;
interface BagSubscription { targetUserId?: string; scope: BagScope; bagId: string | null; revision: number }
const logger = createLogger('RoomRealtime');
const discordClient = new DiscordClient();

interface AuthenticatedClient {
    roomId: string;
    userId: string;
    alive: boolean;
}

export interface RoomEventBroadcaster {
    broadcast(event: RoomRealtimeEvent): void;
    closeRoom(roomId: string, code?: number, reason?: string): void;
    closeMember(roomId: string, userId: string, code?: number, reason?: string): void;
}

class RoomRealtimeHub implements RoomEventBroadcaster {
    private readonly clients = new Map<string, Map<string, Set<WebSocket>>>();
    private readonly clientMetadata = new Map<WebSocket, AuthenticatedClient>();
    private server: WebSocketServer | null = null;
    private bagPresence = new Map<WebSocket, BagPresence>();
    private bagFrames = new Map<WebSocket, Promise<void>>();

    private bagSubscriptions = new Map<WebSocket, BagSubscription>();
    private bagRecovery: NodeJS.Timeout | null = null;
    private presenceTimer: NodeJS.Timeout | null = null;
    private reconcilingBags = false;
    private closingClients = new Set<Promise<void>>();

    private sendBag(socket: WebSocket, roomId: string, payload: Parameters<typeof createRoomRealtimeEvent>[1]): void {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(createRoomRealtimeEvent(roomId, payload)));
    }
    private async readBag(roomId: string, userId: string, scope: BagScope, targetUserId?: string): Promise<BagSnapshot> {
        const result = await handleBagAction({ action: 'bag', payload: { roomId, userId, scope, targetUserId } });
        if (!('bag' in result) || !result.bag) throw new Error('Missing Bag snapshot');
        return result.bag;
    }
    private deliverBag(socket: WebSocket, snapshot: BagSnapshot, subscription: BagSubscription, requestId?: string): void {
        const metadata = this.clientMetadata.get(socket);
        if (!metadata || this.bagSubscriptions.get(socket) !== subscription || subscription.scope !== snapshot.scope) return;
        if (subscription.bagId === snapshot.id && (subscription.revision > snapshot.revision || (subscription.revision === snapshot.revision && !requestId))) return;
        subscription.bagId = snapshot.id;
        subscription.revision = snapshot.revision;
        this.sendBag(socket, metadata.roomId, { type: 'bag.snapshot', snapshot, requestId });
    }
    private failBag(socket: WebSocket, subscription: BagSubscription, error: unknown, requestId?: string): void {
        const metadata = this.clientMetadata.get(socket);
        if (!metadata || this.bagSubscriptions.get(socket) !== subscription) return;
        const denied = error instanceof HttpError && [403, 404].includes(error.status);
        if (denied) {
            this.bagSubscriptions.delete(socket);
            this.bagPresence.delete(socket);
        }
        this.sendBag(socket, metadata.roomId, { type: 'bag.error', scope: subscription.scope, targetUserId: subscription.targetUserId, requestId,
            message: error instanceof HttpError ? error.message : 'Unable to synchronize the Bag. Reconnecting will retry.',
            code: error instanceof HttpError ? error.code : 'bag_sync_failed' });
        if (!denied) logger.warn('Bag snapshot delivery failed', { roomId: metadata.roomId, error: error instanceof Error ? error.message : 'UnknownError' });
    }
    async publishBagChange(roomId: string, scope: BagScope, userIds: string[] = []): Promise<void> {
        for (const [socket, subscription] of this.bagSubscriptions) {
            const metadata = this.clientMetadata.get(socket);
            if (metadata?.roomId !== roomId || subscription.scope !== scope) continue;
            if (scope === 'personal' && !userIds.includes(subscription.targetUserId ?? metadata.userId)) continue;
            try {
                const snapshot = await this.readBag(roomId, metadata.userId, scope, subscription.targetUserId);
                this.deliverBag(socket, snapshot, subscription);
            } catch (error) { this.failBag(socket, subscription, error); }
        }
    }

    // Recover missed publication and revision-bumped administrative/database edits.
    // Only subscribed bags are checked; browsers never poll or request manual reloads.
    async reconcileBagSubscriptions(): Promise<void> {
        if (this.reconcilingBags || !this.bagSubscriptions.size) return;
        this.reconcilingBags = true;
        try {
            const rooms = new Set([...this.bagSubscriptions.keys()].map(socket => this.clientMetadata.get(socket)?.roomId).filter((id): id is string => !!id));
            for (const roomId of rooms) {
                await this.refreshBagAccess(roomId);
                const [bags] = await pool.query<RowDataPacket[]>('SELECT id, owner_id, revision FROM room_bags WHERE room_id = ?', [roomId]);
                let teamChanged = false;
                const personalChanged = new Set<string>();
                for (const [socket, subscription] of this.bagSubscriptions) {
                    const metadata = this.clientMetadata.get(socket);
                    if (metadata?.roomId !== roomId) continue;
                    const row = bags.find(bag => bag.owner_id === (subscription.scope === 'team' ? '' : subscription.targetUserId ?? metadata.userId));
                    if (!row || row.id !== subscription.bagId || row.revision > subscription.revision) {
                        if (subscription.scope === 'team') teamChanged = true;
                        else personalChanged.add(subscription.targetUserId ?? metadata.userId);
                    }
                }
                if (teamChanged) await this.publishBagChange(roomId, 'team');
                if (personalChanged.size) await this.publishBagChange(roomId, 'personal', [...personalChanged]);
            }
        } finally { this.reconcilingBags = false; }
    }
    async clearBagPresence(roomId: string): Promise<void> {
        for (const [socket] of this.bagPresence) if (this.clientMetadata.get(socket)?.roomId === roomId) this.bagPresence.delete(socket);
        await this.refreshBagAccess(roomId);
    }
    async refreshBagAccess(roomId: string): Promise<void> {
        const room = await getRoomById(roomId);
        for (const [socket, subscription] of this.bagSubscriptions) {
            const metadata = this.clientMetadata.get(socket);
            if (metadata?.roomId !== roomId) continue;
            const member = await getMember(roomId, metadata.userId);
            const rights = member && resolveRoomRights(member.role ?? 'player', parseRoomOverrides(member.permission_overrides));
            if (!room?.bag_enabled || room.archived_at || !rights?.viewBag || (subscription.targetUserId && !await getMember(roomId, subscription.targetUserId))) {
                this.failBag(socket, subscription, new HttpError(403, 'Bag access denied', { code: 'forbidden' }));
            } else {
                const presence = this.bagPresence.get(socket);
                if (presence && !rights.editBag && presence.state !== 'viewing') this.bagPresence.set(socket, { ...presence, state: 'viewing', target: 'bag', itemId: null, templateId: null });
            }
        }
        await this.broadcastBagPresence(roomId);
    }
    private async broadcastBagPresence(roomId: string): Promise<void> {
        if (![...this.bagSubscriptions.keys()].some(socket => this.clientMetadata.get(socket)?.roomId === roomId)) return;
        const entries = [...this.bagPresence].filter(([socket, p]) => this.clientMetadata.get(socket)?.roomId === roomId && p.expiresAt > Date.now()).map(([, p]) => p);
        const dedupe = (values: BagPresence[]) => {
            const priority = { viewing: 0, adding: 1, editing: 2 };
            return [...new Map(values.sort((a, b) => priority[a.state] - priority[b.state] || a.expiresAt - b.expiresAt).map(p => [p.userId, p])).values()];
        };
        const room = await getRoomById(roomId);
        if (!room?.bag_enabled || room.archived_at) return;
        for (const [userId, sockets] of this.clients.get(roomId) ?? []) {
            const subscribers = [...sockets].filter(socket => this.bagSubscriptions.has(socket));
            if (!subscribers.length) continue;
            const member = await getMember(roomId, userId);
            if (!member || !resolveRoomRights(member.role ?? 'player', parseRoomOverrides(member.permission_overrides)).viewBag) continue;
            for (const socket of subscribers) {
                const subscription = this.bagSubscriptions.get(socket)!;
                if (subscription.targetUserId) continue;
                const scope = subscription.scope;
                const presence = dedupe(entries.filter(p => p.scope === scope && (scope === 'team' || p.userId === userId) && (p.target !== 'template' || p.userId === userId)));
                this.sendBag(socket, roomId, { type: 'bag.presence', scope, presence });
            }
        }
    }
    private async receiveBagFrame(socket: WebSocket, raw: string): Promise<void> {
        const metadata = this.clientMetadata.get(socket);
        if (!metadata) return;
        let frame: Record<string, unknown>;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid frame');
            frame = parsed as Record<string, unknown>;
        } catch { socket.close(4002, 'Invalid frame'); return; }
        if (frame.type === 'bag.unsubscribe') {
            this.bagSubscriptions.delete(socket);
            this.bagPresence.delete(socket);
            await this.broadcastBagPresence(metadata.roomId); return;
        }
        if (frame.type === 'bag.subscribe') {
            if (frame.scope !== 'team' && frame.scope !== 'personal') return;
            const requestId = typeof frame.requestId === 'string' && frame.requestId.length <= 100 ? frame.requestId : undefined;
            const targetUserId = frame.targetUserId;
            const previous = this.bagSubscriptions.get(socket);
            if (previous?.scope !== frame.scope || previous?.targetUserId !== targetUserId || targetUserId) this.bagPresence.delete(socket);
            if (targetUserId !== undefined && (typeof targetUserId !== 'string' || !targetUserId.length || targetUserId.length > 255)) { socket.close(4002, 'Invalid bag target'); return; }
            const subscription: BagSubscription = { scope: frame.scope, targetUserId, bagId: null, revision: -1 };
            this.bagSubscriptions.set(socket, subscription);
            try {
                const snapshot = await this.readBag(metadata.roomId, metadata.userId, frame.scope, targetUserId);
                this.deliverBag(socket, snapshot, subscription, requestId);
                if (!targetUserId && socket.readyState === WebSocket.OPEN && this.bagSubscriptions.get(socket) === subscription && !this.bagPresence.has(socket)) {
                    this.bagPresence.set(socket, { userId: metadata.userId, scope: frame.scope, state: 'viewing', target: 'bag', sectionId: null, itemId: null, expiresAt: Date.now() + 30_000 });
                }
            } catch (error) { this.failBag(socket, subscription, error, requestId); }
            await this.broadcastBagPresence(metadata.roomId); return;
        }
        if (frame.type !== 'bag.presence') { socket.close(4002, 'Unsupported frame'); return; }
        if (frame.state === 'closed') {
            this.bagPresence.delete(socket);
            await this.broadcastBagPresence(metadata.roomId); return;
        }
        const subscription = this.bagSubscriptions.get(socket);
        if (!subscription || subscription.targetUserId || subscription.scope !== frame.scope || !['viewing', 'adding', 'editing'].includes(String(frame.state))) return;
        const target = frame.target ?? (frame.state === 'viewing' ? 'bag' : 'item');
        if (!['bag', 'item', 'section', 'template'].includes(String(target))) return;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await authorizeBag(connection, metadata.roomId, metadata.userId, frame.state !== 'viewing');
            const owner = frame.scope === 'team' ? '' : metadata.userId;
            const sectionId = typeof frame.sectionId === 'string' ? frame.sectionId : null;
            const itemId = typeof frame.itemId === 'string' ? frame.itemId : null;
            const templateId = target === 'template' && typeof frame.templateId === 'string' ? frame.templateId : null;
            if (templateId && !(await bagRows<RowDataPacket>(connection, 'SELECT id FROM room_user_bag_templates WHERE id = ? AND room_id = ? AND owner_id = ?', [templateId, metadata.roomId, metadata.userId])).length) throw new HttpError(400, 'Custom field presence denied');
            for (const [id, table] of [[sectionId, 'room_bag_sections'], [itemId, 'room_bag_items']] as const) {
                if (id && !(await bagRows<RowDataPacket>(connection, `SELECT entry.id FROM ${table} entry JOIN room_bags bag ON bag.id = entry.bag_id WHERE entry.id = ? AND bag.room_id = ? AND bag.owner_id = ?`, [id, metadata.roomId, owner])).length) {
                    throw new HttpError(400, 'Presence entry not found in this bag');
                }
            }
            if (socket.readyState === WebSocket.OPEN && this.bagSubscriptions.get(socket) === subscription) this.bagPresence.set(socket, {
                userId: metadata.userId, scope: subscription.scope, state: frame.state as BagPresence['state'], target: target as BagPresence['target'], sectionId, itemId, templateId, expiresAt: Date.now() + 30_000
            });
            await connection.commit();
        } catch (error) {
            this.bagPresence.delete(socket);
            if (error instanceof HttpError && error.status === 403) this.failBag(socket, subscription, error);
        } finally { await connection.rollback(); connection.release(); }
        await this.broadcastBagPresence(metadata.roomId);
    }

    private heartbeat: NodeJS.Timeout | null = null;

    attach(httpServer: Server): void {
        if (this.server) return;

        const webSocketServer = new WebSocketServer({
            noServer: true,
            maxPayload: MAX_PAYLOAD_BYTES,
            perMessageDeflate: false
        });
        this.server = webSocketServer;

        httpServer.on('upgrade', (request, socket, head) => {
            const roomId = readRealtimeRoomId(request.url, request.headers.host);
            if (!roomId) {
                rejectUpgrade(socket, 404, 'Not Found');
                return;
            }
            if (!isTrustedFrontendHost(request.headers.origin)) {
                rejectUpgrade(socket, 403, 'Forbidden');
                return;
            }

            webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.handleConnection(webSocket, roomId);
            });
        });

        this.presenceTimer = setInterval(() => {
            const changed = new Set<string>();
            for (const [socket, presence] of this.bagPresence) if (presence.expiresAt <= Date.now()) {
                this.bagPresence.delete(socket);
                const roomId = this.clientMetadata.get(socket)?.roomId;
                if (roomId) changed.add(roomId);
            }
            for (const roomId of changed) void this.broadcastBagPresence(roomId).catch(() => {});
        }, 5_000);
        this.presenceTimer.unref();
        this.bagRecovery = setInterval(() => { void this.reconcileBagSubscriptions().catch(error => logger.warn('Bag revision recovery failed', { error: error instanceof Error ? error.message : 'UnknownError' })); }, BAG_RECONCILE_INTERVAL_MS);
        this.bagRecovery.unref();
        this.heartbeat = setInterval(() => this.runHeartbeat(), HEARTBEAT_INTERVAL_MS);
        this.heartbeat.unref();
    }

    notifyBagGift(roomId: string, gift: import('../core/types/bag.types').BagGiftNotification): void {
        // Receipt alerts reach only the recipient, including when their Bag is closed.
        for (const socket of this.clients.get(roomId)?.get(gift.userId) ?? []) {
            this.sendBag(socket, roomId, { type: 'bag.gift_received', gift });
        }
    }

    broadcast(event: RoomRealtimeEvent): void {
        const roomClients = this.clients.get(event.roomId);
        if (!roomClients) return;
        const serialized = JSON.stringify(event);

        for (const sockets of roomClients.values()) {
            for (const socket of sockets) {
                if (socket.readyState !== WebSocket.OPEN) continue;
                socket.send(serialized, (error) => {
                    if (error) {
                        logger.warn('Failed to deliver room event', {
                            roomId: event.roomId,
                            eventType: event.type
                        });
                    }
                });
            }
        }
    }

    closeRoom(roomId: string, code = 4004, reason = 'Room unavailable'): void {
        const roomClients = this.clients.get(roomId);
        if (!roomClients) return;
        for (const sockets of roomClients.values()) {
            for (const socket of sockets) {
                socket.close(code, reason);
            }
        }
    }

    closeMember(roomId: string, userId: string, code = 4003, reason = 'Membership ended'): void {
        const sockets = this.clients.get(roomId)?.get(userId);
        if (!sockets) return;
        for (const socket of sockets) {
            socket.close(code, reason);
        }
    }

    private handleConnection(webSocket: WebSocket, roomId: string): void {
        let authenticated = false;
        const authenticationTimer = setTimeout(() => {
            if (!authenticated) {
                webSocket.close(4001, 'Authentication required');
            }
        }, AUTHENTICATION_TIMEOUT_MS);

        webSocket.once('message', async (data, isBinary) => {
            if (isBinary) {
                clearTimeout(authenticationTimer);
                webSocket.close(4002, 'Invalid authentication');
                return;
            }

            try {
                const authentication = parseRoomRealtimeAuthentication(data);
                if (!authentication) {
                    throw new Error('Invalid authentication frame');
                }

                const discordUser = await discordClient.getUserInfo({
                    tokenType: authentication.tokenType,
                    accessToken: authentication.accessToken,
                    expiresIn: 0,
                    expiresAt: 0,
                    scope: '',
                    state: ''
                });
                if (authentication.devBagUserId !== undefined) await authorizeDevBagUser(discordUser.id, roomId, authentication.devBagUserId);
                const actorId = authentication.devBagUserId ?? discordUser.id;
                const [storedUser, member] = await Promise.all([
                    getUser(actorId),
                    getMember(roomId, actorId)
                ]);
                if (!storedUser || !member) {
                    webSocket.close(4003, 'Room access denied');
                    return;
                }

                authenticated = true;
                clearTimeout(authenticationTimer);
                await touchMember(roomId, actorId);
                if (webSocket.readyState !== WebSocket.OPEN) return;
                this.register(webSocket, roomId, actorId);
            } catch (error) {
                logger.warn('WebSocket authentication failed', {
                    roomId,
                    error: error instanceof Error ? error.name : 'UnknownError'
                });
                webSocket.close(4001, 'Authentication failed');
            }
        });

        webSocket.on('message', (data, isBinary) => {
            if (authenticated) {
                if (isBinary) { webSocket.close(4002, 'Invalid frame'); return; }
                const next = (this.bagFrames.get(webSocket) ?? Promise.resolve()).then(() => this.receiveBagFrame(webSocket, data.toString())).catch(() => {});
                this.bagFrames.set(webSocket, next);
            }
        });
        webSocket.on('pong', () => {
            const metadata = this.clientMetadata.get(webSocket);
            if (metadata) metadata.alive = true;
        });
        webSocket.on('close', (code) => {
            clearTimeout(authenticationTimer);
            const cleanup = this.unregister(webSocket, code).catch(error => logger.warn('Room disconnect cleanup failed', { roomId, error: error instanceof Error ? error.message : 'UnknownError' }));
            this.closingClients.add(cleanup);
            void cleanup.finally(() => this.closingClients.delete(cleanup));
        });
        webSocket.on('error', () => {
            const metadata = this.clientMetadata.get(webSocket);
            logger.warn('Room WebSocket error', {
                roomId: metadata?.roomId ?? roomId,
                userId: metadata?.userId,
                authenticated: Boolean(metadata)
            });
        });
    }

    private register(webSocket: WebSocket, roomId: string, userId: string): void {
        let roomClients = this.clients.get(roomId);
        if (!roomClients) {
            roomClients = new Map();
            this.clients.set(roomId, roomClients);
        }
        let userClients = roomClients.get(userId);
        const firstConnection = !userClients || userClients.size === 0;
        if (!userClients) {
            userClients = new Set();
            roomClients.set(userId, userClients);
        }
        userClients.add(webSocket);
        this.clientMetadata.set(webSocket, { roomId, userId, alive: true });

        const ready = createRoomRealtimeEvent(roomId, { type: 'connection.ready' });
        webSocket.send(JSON.stringify(ready));
        const now = new Date().toISOString();
        for (const connectedUserId of roomClients.keys()) {
            const presence = createRoomRealtimeEvent(roomId, {
                type: 'presence.updated',
                userId: connectedUserId,
                isOnline: true,
                lastSeen: now
            });
            webSocket.send(JSON.stringify(presence));
        }
        if (firstConnection) {
            this.broadcast(createRoomRealtimeEvent(roomId, {
                type: 'presence.updated',
                userId,
                isOnline: true,
                lastSeen: now
            }));
        }
        logger.info('Room WebSocket authenticated', {
            roomId,
            userId,
            connections: this.clientMetadata.size
        });
    }

    private async unregister(webSocket: WebSocket, code: number): Promise<void> {
        const metadata = this.clientMetadata.get(webSocket);
        if (!metadata) return;
        this.clientMetadata.delete(webSocket);
        this.bagFrames.delete(webSocket);
        this.bagPresence.delete(webSocket);
        this.bagSubscriptions.delete(webSocket);

        const roomClients = this.clients.get(metadata.roomId);
        const userClients = roomClients?.get(metadata.userId);
        userClients?.delete(webSocket);
        const lastConnection = !userClients || userClients.size === 0;
        if (lastConnection) {
            roomClients?.delete(metadata.userId);
        }
        if (roomClients?.size === 0) {
            this.clients.delete(metadata.roomId);
        }

        await this.broadcastBagPresence(metadata.roomId).catch(error => logger.warn('Bag presence cleanup failed', { roomId: metadata.roomId, error: error instanceof Error ? error.message : 'UnknownError' }));
        if (lastConnection) {
            await touchMember(metadata.roomId, metadata.userId).catch(() => undefined);
            this.broadcast(createRoomRealtimeEvent(metadata.roomId, {
                type: 'presence.updated',
                userId: metadata.userId,
                isOnline: false,
                lastSeen: new Date().toISOString()
            }));
        }
        logger.info('Room WebSocket disconnected', {
            roomId: metadata.roomId,
            userId: metadata.userId,
            code,
            connections: this.clientMetadata.size
        });
    }

    async shutdown(): Promise<void> {
        if (this.heartbeat) clearInterval(this.heartbeat);
        if (this.presenceTimer) clearInterval(this.presenceTimer);
        if (this.bagRecovery) clearInterval(this.bagRecovery);
        const pendingFrames = [...this.bagFrames.values()];
        this.bagSubscriptions.clear();
        this.bagPresence.clear();
        for (const socket of this.clientMetadata.keys()) socket.terminate();
        const server = this.server;
        this.server = null;
        if (server) await new Promise<void>(resolve => server.close(() => resolve()));
        await Promise.allSettled([...pendingFrames, ...this.closingClients]);
    }

    private runHeartbeat(): void {
        for (const [socket, metadata] of this.clientMetadata) {
            if (!metadata.alive) {
                socket.terminate();
                continue;
            }
            metadata.alive = false;
            socket.ping();
        }
    }
}

function rejectUpgrade(socket: NodeJS.WritableStream, status: number, message: string): void {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    if ('destroy' in socket && typeof socket.destroy === 'function') {
        socket.destroy();
    }
}

export const roomRealtimeHub = new RoomRealtimeHub();
