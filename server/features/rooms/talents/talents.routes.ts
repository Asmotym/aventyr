import type { Express } from 'express';
import express from 'express';
import { requireRequesterId, respondWithServiceError } from '../../../infrastructure/http/request-helpers';
import { readTalentImage, storeTalentImage } from './room-talents.service';
const services = { storeTalentImage, readTalentImage };
export function registerTalentsRoutes(app: Express, overrides: Partial<typeof services> = {}) {
    const { storeTalentImage, readTalentImage } = { ...services, ...overrides };
    app.post('/api/rooms/:roomId/talents/images', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res) => {
        try {
            const userId = res.locals.apiKeyUserId as string | undefined || await requireRequesterId(req, res);
            if (!userId)
                return;
            const id = await storeTalentImage(String(req.params.roomId), userId, req.body);
            res.json({ success: true, data: { id } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'talents.image.upload');
        }
    });
    app.get('/api/rooms/:roomId/talents/images/:imageId', async (req, res) => {
        try {
            const userId = res.locals.apiKeyUserId as string | undefined || await requireRequesterId(req, res);
            if (!userId)
                return;
            const bytes = await readTalentImage(String(req.params.roomId), userId, String(req.params.imageId));
            res.set('Cache-Control', 'private, no-store').type('image/webp').send(bytes);
        }
        catch (error) {
            respondWithServiceError(res, error, 'talents.image.read');
        }
    });
}
