import type { Express } from 'express';
import express from 'express';
import { requireRequesterId, respondWithServiceError } from '../../../infrastructure/http/request-helpers';
import { sendErrorResponse } from '../../../infrastructure/observability/server-observability';
import { authorizeDevBagUser } from '../membership/room-dev-tools.service';
import { readBagImage, storeBagImage } from './room-bag-images.service';
const services = { authorizeDevBagUser, storeBagImage, readBagImage };
export function registerBagsRoutes(app: Express, overrides: Partial<typeof services> = {}) {
    const { authorizeDevBagUser, storeBagImage, readBagImage } = { ...services, ...overrides };
    app.post('/api/rooms/:roomId/bag/images', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res) => {
        const userId = res.locals.apiKeyUserId as string | undefined || await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const actor = req.query.devBagUserId === undefined ? userId : String(req.query.devBagUserId);
            if (req.query.devBagUserId !== undefined)
                await authorizeDevBagUser(userId, String(req.params.roomId), actor);
            if (!Buffer.isBuffer(req.body))
                return sendErrorResponse(res, 400, 'Image bytes required');
            const imageId = await storeBagImage(String(req.params.roomId), actor, req.query.scope as 'team' | 'personal', req.body);
            res.json({ success: true, data: { imageId } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'bag.image.upload');
        }
    });
    app.get('/api/rooms/:roomId/bag/images/:imageId', async (req, res) => {
        const userId = res.locals.apiKeyUserId as string | undefined || await requireRequesterId(req, res);
        if (!userId)
            return;
        try {
            const actor = req.query.devBagUserId === undefined ? userId : String(req.query.devBagUserId);
            if (req.query.devBagUserId !== undefined)
                await authorizeDevBagUser(userId, String(req.params.roomId), actor);
            const bytes = await readBagImage(String(req.params.roomId), actor, String(req.params.imageId));
            res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(bytes);
        }
        catch (error) {
            respondWithServiceError(res, error, 'bag.image.read');
        }
    });
}
