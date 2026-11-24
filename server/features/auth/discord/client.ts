import type { DiscordAuth, DiscordUser } from '../../../../shared/accounts/discord.types';
import { ForbiddenError } from '../../../infrastructure/http/errors';
import { createLogger } from "../../../infrastructure/logging/logger";
import { addSafeBreadcrumb } from '../../../infrastructure/observability/server-observability';
const logger = createLogger('DiscordClient');
export class DiscordClient {
    protected baseUrl: string = "https://discord.com/api/v10";
    public async getUserInfo(auth: DiscordAuth): Promise<DiscordUser> {
        logger.info('Fetching user info from Discord API');
        addSafeBreadcrumb('http.client', 'Discord user request started', {
            provider: 'discord',
            endpoint: '/users/@me'
        });
        const userResponse = await fetch(`${this.baseUrl}/users/@me`, {
            headers: {
                Authorization: `${auth.tokenType} ${auth.accessToken}`,
            },
        });
        if (!userResponse.ok) {
            logger.error(`Discord API request failed: ${logger.errorValue(userResponse.status.toString())}`);
            addSafeBreadcrumb('http.client', 'Discord user request failed', {
                provider: 'discord',
                status: userResponse.status
            });
            if (userResponse.status === 401 || userResponse.status === 403) {
                throw new ForbiddenError('Discord authentication failed');
            }
            throw new Error('Failed to get user info');
        }
        const json = await userResponse.json() as DiscordUser & {
            global_name?: string | null;
        };
        const username = json.global_name || json.username || '???';
        const user: DiscordUser = {
            id: json.id,
            username,
            avatar: `https://cdn.discordapp.com/avatars/${json.id}/${json.avatar}.png?size=512`,
        };
        logger.success(`Successfully retrieved Discord user ${logger.highlight(user.id)}`);
        return user;
    }
}
