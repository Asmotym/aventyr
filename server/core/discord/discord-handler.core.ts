import type { DiscordAuth } from "../types/discord.types";
import { DiscordClient } from "./client";
import { getUser, insertUser, updateUser } from "../database/tables/users.table";
import { createLogger } from "../utils/logger";
import {
    normalizeTheme,
    normalizeThemeStyle,
    type AppTheme,
    type AppThemeStyle
} from "../types/theme.types";
import type { AppLocale } from "../types/locale.types";
import { BadRequestError } from '../errors/http-errors';
import { publishUserProfileUpdate } from '../../realtime/room-action-events';

const logger = createLogger('DiscordHandler');
const discordClient = new DiscordClient();

export type DiscordQueryType = 'user';

export type DiscordQueryPayload = DiscordAuth & {
    queryType?: DiscordQueryType;
    theme?: AppTheme;
    themeStyle?: AppThemeStyle;
    locale?: AppLocale;
};

export async function handleDiscordQuery(payload: DiscordQueryPayload) {
    const queryType = payload.queryType ?? 'user';
    logger.info(`Processing ${logger.highlight(queryType)} query`);

    switch (queryType) {
        case 'user':
            return handleUserQuery(payload);
        default:
            throw new BadRequestError(`Unknown query type: ${queryType}`);
    }
}

async function handleUserQuery(auth: DiscordAuth) {
    if (!auth.tokenType || !auth.accessToken) {
        throw new BadRequestError('Missing Discord authentication tokens');
    }

    logger.info('Fetching Discord user info');

    const discordUser = await discordClient.getUserInfo(auth);
    logger.success(`Retrieved Discord user ${logger.highlight(discordUser.id)}`);

    const existingUser = await getUser(discordUser.id);
    if (existingUser === undefined) {
        logger.info('User not found in database, creating new user');
        const theme = normalizeTheme((auth as DiscordQueryPayload).theme);
        const themeStyle = normalizeThemeStyle((auth as DiscordQueryPayload).themeStyle);
        const locale = null;
        await insertUser({
            discord_user_id: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
            theme,
            theme_style: themeStyle,
            locale,
        });
        const createdUser = await getUser(discordUser.id);
        return {
            ...discordUser,
            aboutMe: createdUser?.about_me ?? '',
            theme,
            themeStyle,
            locale,
            role: createdUser?.role ?? 'user'
        };
    } else {
        logger.info('User found in database, updating user info');
        const profileChanged = existingUser.username !== discordUser.username
            || existingUser.avatar !== discordUser.avatar;
        await updateUser(discordUser.id, {
            username: discordUser.username,
            avatar: discordUser.avatar,
        });
        if (profileChanged) {
            await publishUserProfileUpdate(discordUser.id);
        }
        return {
            ...discordUser,
            aboutMe: existingUser.about_me ?? '',
            theme: normalizeTheme(existingUser.theme),
            themeStyle: normalizeThemeStyle(existingUser.theme_style),
            locale: existingUser.locale ?? null,
            role: existingUser.role ?? 'user'
        };
    }
}
