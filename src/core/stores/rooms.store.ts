import { defineStore } from 'pinia';
import type { RoomBonusPointBalance, RoomBonusPointRule, RoomBonusPointSettings, RoomCriticalRule, RoomDetails, RoomMemberDetails, RoomMessage, RoomRealtimeEvent, RoomRealtimeStatus, RoomRollAwardsSnapshot, RoomSession } from 'netlify/core/types/data.types';
import type { DiceRoll } from 'core/utils/dice.utils';
import { RoomsService } from 'core/services/rooms.service';
import { RoomRealtimeService } from 'core/services/room-realtime.service';
import i18n from 'modules/language-switcher/plugins/i18n.plugin';

export const ROOM_MESSAGES_PAGE_SIZE = 20;
const t = i18n.global.t;

const realtimeService = new RoomRealtimeService();
let bufferedRealtimeEvents: RoomRealtimeEvent[] = [];
const seenRealtimeEventIds = new Set<string>();

const ensureAscending = (items: RoomMessage[]): RoomMessage[] => {
    return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const useRoomsStore = defineStore('rooms', {
    state: () => ({
        rooms: [] as RoomDetails[],
        selectedRoomId: null as string | null,
        selectedRoomUserId: null as string | null,
        messages: [] as RoomMessage[],
        members: [] as RoomMemberDetails[],
        bonusPointSettings: null as RoomBonusPointSettings | null,
        bonusPointRules: [] as RoomBonusPointRule[],
        bonusPointBalances: [] as RoomBonusPointBalance[],
        bonusPointsLoading: false,
        bonusPointsError: null as string | null,
        bonusPointRollUpdatingId: null as string | null,
        loadingRooms: false,
        creatingRoom: false,
        joiningRoom: false,
        sendingMessage: false,
        lastMessageAt: null as string | null,
        historyLoading: false,
        historyExhausted: false,
        realtimeStatus: 'disconnected' as RoomRealtimeStatus,
        realtimeHydrated: false,
        rollAwardsRealtimeSnapshot: null as RoomRollAwardsSnapshot | null,
        currentSession: null as RoomSession | null,
        closedSessionForRecap: null as RoomSession | null,
        sessionStartSignal: 0,
        sessionLoading: false,
        errorMessage: null as string | null,
    }),
    getters: {
        selectedRoom(state): RoomDetails | null {
            return state.rooms.find((room) => room.id === state.selectedRoomId) ?? null;
        },
    },
    actions: {
        setError(message: string | null) {
            this.errorMessage = message;
        },
        async fetchRooms(userId?: string | null) {
            this.loadingRooms = true;
            this.setError(null);
            try {
                if (!userId) {
                    this.rooms = [];
                    return;
                }
                const rooms = await RoomsService.fetchUserRooms(userId);
                this.rooms = rooms.sort(sortRoomsByActivity);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('rooms.errors.load'));
                throw error;
            } finally {
                this.loadingRooms = false;
            }
        },
        async createRoom(payload: { name: string; password?: string | null; userId: string }) {
            this.creatingRoom = true;
            this.setError(null);
            try {
                const room = await RoomsService.createRoom(payload);
                this.upsertRoom(room);
                await this.selectRoom(room.id, payload.userId);
                return room;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('rooms.errors.create'));
                throw error;
            } finally {
                this.creatingRoom = false;
            }
        },
        async joinRoom(payload: { inviteCode: string; password?: string | null; userId: string }) {
            this.joiningRoom = true;
            this.setError(null);
            try {
                const room = await RoomsService.joinRoom(payload);
                this.upsertRoom(room);
                await this.selectRoom(room.id, payload.userId);
                return room;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('rooms.errors.join'));
                throw error;
            } finally {
                this.joiningRoom = false;
            }
        },
        async selectRoom(roomId: string | null, userId?: string | null) {
            const normalizedUserId = userId ?? null;
            if (roomId === this.selectedRoomId && normalizedUserId === this.selectedRoomUserId) {
                if (roomId && this.realtimeStatus === 'disconnected') {
                    await this.connectAndHydrateRoom(roomId, normalizedUserId);
                }
                return;
            }

            this.stopLiveUpdates();
            this.selectedRoomId = roomId;
            this.selectedRoomUserId = normalizedUserId;
            this.messages = [];
            this.members = [];
            this.bonusPointSettings = null;
            this.bonusPointRules = [];
            this.bonusPointBalances = [];
            this.bonusPointsError = null;
            this.lastMessageAt = null;
            this.historyExhausted = false;
            this.historyLoading = false;
            this.realtimeHydrated = false;
            this.rollAwardsRealtimeSnapshot = null;
            this.currentSession = null;
            this.closedSessionForRecap = null;

            if (!roomId) {
                return;
            }

            await this.connectAndHydrateRoom(roomId, normalizedUserId);
        },
        async connectAndHydrateRoom(roomId: string, userId?: string | null) {
            this.realtimeHydrated = false;
            this.startLiveUpdates(roomId, userId);
            await Promise.all([
                this.loadMessages(roomId, userId),
                this.loadMembers(roomId, false),
                this.loadBonusPoints(roomId, true),
                this.loadSession(roomId),
                this.loadRollAwardsSnapshot(roomId)
            ]);
            if (this.selectedRoomId !== roomId) return;
            this.realtimeHydrated = true;
            const buffered = bufferedRealtimeEvents;
            bufferedRealtimeEvents = [];
            for (const event of buffered) {
                this.applyRealtimeEvent(event);
            }
        },
        async loadSession(roomId: string) {
            this.sessionLoading = true;
            try {
                const session = await RoomsService.fetchSessionState(roomId);
                if (this.selectedRoomId === roomId) this.currentSession = session;
                return session;
            } finally {
                this.sessionLoading = false;
            }
        },
        async startSession(payload: { roomId: string; userId: string }) {
            const session = await RoomsService.startSession(payload);
            this.currentSession = session;
            return session;
        },
        async closeSession(payload: { roomId: string; userId: string }) {
            const session = await RoomsService.closeSession(payload);
            this.currentSession = null;
            this.closedSessionForRecap = session;
            return session;
        },
        dismissSessionRecap() {
            this.closedSessionForRecap = null;
        },
        async loadMessages(roomId: string, userId?: string | null, limit: number = ROOM_MESSAGES_PAGE_SIZE) {
            try {
                const requester = userId ?? this.selectedRoomUserId ?? null;
                const messages = await RoomsService.fetchMessages(roomId, { userId: requester ?? undefined, limit });
                this.messages = ensureAscending(messages);
                this.lastMessageAt = this.messages.length > 0 ? this.messages[this.messages.length - 1].createdAt : null;
                this.historyExhausted = messages.length < limit;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('rooms.errors.loadMessages'));
            }
        },
        async loadMembers(roomId: string, preservePresence = true) {
            try {
                const members = await RoomsService.fetchMembers(roomId);
                if (this.selectedRoomId === roomId) {
                    this.members = members.map((member) => ({
                        ...member,
                        isOnline: preservePresence
                            ? this.members.find((current) => current.userId === member.userId)?.isOnline ?? false
                            : false
                    }));
                }
                return members;
            } catch (error) {
                console.error(error);
                return [];
            }
        },
        async sendChatMessage(payload: { roomId: string; userId: string; content: string }) {
            this.sendingMessage = true;
            this.setError(null);
            try {
                const message = await RoomsService.sendMessage({
                    roomId: payload.roomId,
                    userId: payload.userId,
                    content: payload.content,
                    type: 'text',
                });
                this.appendMessages([message]);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('rooms.errors.sendMessage'));
                throw error;
            } finally {
                this.sendingMessage = false;
            }
        },
        async sendDiceRoll(payload: { roomId: string; userId: string; roll: DiceRoll; skipBonusPointRules?: boolean }) {
            this.sendingMessage = true;
            this.setError(null);
            try {
                const message = await RoomsService.sendMessage({
                    roomId: payload.roomId,
                    userId: payload.userId,
                    type: 'dice',
                    dice: {
                        notation: payload.roll.dice,
                        total: payload.roll.total,
                        rolls: payload.roll.rolls,
                    },
                    content: payload.roll.description,
                    skipBonusPointRules: payload.skipBonusPointRules,
                });
                this.appendMessages([message]);
                await this.loadBonusPoints(payload.roomId, true);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('rooms.errors.sendDice'));
                throw error;
            } finally {
                this.sendingMessage = false;
            }
        },
        async loadOlderMessages(
            roomId: string,
            userId?: string | null,
            limit: number = ROOM_MESSAGES_PAGE_SIZE,
            allowWhenExhausted = false
        ) {
            if (this.historyLoading || (this.historyExhausted && !allowWhenExhausted)) return;
            const oldest = this.messages[0];
            if (!oldest) return;
            this.historyLoading = true;
            this.setError(null);
            try {
                const requester = userId ?? this.selectedRoomUserId ?? null;
                const older = await RoomsService.fetchMessages(roomId, {
                    userId: requester ?? undefined,
                    before: oldest.createdAt,
                    limit
                });
                if (older.length === 0) {
                    this.historyExhausted = true;
                    return;
                }
                const dedup = new Map(this.messages.map((message) => [message.id, message]));
                for (const message of older) {
                    dedup.set(message.id, message);
                }
                this.messages = ensureAscending(Array.from(dedup.values()));
                const last = this.messages[this.messages.length - 1];
                this.lastMessageAt = last ? last.createdAt : this.lastMessageAt;
                if (older.length < limit) {
                    this.historyExhausted = true;
                }
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('rooms.errors.loadOlderMessages'));
            } finally {
                this.historyLoading = false;
            }
        },
        async renameRoom(payload: { roomId: string; userId: string; name: string; sessionInactivityMinutes?: number }) {
            this.setError(null);
            try {
                const room = await RoomsService.updateRoom(payload);
                this.upsertRoom(room);
                return room;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('roomSettings.errors.updateSettings'));
                throw error;
            }
        },
        async updateRoomCriticals(payload: { roomId: string; userId: string; criticals: RoomCriticalRule[] }) {
            this.setError(null);
            try {
                const room = await RoomsService.updateRoomCriticals(payload);
                this.upsertRoom(room);
                return room;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('criticals.errors.save'));
                throw error;
            }
        },
        async loadBonusPoints(roomId: string, force = false) {
            if (!force && this.bonusPointSettings?.roomId === roomId) return;
            this.bonusPointsLoading = true;
            this.bonusPointsError = null;
            try {
                const data = await RoomsService.fetchBonusPoints(roomId);
                this.bonusPointSettings = data.settings;
                this.bonusPointRules = data.rules;
                this.bonusPointBalances = data.balances;
            } catch (error) {
                this.bonusPointsError = error instanceof Error ? error.message : 'Unable to load bonus points';
            } finally {
                this.bonusPointsLoading = false;
            }
        },
        async updateBonusPointSettings(payload: { roomId: string; userId: string; enabled?: boolean; maxPointsPerUser?: number; allowExtremeSpend?: boolean }) {
            const settings = await RoomsService.updateBonusPointSettings(payload);
            this.bonusPointSettings = settings;
            const room = this.rooms.find((current) => current.id === payload.roomId);
            if (room) {
                room.bonusPointSettings = settings;
            }
            if (typeof payload.maxPointsPerUser !== 'undefined') {
                this.bonusPointBalances = this.bonusPointBalances.map((balance) => ({
                    ...balance,
                    points: Math.min(balance.points, settings.maxPointsPerUser),
                }));
            }
            return settings;
        },
        async createBonusPointRule(payload: { roomId: string; userId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] }) {
            const rule = await RoomsService.createBonusPointRule(payload);
            this.bonusPointRules = [...this.bonusPointRules, rule];
            return rule;
        },
        async updateBonusPointRule(payload: { roomId: string; userId: string; ruleId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] }) {
            const rule = await RoomsService.updateBonusPointRule(payload);
            this.bonusPointRules = this.bonusPointRules.map((current) => (current.id === rule.id ? rule : current));
            return rule;
        },
        async deleteBonusPointRule(payload: { roomId: string; userId: string; ruleId: string }) {
            const id = await RoomsService.deleteBonusPointRule(payload);
            this.bonusPointRules = this.bonusPointRules.filter((rule) => rule.id !== id);
            return id;
        },
        async useBonusPointOnRoll(payload: { roomId: string; userId: string; messageId: string }) {
            this.bonusPointRollUpdatingId = payload.messageId;
            this.setError(null);
            try {
                const message = await RoomsService.useBonusPointOnRoll(payload);
                this.appendMessages([message]);
                await this.loadBonusPoints(payload.roomId, true);
                return message;
            } catch (error) {
                this.setError(error instanceof Error ? error.message : 'Unable to use bonus point');
                throw error;
            } finally {
                this.bonusPointRollUpdatingId = null;
            }
        },
        async updateBonusPointBalance(payload: { roomId: string; userId: string; targetUserId: string; points: number }) {
            this.bonusPointsError = null;
            try {
                const balance = await RoomsService.updateBonusPointBalance(payload);
                const existingIndex = this.bonusPointBalances.findIndex((current) => current.userId === balance.userId);
                if (existingIndex === -1) {
                    this.bonusPointBalances = [...this.bonusPointBalances, balance];
                } else {
                    this.bonusPointBalances = this.bonusPointBalances.map((current) => (
                        current.userId === balance.userId ? balance : current
                    ));
                }
                return balance;
            } catch (error) {
                this.bonusPointsError = error instanceof Error ? error.message : 'Unable to update bonus point balance';
                throw error;
            }
        },
        async updateNickname(payload: { roomId: string; userId: string; nickname?: string | null }) {
            this.setError(null);
            try {
                return await RoomsService.updateNickname(payload);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : t('roomSettings.errors.updateNickname'));
                throw error;
            }
        },
        appendMessages(messages: RoomMessage[]) {
            const dedup = new Map(this.messages.map((message) => [message.id, message]));
            for (const message of messages) {
                dedup.set(message.id, message);
            }
            this.messages = ensureAscending(Array.from(dedup.values()));
            const last = this.messages[this.messages.length - 1];
            this.lastMessageAt = last ? last.createdAt : this.lastMessageAt;
            if (messages.length > 0) {
                const latest = messages[messages.length - 1];
                this.bumpRoomActivity(latest.roomId, latest.createdAt);
            }
        },
        trimMessages(limit: number = ROOM_MESSAGES_PAGE_SIZE) {
            if (this.messages.length <= limit) return;
            this.messages = ensureAscending(this.messages.slice(-limit));
            const last = this.messages[this.messages.length - 1];
            this.lastMessageAt = last ? last.createdAt : this.lastMessageAt;
        },
        upsertRoom(room: RoomDetails) {
            const existingIndex = this.rooms.findIndex((current) => current.id === room.id);
            if (existingIndex !== -1) {
                this.rooms[existingIndex] = room;
            } else {
                this.rooms.push(room);
            }
            this.rooms = [...this.rooms].sort(sortRoomsByActivity);
        },
        startLiveUpdates(roomId: string, userId?: string | null) {
            if (typeof window === 'undefined') return;
            bufferedRealtimeEvents = [];
            seenRealtimeEventIds.clear();
            realtimeService.connect(roomId, {
                onEvent: (event) => {
                    if (this.selectedRoomId !== roomId) return;
                    this.receiveRealtimeEvent(event);
                },
                onStatus: (status) => {
                    if (this.selectedRoomId === roomId || status === 'disconnected') {
                        this.realtimeStatus = status;
                    }
                },
                onReady: (reconnected) => {
                    if (this.realtimeHydrated && this.selectedRoomId === roomId) {
                        if (reconnected) {
                            void this.rehydrateRoomAfterReconnect(roomId, userId ?? this.selectedRoomUserId);
                        } else {
                            void this.catchUpMessages(roomId, userId ?? this.selectedRoomUserId);
                        }
                    }
                },
                onTerminalClose: (code) => {
                    if (this.selectedRoomId !== roomId) return;
                    this.exitUnavailableRoom(code === 4004
                        ? 'This room is no longer available.'
                        : 'You are no longer a member of this room.');
                }
            });
        },
        stopLiveUpdates() {
            if (typeof window !== 'undefined') realtimeService.disconnect();
            this.realtimeStatus = 'disconnected';
            this.realtimeHydrated = false;
            bufferedRealtimeEvents = [];
            seenRealtimeEventIds.clear();
        },
        async catchUpMessages(roomId: string, userId?: string | null) {
            if (this.selectedRoomId !== roomId) return;
            const latestTimestamp = this.lastMessageAt;
            if (!latestTimestamp) {
                await this.loadMessages(roomId, userId);
                return;
            }
            const parsed = new Date(latestTimestamp);
            const overlapSince = Number.isNaN(parsed.getTime())
                ? latestTimestamp
                : new Date(parsed.getTime() - 1_000).toISOString();
            try {
                const updates = await RoomsService.fetchMessages(roomId, {
                    since: overlapSince,
                    userId: userId ?? undefined
                });
                if (this.selectedRoomId === roomId) this.appendMessages(updates);
            } catch (error) {
                console.error(error);
            }
        },
        async loadRollAwardsSnapshot(roomId: string) {
            try {
                const { awards, enabled } = await RoomsService.fetchRollAwards(roomId);
                if (this.selectedRoomId === roomId) {
                    this.rollAwardsRealtimeSnapshot = { roomId, awards, enabled };
                }
            } catch (error) {
                console.error(error);
            }
        },
        async refreshRoomDetails(roomId: string, userId?: string | null) {
            if (!userId) return;
            try {
                const rooms = await RoomsService.fetchUserRooms(userId);
                const room = rooms.find((current) => current.id === roomId);
                if (room && this.selectedRoomId === roomId) this.upsertRoom(room);
            } catch (error) {
                console.error(error);
            }
        },
        async rehydrateRoomAfterReconnect(roomId: string, userId?: string | null) {
            if (this.selectedRoomId !== roomId) return;

            // Buffer live events while the recovery reads are in flight so an HTTP
            // snapshot can never overwrite a newer WebSocket update.
            this.realtimeHydrated = false;
            try {
                await Promise.all([
                    this.catchUpMessages(roomId, userId),
                    this.loadMembers(roomId, false),
                    this.loadBonusPoints(roomId, true),
                    this.loadSession(roomId),
                    this.loadRollAwardsSnapshot(roomId),
                    this.refreshRoomDetails(roomId, userId)
                ]);
            } catch (error) {
                console.error(error);
            } finally {
                if (this.selectedRoomId !== roomId) return;
                this.realtimeHydrated = true;
                const buffered = bufferedRealtimeEvents;
                bufferedRealtimeEvents = [];
                for (const event of buffered) this.applyRealtimeEvent(event);
            }
        },
        receiveRealtimeEvent(event: RoomRealtimeEvent) {
            if (seenRealtimeEventIds.has(event.eventId)) return;
            seenRealtimeEventIds.add(event.eventId);
            if (seenRealtimeEventIds.size > 1_000) {
                seenRealtimeEventIds.clear();
                seenRealtimeEventIds.add(event.eventId);
            }
            if (!this.realtimeHydrated) {
                bufferedRealtimeEvents.push(event);
                return;
            }
            this.applyRealtimeEvent(event);
        },
        applyRealtimeEvent(event: RoomRealtimeEvent) {
            if (event.roomId !== this.selectedRoomId) return;
            switch (event.type) {
                case 'connection.ready':
                    return;
                case 'message.created':
                case 'message.updated':
                    this.appendMessages([event.message]);
                    return;
                case 'room.updated': {
                    const existing = this.rooms.find((room) => room.id === event.room.id);
                    this.upsertRoom({
                        ...existing,
                        ...event.room,
                        isCreator: existing?.isCreator
                    });
                    return;
                }
                case 'room.archived': {
                    const room = this.rooms.find((current) => current.id === event.roomId);
                    if (room) {
                        room.archivedAt = event.archivedAt;
                        room.isArchived = true;
                    }
                    this.exitUnavailableRoom('This room has been archived.');
                    return;
                }
                case 'member.updated':
                    this.upsertMember(event.member);
                    return;
                case 'member.removed': {
                    this.members = this.members.filter((member) => member.userId !== event.userId);
                    const room = this.rooms.find((current) => current.id === event.roomId);
                    if (room) room.memberCount = event.memberCount;
                    if (event.userId === this.selectedRoomUserId) {
                        this.exitUnavailableRoom('You are no longer a member of this room.');
                    }
                    return;
                }
                case 'presence.updated':
                    this.members = this.members.map((member) => member.userId === event.userId
                        ? { ...member, isOnline: event.isOnline, lastSeen: event.lastSeen }
                        : member);
                    return;
                case 'bonus_points.updated':
                    this.bonusPointSettings = event.snapshot.settings;
                    this.bonusPointRules = event.snapshot.rules;
                    this.bonusPointBalances = event.snapshot.balances;
                    return;
                case 'roll_awards.updated':
                    this.rollAwardsRealtimeSnapshot = event.snapshot;
                    return;
                case 'session.started':
                    this.currentSession = event.session;
                    this.sessionStartSignal += 1;
                    return;
                case 'session.updated':
                    this.currentSession = event.session;
                    return;
                case 'session.closed':
                    if (this.currentSession?.id === event.session.id) this.currentSession = null;
                    this.closedSessionForRecap = event.session;
                    return;
            }
        },
        upsertMember(member: RoomMemberDetails) {
            const index = this.members.findIndex((current) => current.userId === member.userId);
            if (index === -1) {
                this.members = [...this.members, member];
            } else {
                this.members = this.members.map((current) => current.userId === member.userId
                    ? { ...current, ...member }
                    : current);
            }
            this.messages = this.messages.map((message) => message.userId === member.userId
                ? {
                    ...message,
                    username: member.username,
                    nickname: member.nickname,
                    avatar: member.avatar
                }
                : message);
        },
        exitUnavailableRoom(message: string) {
            this.setError(message);
            this.stopLiveUpdates();
            this.selectedRoomId = null;
            this.selectedRoomUserId = null;
            this.messages = [];
            this.members = [];
            this.currentSession = null;
            this.closedSessionForRecap = null;
        },
        bumpRoomActivity(roomId: string, activity: string) {
            const room = this.rooms.find((current) => current.id === roomId);
            if (!room) return;
            room.lastActivity = activity;
            this.rooms = [...this.rooms].sort(sortRoomsByActivity);
        },
        teardown() {
            this.stopLiveUpdates();
            this.selectedRoomId = null;
            this.selectedRoomUserId = null;
            this.messages = [];
            this.members = [];
            this.lastMessageAt = null;
            this.currentSession = null;
            this.closedSessionForRecap = null;
        },
    },
});

function sortRoomsByActivity(a: RoomDetails, b: RoomDetails) {
    const aDate = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const bDate = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return bDate - aDate;
}
