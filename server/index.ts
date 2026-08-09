import './sentry.ts';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'http';
import { createLogger } from './core/utils/logger';
import { handleRoomsAction, listRoomDiceRolls, listRoomsForUser, listRoomMembersForUser, type RoomsAction } from './services/rooms.service';
import { handleDiscordQuery, type DiscordQueryPayload } from './core/discord/discord-handler.core';
import { cors } from './middlewares/cors';
import { requireApiKeyForUntrustedOrigins } from './middlewares/api-key';
import { generateUserApiKey, getUserApiKey, revokeUserApiKey } from './services/api-keys.service';
import * as Sentry from '@sentry/node';
import { query } from './core/database/client';
import { ensureDatabaseSetup } from './core/database/schema';
import { getUser, updateUserPreferences } from './core/database/tables/users.table';
import { isAppTheme, isAppThemeStyle, type AppTheme, type AppThemeStyle } from './core/types/theme.types';
import { isAppLocale } from './core/types/locale.types';
import { listAdminUsers, updateUserRole } from './services/admin.service';
import { requireAdmin } from './services/roles.service';
import {
    archiveArticle,
    createArticle,
    createTag,
    getAdminArticle,
    getPublicArticle,
    listAdminArticles,
    listNewsArticles,
    listOwnerDrafts,
    listPublicArticles,
    listTags,
    previewMarkdown,
    removeDraft,
    removeTag,
    renameTag,
    saveDraft,
    setArticlePublication,
    updateArticle
} from './services/articles.service';
import {
    addSafeBreadcrumb,
    handleServerError,
    requestCorrelationMiddleware,
    sendErrorResponse,
    setAuthenticatedUser,
    type SafeSentryContext
} from './observability/server-observability';
import { roomRealtimeHub } from './realtime/room-realtime.server';
import { publishRoomsActionResult } from './realtime/room-action-events';
import { getPublicUserProfile, updateAboutMe } from './services/user-profiles.service';
import { expireInactiveSessions } from './services/rooms/room-sessions.service';
import { publishRoomEvent } from './realtime/room-realtime.publisher';

const logger = createLogger('Server');
const app = express();

app.use(requestCorrelationMiddleware);
app.use(cors);
app.use(express.json({ limit: '1mb' }));

function sendHealthResponse(res: Response, statusCode: number, payload: Record<string, unknown>) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(statusCode).json({
        ...payload,
        ...(statusCode >= 400 ? { requestId: res.locals.requestId as string | undefined } : {}),
        timestamp: new Date().toISOString()
    });
}

app.get('/health', (_req, res) => {
    return sendHealthResponse(res, 200, { status: 'ok' });
});

app.get('/ready', async (_req, res) => {
    try {
        await query('SELECT 1 AS ok');
        return sendHealthResponse(res, 200, {
            status: 'ready',
            dependencies: {
                database: 'ok'
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected database readiness failure';
        const meta = error instanceof Error ? { stack: error.stack } : undefined;
        logger.warn(`Readiness check failed: ${message}`, meta);

        return sendHealthResponse(res, 503, {
            status: 'unavailable',
            dependencies: {
                database: 'unavailable'
            },
            error: message
        });
    }
});

app.use('/api', requireApiKeyForUntrustedOrigins);

function respondWithServiceError(
    res: Response,
    error: unknown,
    operation: string,
    domainContext: SafeSentryContext = {}
) {
    return handleServerError(res.req, res, error, operation, domainContext);
}

function ensureSameUser(res: Response, userId: string): boolean {
    const apiKeyUserId = res.locals.apiKeyUserId as string | undefined;
    if (apiKeyUserId && apiKeyUserId !== userId) {
        sendErrorResponse(res, 403, 'API key does not belong to this user');
        return false;
    }
    return true;
}

async function readDiscordRequesterId(req: Request): Promise<string | null> {
    const authHeader = req.header('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
        return null;
    }

    addSafeBreadcrumb('http.client', 'Discord requester verification started', {
        provider: 'discord',
        endpoint: '/users/@me'
    });
    const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: authHeader }
    });
    if (!response.ok) {
        addSafeBreadcrumb('http.client', 'Discord requester verification failed', {
            provider: 'discord',
            status: response.status
        });
        return null;
    }
    const user = await response.json() as { id?: unknown };
    return typeof user.id === 'string' ? user.id : null;
}

async function requireRequesterId(req: Request, res: Response): Promise<string | null> {
    const userId = await readDiscordRequesterId(req);
    if (!userId) {
        sendErrorResponse(res, 401, 'Discord authentication is required');
        return null;
    }
    setAuthenticatedUser(res, userId);
    return userId;
}

