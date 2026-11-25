import type { Express } from 'express';
import { BAG_ACTIONS } from '../../../shared/rooms/bag.types';
import { ensureAuthenticatedSameUser, requireRequesterId, respondWithServiceError } from '../../infrastructure/http/request-helpers';
import { addSafeBreadcrumb, sendErrorResponse } from '../../infrastructure/observability/server-observability';
import { authorizeDevBagUser } from './membership/room-dev-tools.service';
import { publishRoomsActionResult } from './realtime/room-action-events';
import { handleRoomsAction, listRoomDiceRolls, listRoomMembersForUser, listRoomsForUser, type RoomsAction } from './rooms.service';
const services = { authorizeDevBagUser, handleRoomsAction, listRoomDiceRolls, listRoomsForUser, listRoomMembersForUser };
export function registerRoomsRoutes(app: Express, overrides: Partial<typeof services> = {}) {
    const { authorizeDevBagUser, handleRoomsAction, listRoomDiceRolls, listRoomsForUser, listRoomMembersForUser } = { ...services, ...overrides };
    app.get('/api/rooms', async (_req, res) => {
        const userId = res.locals.apiKeyUserId as string | undefined;
        if (!userId) {
            return sendErrorResponse(res, 401, 'API key is required to list rooms');
        }
        try {
            const rooms = await listRoomsForUser(userId);
            res.json({ success: true, data: { rooms } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'room.list_for_user');
        }
    });
    app.post(['/api/rooms', '/api/rooms/settings-transfer'], async (req, res) => {
        if (!req.body || typeof req.body !== 'object') {
            return sendErrorResponse(res, 400, 'Request body is required');
        }
        if ('payload' in req.body && (!req.body.payload || typeof req.body.payload !== 'object' || Array.isArray(req.body.payload))) {
            return sendErrorResponse(res, 400, 'Action payload must be an object');
        }
        const payload = req.body as RoomsAction;
        if (req.path === '/api/rooms/settings-transfer' && !['exportSettings', 'previewSettingsImport', 'importSettings'].includes(payload.action)) return sendErrorResponse(res, 400, 'Invalid settings transfer action');
        if (!('action' in payload)) {
            return sendErrorResponse(res, 400, 'Missing action');
        }
        try {
            addSafeBreadcrumb('room.action', 'Room action selected', {
                action: payload.action,
                roomId: 'payload' in payload && 'roomId' in payload.payload ? payload.payload.roomId : undefined,
                userId: 'payload' in payload && 'userId' in payload.payload ? payload.payload.userId : undefined
            });
            if (!['list', 'members', 'sessionState', 'sessions', 'sessionRecap', 'bonusPoints', 'rollAwards', 'messages'].includes(payload.action)) {
                const actor = 'payload' in payload && 'userId' in payload.payload ? payload.payload.userId : '';
                if (req.body.devMessageUserId !== undefined) {
                    if (payload.action !== 'message' || req.body.devMessageUserId !== actor || req.body.devBagUserId !== undefined)
                        return sendErrorResponse(res, 403, 'Invalid test message action');
                    const requester = res.locals.apiKeyUserId as string | undefined || await requireRequesterId(req, res);
                    if (!requester)
                        return;
                    await authorizeDevBagUser(requester, 'payload' in payload && 'roomId' in payload.payload ? payload.payload.roomId : '', actor ?? '');
                }
                else if (req.body.devBagUserId !== undefined) {
                    if (!(BAG_ACTIONS as readonly string[]).includes(payload.action) || payload.action === 'setBagEnabled' || req.body.devBagUserId !== actor)
                        return sendErrorResponse(res, 403, 'Invalid test bag action');
                    const requester = res.locals.apiKeyUserId as string | undefined || await requireRequesterId(req, res);
                    if (!requester)
                        return;
                    await authorizeDevBagUser(requester, 'payload' in payload && 'roomId' in payload.payload ? payload.payload.roomId : '', actor ?? '');
                }
                else if (!await ensureAuthenticatedSameUser(req, res, actor ?? ''))
                    return;
            }
            let recapViewerId: string | undefined;
            if (payload.action === 'sessionRecap') {
                recapViewerId = res.locals.apiKeyUserId as string | undefined || await requireRequesterId(req, res) || undefined;
                if (!recapViewerId)
                    return;
            }
            const data = await handleRoomsAction(payload, recapViewerId);
            await publishRoomsActionResult(payload, data);
            res.json({ success: true, data });
        }
        catch (error) {
            respondWithServiceError(res, error, `room.action.${payload.action}`, {
                action: payload.action,
                roomId: 'payload' in payload && 'roomId' in payload.payload ? payload.payload.roomId : undefined,
                userId: 'payload' in payload && 'userId' in payload.payload ? payload.payload.userId : undefined
            });
        }
    });
    app.get('/api/rooms/:roomId/members', async (req, res) => {
        const { roomId } = req.params;
        const userId = res.locals.apiKeyUserId as string | undefined;
        if (!userId) {
            return sendErrorResponse(res, 401, 'API key is required to list room members');
        }
        if (!roomId) {
            return sendErrorResponse(res, 400, 'Room id is required');
        }
        try {
            const members = await listRoomMembersForUser({ roomId, userId });
            res.json({ success: true, data: { roomId, members } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'room.members.list', { roomId, userId });
        }
    });
    app.get('/api/rooms/:roomId/dice-rolls', async (req, res) => {
        const userId = res.locals.apiKeyUserId as string | undefined;
        if (!userId)
            return sendErrorResponse(res, 401, 'API key is required to list dice rolls');
        const { roomId } = req.params;
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
        const since = typeof req.query.since === 'string' ? req.query.since : undefined;
        if (!roomId) {
            return sendErrorResponse(res, 400, 'Room id is required');
        }
        try {
            const diceRolls = await listRoomDiceRolls({ roomId, userId, limit, since });
            res.json({ success: true, data: { roomId, diceRolls } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'room.dice_rolls.list', { roomId, limit, since });
        }
    });
}
