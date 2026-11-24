import type { Express } from 'express';
import { isAppLocale } from '../../../shared/accounts/locale.types';
import { isAppTheme, isAppThemeStyle, type AppTheme, type AppThemeStyle } from '../../../shared/accounts/theme.types';
import { isArticleSort, type ArticleSort } from '../../../shared/articles/articles.types';
import { ensureAuthenticatedSameUser, requireRequesterId, respondWithServiceError } from '../../infrastructure/http/request-helpers';
import { sendErrorResponse } from '../../infrastructure/observability/server-observability';
import { generateUserApiKey, getUserApiKey, revokeUserApiKey } from './api-keys.service';
import { getUser, updateUserPreferences } from './repositories/users.table';
import { getPublicUserProfile, updateAboutMe } from './user-profiles.service';
const services = { generateUserApiKey, getUserApiKey, revokeUserApiKey, getUser, updateUserPreferences, getPublicUserProfile, updateAboutMe };
export function registerAccountsRoutes(app: Express, overrides: Partial<typeof services> = {}) {
    const { generateUserApiKey, getUserApiKey, revokeUserApiKey, getUser, updateUserPreferences, getPublicUserProfile, updateAboutMe } = { ...services, ...overrides };
    app.get('/api/users/:userId/profile', async (req, res) => {
        const requesterUserId = await requireRequesterId(req, res);
        if (!requesterUserId)
            return;
        const { userId } = req.params;
        if (!userId)
            return sendErrorResponse(res, 400, 'User id is required');
        const roomId = typeof req.query.roomId === 'string' && req.query.roomId.trim()
            ? req.query.roomId.trim()
            : undefined;
        try {
            const profile = await getPublicUserProfile({
                targetUserId: userId,
                requesterUserId,
                roomId
            });
            res.setHeader('Cache-Control', 'no-store');
            res.json({ success: true, data: profile });
        }
        catch (error) {
            respondWithServiceError(res, error, 'user_profile.fetch', { userId, roomId });
        }
    });
    app.patch('/api/users/:userId/profile', async (req, res) => {
        const { userId } = req.params;
        if (!userId)
            return sendErrorResponse(res, 400, 'User id is required');
        if (!(await ensureAuthenticatedSameUser(req, res, userId)))
            return;
        if (!req.body || typeof req.body !== 'object' || !Object.prototype.hasOwnProperty.call(req.body, 'aboutMe')) {
            return sendErrorResponse(res, 400, 'About Me is required');
        }
        try {
            const profile = await updateAboutMe(userId, (req.body as {
                aboutMe?: unknown;
            }).aboutMe);
            res.setHeader('Cache-Control', 'no-store');
            res.json({ success: true, data: profile });
        }
        catch (error) {
            respondWithServiceError(res, error, 'user_profile.update', { userId });
        }
    });
    app.get('/api/users/:userId/api-key', async (req, res) => {
        const { userId } = req.params;
        if (!userId) {
            return sendErrorResponse(res, 400, 'User id is required');
        }
        if (!await ensureAuthenticatedSameUser(req, res, userId)) {
            return;
        }
        try {
            const payload = await getUserApiKey(userId);
            res.json({
                success: true,
                data: {
                    apiKey: payload?.apiKey ?? null,
                    createdAt: payload?.createdAt ?? null,
                    lastUsedAt: payload?.lastUsedAt ?? null
                }
            });
        }
        catch (error) {
            respondWithServiceError(res, error, 'api_key.fetch');
        }
    });
    app.post('/api/users/:userId/api-key', async (req, res) => {
        const { userId } = req.params;
        if (!userId) {
            return sendErrorResponse(res, 400, 'User id is required');
        }
        if (!await ensureAuthenticatedSameUser(req, res, userId)) {
            return;
        }
        try {
            const payload = await generateUserApiKey(userId);
            res.json({ success: true, data: payload });
        }
        catch (error) {
            respondWithServiceError(res, error, 'api_key.generate');
        }
    });
    app.delete('/api/users/:userId/api-key', async (req, res) => {
        const { userId } = req.params;
        if (!userId) {
            return sendErrorResponse(res, 400, 'User id is required');
        }
        if (!await ensureAuthenticatedSameUser(req, res, userId)) {
            return;
        }
        try {
            await revokeUserApiKey(userId);
            res.json({ success: true, data: { apiKey: null } });
        }
        catch (error) {
            respondWithServiceError(res, error, 'api_key.revoke');
        }
    });
    app.get('/api/users/:userId/preferences', async (req, res) => {
        const { userId } = req.params;
        if (!userId) {
            return sendErrorResponse(res, 400, 'User id is required');
        }
        if (!(await ensureAuthenticatedSameUser(req, res, userId))) {
            return;
        }
        try {
            const user = await getUser(userId);
            if (!user) {
                return sendErrorResponse(res, 404, 'User not found');
            }
            res.json({
                success: true,
                data: {
                    theme: user.theme ?? 'dark',
                    themeStyle: user.theme_style ?? 'aventyr',
                    articleSort: user.article_sort ?? 'newest',
                    locale: user.locale ?? null
                }
            });
        }
        catch (error) {
            respondWithServiceError(res, error, 'user_preferences.fetch');
        }
    });
    app.patch('/api/users/:userId/preferences', async (req, res) => {
        const { userId } = req.params;
        if (!userId) {
            return sendErrorResponse(res, 400, 'User id is required');
        }
        if (!(await ensureAuthenticatedSameUser(req, res, userId))) {
            return;
        }
        if (!req.body || typeof req.body !== 'object') {
            return sendErrorResponse(res, 400, 'Request body is required');
        }
        const body = req.body as {
            theme?: unknown;
            themeStyle?: unknown;
            locale?: unknown;
            articleSort?: unknown;
        };
        const hasArticleSort = Object.prototype.hasOwnProperty.call(body, 'articleSort');
        if (hasArticleSort && !isArticleSort(body.articleSort))
            return sendErrorResponse(res, 400, 'Invalid article sort');
        const hasTheme = Object.prototype.hasOwnProperty.call(body, 'theme');
        const hasThemeStyle = Object.prototype.hasOwnProperty.call(body, 'themeStyle');
        const hasLocale = Object.prototype.hasOwnProperty.call(body, 'locale');
        if (!hasTheme && !hasThemeStyle && !hasLocale && !hasArticleSort) {
            return sendErrorResponse(res, 400, 'At least one preference is required');
        }
        if (hasTheme && !isAppTheme(body.theme)) {
            return sendErrorResponse(res, 400, 'Invalid theme preference');
        }
        if (hasThemeStyle && !isAppThemeStyle(body.themeStyle)) {
            return sendErrorResponse(res, 400, 'Invalid theme style preference');
        }
        if (hasLocale && !isAppLocale(body.locale)) {
            return sendErrorResponse(res, 400, 'Invalid locale preference');
        }
        try {
            const user = await getUser(userId);
            if (!user) {
                return sendErrorResponse(res, 404, 'User not found');
            }
            const preferences = await updateUserPreferences(userId, {
                ...(hasArticleSort ? { articleSort: body.articleSort as ArticleSort } : {}),
                ...(hasTheme ? { theme: body.theme as AppTheme } : {}),
                ...(hasThemeStyle ? { themeStyle: body.themeStyle as AppThemeStyle } : {}),
                ...(hasLocale ? { locale: body.locale as 'en' | 'es' | 'fr' | 'de' } : {})
            });
            if (!preferences) {
                return sendErrorResponse(res, 404, 'User not found');
            }
            res.json({ success: true, data: preferences });
        }
        catch (error) {
            respondWithServiceError(res, error, 'user_preferences.update', {
                theme: hasTheme ? body.theme as string : undefined,
                themeStyle: hasThemeStyle ? body.themeStyle as string : undefined,
                locale: hasLocale ? body.locale as string : undefined
            });
        }
    });
}