async function ensureAuthenticatedSameUser(
    req: Request,
    res: Response,
    userId: string
): Promise<boolean> {
    const apiKeyUserId = res.locals.apiKeyUserId as string | undefined;
    if (apiKeyUserId) {
        return ensureSameUser(res, userId);
    }

    const requesterId = await requireRequesterId(req, res);
    if (!requesterId) return false;
    if (requesterId !== userId) {
        sendErrorResponse(res, 403, 'Cannot access another user\'s preferences');
        return false;
    }
    return true;
}

app.get('/api/users/:userId/profile', async (req, res) => {
    const requesterUserId = await requireRequesterId(req, res);
    if (!requesterUserId) return;
    const { userId } = req.params;
    if (!userId) return sendErrorResponse(res, 400, 'User id is required');
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
    } catch (error) {
        respondWithServiceError(res, error, 'user_profile.fetch', { userId, roomId });
    }
});

app.patch('/api/users/:userId/profile', async (req, res) => {
    const { userId } = req.params;
    if (!userId) return sendErrorResponse(res, 400, 'User id is required');
    if (!(await ensureAuthenticatedSameUser(req, res, userId))) return;
    if (!req.body || typeof req.body !== 'object' || !Object.prototype.hasOwnProperty.call(req.body, 'aboutMe')) {
        return sendErrorResponse(res, 400, 'About Me is required');
    }

    try {
        const profile = await updateAboutMe(userId, (req.body as { aboutMe?: unknown }).aboutMe);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, data: profile });
    } catch (error) {
        respondWithServiceError(res, error, 'user_profile.update', { userId });
    }
});

app.get('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
    }

    if (!ensureSameUser(res, userId)) {
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
    } catch (error) {
        respondWithServiceError(res, error, 'api_key.fetch');
    }
});

app.post('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        const payload = await generateUserApiKey(userId);
        res.json({ success: true, data: payload });
    } catch (error) {
        respondWithServiceError(res, error, 'api_key.generate');
    }
});

app.delete('/api/users/:userId/api-key', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return sendErrorResponse(res, 400, 'User id is required');
    }

    if (!ensureSameUser(res, userId)) {
        return;
    }

    try {
        await revokeUserApiKey(userId);
        res.json({ success: true, data: { apiKey: null } });
    } catch (error) {
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
                locale: user.locale ?? 'en'
            }
        });
    } catch (error) {
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

    const body = req.body as { theme?: unknown; themeStyle?: unknown; locale?: unknown };
    const hasTheme = Object.prototype.hasOwnProperty.call(body, 'theme');
    const hasThemeStyle = Object.prototype.hasOwnProperty.call(body, 'themeStyle');
    const hasLocale = Object.prototype.hasOwnProperty.call(body, 'locale');
    if (!hasTheme && !hasThemeStyle && !hasLocale) {
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
            ...(hasTheme ? { theme: body.theme as AppTheme } : {}),
            ...(hasThemeStyle ? { themeStyle: body.themeStyle as AppThemeStyle } : {}),
            ...(hasLocale ? { locale: body.locale as 'en' | 'es' | 'fr' | 'de' } : {})
        });
        if (!preferences) {
            return sendErrorResponse(res, 404, 'User not found');
        }
        res.json({ success: true, data: preferences });
    } catch (error) {
        respondWithServiceError(res, error, 'user_preferences.update', {
            theme: hasTheme ? body.theme as string : undefined,
            themeStyle: hasThemeStyle ? body.themeStyle as string : undefined,
            locale: hasLocale ? body.locale as string : undefined
        });
    }
});

app.get('/api/articles', async (req, res) => {
    try {
        const articles = await listPublicArticles({
            search: req.query.search,
            tags: req.query.tags,
            limit: req.query.limit,
            offset: req.query.offset
        });
        res.json({ success: true, data: { articles } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.list_public');
    }
});

app.get('/api/articles/news', async (req, res) => {
    try {
        const articles = await listNewsArticles(req.query.limit);
        res.json({ success: true, data: { articles } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.list_news');
    }
});

app.get('/api/articles/tags', async (_req, res) => {
    try {
        const tags = await listTags();
        res.json({ success: true, data: { tags } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.list');
    }
});

app.get('/api/articles/:slug', async (req, res) => {
    try {
        const article = await getPublicArticle(req.params.slug);
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.fetch_public');
    }
});

app.get('/api/admin/users', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const users = await listAdminUsers(userId);
        res.json({ success: true, data: { users } });
    } catch (error) {
        respondWithServiceError(res, error, 'admin_user.list');
    }
});

app.patch('/api/admin/users/:targetUserId/role', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const user = await updateUserRole(userId, req.params.targetUserId, (req.body as { role?: unknown }).role);
        res.json({ success: true, data: { user } });
    } catch (error) {
        respondWithServiceError(res, error, 'admin_user.update_role');
    }
});

app.get('/api/admin/articles', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const articles = await listAdminArticles(userId, {
            search: req.query.search,
            tags: req.query.tags,
            statuses: req.query.statuses,
            archived: req.query.archived,
            limit: req.query.limit,
            offset: req.query.offset
        });
        res.json({ success: true, data: { articles } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.list_admin');
    }
});

app.get('/api/admin/articles/detail/:articleId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await getAdminArticle(userId, req.params.articleId);
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.fetch_admin');
    }
});

app.post('/api/admin/articles', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await createArticle(userId, req.body as { title?: unknown; introduction?: unknown; markdownSource?: unknown; tagIds?: unknown; status?: unknown; publishedAt?: unknown; draftId?: unknown });
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.create');
    }
});

app.patch('/api/admin/articles/:articleId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await updateArticle(userId, req.params.articleId, req.body as { title?: unknown; introduction?: unknown; markdownSource?: unknown; tagIds?: unknown });
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.update');
    }
});

app.post('/api/admin/articles/:articleId/publication', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const body = req.body as { published?: unknown; publishedAt?: unknown };
        const article = await setArticlePublication(userId, req.params.articleId, { published: body.published === true, publishedAt: body.publishedAt });
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.update_publication');
    }
});

app.post('/api/admin/articles/:articleId/archive', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const article = await archiveArticle(userId, req.params.articleId);
        res.json({ success: true, data: { article } });
    } catch (error) {
        respondWithServiceError(res, error, 'article.archive');
    }
});

app.post('/api/admin/articles/preview', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        await requireAdmin(userId);
        const preview = previewMarkdown((req.body as { markdownSource?: unknown }).markdownSource);
        res.json({ success: true, data: preview });
    } catch (error) {
        respondWithServiceError(res, error, 'article.preview');
    }
});

app.post('/api/admin/articles/tags', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const tag = await createTag(userId, (req.body as { name?: unknown }).name);
        res.json({ success: true, data: { tag } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.create');
    }
});

app.patch('/api/admin/articles/tags/:tagId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const tag = await renameTag(userId, req.params.tagId, (req.body as { name?: unknown }).name);
        res.json({ success: true, data: { tag } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.rename');
    }
});

app.delete('/api/admin/articles/tags/:tagId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        await removeTag(userId, req.params.tagId);
        res.json({ success: true, data: { tagId: req.params.tagId } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_tag.delete');
    }
});

app.get('/api/admin/articles/drafts', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const drafts = await listOwnerDrafts(userId);
        res.json({ success: true, data: { drafts } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_draft.list');
    }
});

app.post('/api/admin/articles/drafts', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        const draft = await saveDraft(userId, req.body as { id?: unknown; title?: unknown; introduction?: unknown; markdownSource?: unknown; selectedTagIds?: unknown });
        res.json({ success: true, data: { draft } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_draft.save');
    }
});

app.delete('/api/admin/articles/drafts/:draftId', async (req, res) => {
    const userId = await requireRequesterId(req, res);
    if (!userId) return;
    try {
        await removeDraft(userId, req.params.draftId);
        res.json({ success: true, data: { draftId: req.params.draftId } });
    } catch (error) {
        respondWithServiceError(res, error, 'article_draft.delete');
    }
});

app.get('/api/rooms', async (_req, res) => {
    const userId = res.locals.apiKeyUserId as string | undefined;
    if (!userId) {
        return sendErrorResponse(res, 401, 'API key is required to list rooms');
    }

    try {
        const rooms = await listRoomsForUser(userId);
        res.json({ success: true, data: { rooms } });
    } catch (error) {
        respondWithServiceError(res, error, 'room.list_for_user');
    }
});

app.post('/api/rooms', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return sendErrorResponse(res, 400, 'Request body is required');
    }

    const payload = req.body as RoomsAction;
    if (!('action' in payload)) {
        return sendErrorResponse(res, 400, 'Missing action');
    }

    try {
        addSafeBreadcrumb('room.action', 'Room action selected', {
            action: payload.action,
            roomId: 'payload' in payload && 'roomId' in payload.payload ? payload.payload.roomId : undefined,
            userId: 'payload' in payload && 'userId' in payload.payload ? payload.payload.userId : undefined
        });
        const data = await handleRoomsAction(payload);
        await publishRoomsActionResult(payload, data);
        res.json({ success: true, data });
    } catch (error) {
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
    } catch (error) {
        respondWithServiceError(res, error, 'room.members.list', { roomId, userId });
    }
});

app.post('/api/discord/oauth/token', async (req, res) => {
    const clientId = (
        process.env.DISCORD_CLIENT_ID
        ?? process.env.VITE_DISCORD_CLIENT_ID
    )?.trim();
    const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
    const configuredRedirectUri = (
        process.env.DISCORD_REDIRECT_URI
        ?? process.env.VITE_DISCORD_REDIRECT_URI
    )?.trim();
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
        grantType?: unknown;
        code?: unknown;
        refreshToken?: unknown;
        redirectUri?: unknown;
    };

    if (!clientId || !clientSecret) {
        return sendErrorResponse(res, 503, 'Discord OAuth is not configured');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret
    });
    if (body.grantType === 'authorization_code') {
        if (
            typeof body.code !== 'string'
            || !body.code
            || typeof body.redirectUri !== 'string'
            || !body.redirectUri
            || (configuredRedirectUri && body.redirectUri !== configuredRedirectUri)
        ) {
            return sendErrorResponse(res, 400, 'Invalid Discord authorization request');
        }
        params.set('grant_type', 'authorization_code');
        params.set('code', body.code);
        params.set('redirect_uri', body.redirectUri);
    } else if (body.grantType === 'refresh_token') {
        if (typeof body.refreshToken !== 'string' || !body.refreshToken) {
            return sendErrorResponse(res, 400, 'A Discord refresh token is required');
        }
        params.set('grant_type', 'refresh_token');
        params.set('refresh_token', body.refreshToken);
    } else {
        return sendErrorResponse(res, 400, 'Unsupported Discord OAuth grant');
    }

    try {
        const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        const token = await tokenResponse.json() as {
            token_type?: unknown;
            access_token?: unknown;
            refresh_token?: unknown;
            expires_in?: unknown;
            scope?: unknown;
        };
        if (
            !tokenResponse.ok
            || typeof token.token_type !== 'string'
            || typeof token.access_token !== 'string'
            || typeof token.refresh_token !== 'string'
            || typeof token.expires_in !== 'number'
        ) {
            addSafeBreadcrumb('http.client', 'Discord token exchange failed', {
                provider: 'discord',
                status: tokenResponse.status,
                grantType: body.grantType
            });
            return sendErrorResponse(res, 401, 'Discord authentication could not be refreshed');
        }
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true,
            data: {
                token_type: token.token_type,
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                expires_in: token.expires_in,
                scope: typeof token.scope === 'string' ? token.scope : ''
            }
        });
    } catch (error) {
        return respondWithServiceError(res, error, 'discord.oauth.token', {
            grantType: typeof body.grantType === 'string' ? body.grantType : undefined
        });
    }
});

app.post('/api/discord', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return sendErrorResponse(res, 400, 'Request body is required');
    }

    const body = req.body as DiscordQueryPayload;
    const queryType = body.queryType ?? 'user';

    try {
        addSafeBreadcrumb('discord', 'Discord query selected', { queryType });
        const data = await handleDiscordQuery({ ...body, queryType });
        res.json({ success: true, data, queryType });
    } catch (error) {
        respondWithServiceError(res, error, 'discord.query', { queryType });
    }
});

app.get('/api/rooms/:roomId/dice-rolls', async (req, res) => {
    const { roomId } = req.params;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;

    if (!roomId) {
        return sendErrorResponse(res, 400, 'Room id is required');
    }

    try {
        const diceRolls = await listRoomDiceRolls({ roomId, limit, since });
        res.json({ success: true, data: { roomId, diceRolls } });
    } catch (error) {
        respondWithServiceError(res, error, 'room.dice_rolls.list', { roomId, limit, since });
    }
});

// Keep Sentry's Express request isolation and normalized request metadata, while
// the application-owned handler below remains the single error capture point.
Sentry.setupExpressErrorHandler(app, { shouldHandleError: () => false });

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    return handleServerError(req, res, error, 'http.unhandled');
});

const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 8888);
const host = process.env.HOST ?? '0.0.0.0';
const httpServer = createServer(app);
roomRealtimeHub.attach(httpServer);

async function startServer() {
    try {
        await ensureDatabaseSetup();
        httpServer.listen(port, host, () => {
            const displayHost = host === '0.0.0.0' ? 'localhost' : host;
            logger.success(`API server listening on http://${displayHost}:${port}`);
        });
        const sessionExpiryTimer = setInterval(async () => {
            try {
                const sessions = await expireInactiveSessions();
                for (const session of sessions) {
                    publishRoomEvent(session.roomId, { type: 'session.closed', session });
                }
            } catch (error) {
                logger.warn('Failed to expire inactive room sessions', {
                    error: error instanceof Error ? error.message : 'UnknownError'
                });
            }
        }, 30_000);
        sessionExpiryTimer.unref();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error during startup';
        const meta = error instanceof Error ? { stack: error.stack } : undefined;
        const sentryEventId = Sentry.captureException(error, {
            tags: { operation: 'server.startup' },
            contexts: {
                runtime: {
                    environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV,
                    release: process.env.SENTRY_RELEASE
                }
            }
        });
        logger.error(`Failed to start server: ${message}`, { ...meta, sentryEventId });
        await Sentry.flush(2_000);
        process.exit(1);
    }
}

void startServer();

export { app };
