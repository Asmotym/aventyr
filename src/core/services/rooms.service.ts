import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';
import type { RoomBonusPointBalance, RoomBonusPointRule, RoomBonusPointSettings, RoomCriticalRule, RoomDetails, RoomMemberDetails, RoomMessage, RoomDice, RoomDiceCategory, RoomRollAward, RoomSession, RoomSessionListItem } from 'netlify/core/types/data.types';
import i18n from 'modules/language-switcher/plugins/i18n.plugin';

const ROOMS_ENDPOINT = getApiUrl('/rooms');
const t = i18n.global.t;

type RequestPayload = Record<string, unknown>;

interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

function parseJson<T>(value: string): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

async function request<T>(body: RequestPayload): Promise<T> {
    const response = await fetch(ROOMS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const text = await response.text();
    const payload = parseJson<ApiResponse<T>>(text);

    if (!response.ok) {
        const fallbackMessage = payload?.error ?? (text.trim() || `Request failed with status ${response.status}`);
        throw new Error(fallbackMessage);
    }

    if (!payload) {
        throw new Error(t('errors.invalidServerResponse'));
    }

    if (!payload.success) {
        throw new Error(payload.error || t('errors.unknown'));
    }

    return payload.data;
}

export class RoomsService {
    static async fetchRooms(): Promise<RoomDetails[]> {
        const data = await request<{ rooms: RoomDetails[] }>({ action: 'list' });
        return data.rooms;
    }

    static async createRoom(payload: { name: string; password?: string | null; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'create',
            payload
        });
        return data.room;
    }

    static async joinRoom(payload: { inviteCode: string; password?: string | null; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'join',
            payload
        });
        return data.room;
    }

    static async fetchUserRooms(userId: string): Promise<RoomDetails[]> {
        const data = await request<{ rooms: RoomDetails[] }>({
            action: 'userRooms',
            payload: { userId }
        });
        return data.rooms;
    }

    static async fetchMessages(
        roomId: string,
        options?: { limit?: number; since?: string; before?: string; userId?: string }
    ): Promise<RoomMessage[]> {
        const data = await request<{ messages: RoomMessage[] }>({
            action: 'messages',
            payload: {
                roomId,
                limit: options?.limit,
                since: options?.since,
                before: options?.before,
                userId: options?.userId
            }
        });
        return data.messages;
    }

    static async fetchMembers(roomId: string): Promise<RoomMemberDetails[]> {
        const data = await request<{ members: RoomMemberDetails[] }>({
            action: 'members',
            payload: { roomId }
        });
        return data.members;
    }

    static async fetchMember(payload: { roomId: string; userId: string }): Promise<RoomMemberDetails> {
        const data = await request<{ member: RoomMemberDetails }>({
            action: 'member',
            payload
        });
        return data.member;
    }

    static async updateRoom(payload: { roomId: string; userId: string; name: string; sessionInactivityMinutes?: number }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'updateRoom',
            payload
        });
        return data.room;
    }

    static async fetchSessionState(roomId: string): Promise<RoomSession | null> {
        const data = await request<{ session: RoomSession | null }>({ action: 'sessionState', payload: { roomId } });
        return data.session;
    }

    static async startSession(payload: { roomId: string; userId: string }): Promise<RoomSession> {
        const data = await request<{ session: RoomSession }>({ action: 'startSession', payload });
        return data.session;
    }

    static async closeSession(payload: { roomId: string; userId: string }): Promise<RoomSession> {
        const data = await request<{ session: RoomSession }>({ action: 'closeSession', payload });
        return data.session;
    }

    static async fetchSessions(roomId: string, options?: { before?: string; date?: string; limit?: number }): Promise<{ sessions: RoomSessionListItem[]; nextCursor: string | null }> {
        return request<{ sessions: RoomSessionListItem[]; nextCursor: string | null }>({
            action: 'sessions', payload: { roomId, ...options }
        });
    }

    static async fetchSessionRecap(roomId: string, sessionId: string): Promise<RoomSession> {
        const data = await request<{ session: RoomSession }>({ action: 'sessionRecap', payload: { roomId, sessionId } });
        return data.session;
    }

    static async updateRoomCriticals(payload: { roomId: string; userId: string; criticals: RoomCriticalRule[] }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'updateCriticals',
            payload
        });
        return data.room;
    }

    static async fetchBonusPoints(roomId: string): Promise<{ settings: RoomBonusPointSettings; rules: RoomBonusPointRule[]; balances: RoomBonusPointBalance[] }> {
        const data = await request<{ roomId: string; settings: RoomBonusPointSettings; rules: RoomBonusPointRule[]; balances: RoomBonusPointBalance[] }>({
            action: 'bonusPoints',
            payload: { roomId }
        });
        return { settings: data.settings, rules: data.rules, balances: data.balances };
    }

    static async updateBonusPointSettings(payload: { roomId: string; userId: string; enabled?: boolean; maxPointsPerUser?: number; allowExtremeSpend?: boolean }): Promise<RoomBonusPointSettings> {
        const data = await request<{ bonusPointSettings: RoomBonusPointSettings }>({
            action: 'updateBonusPointSettings',
            payload
        });
        return data.bonusPointSettings;
    }

    static async createBonusPointRule(payload: { roomId: string; userId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] }): Promise<RoomBonusPointRule> {
        const data = await request<{ bonusPointRule: RoomBonusPointRule }>({
            action: 'createBonusPointRule',
            payload
        });
        return data.bonusPointRule;
    }

    static async updateBonusPointRule(payload: { roomId: string; userId: string; ruleId: string; name: string; diceNotation: string; condition: RoomBonusPointRule['condition']; spendAdjustment: RoomBonusPointRule['spendAdjustment'] }): Promise<RoomBonusPointRule> {
        const data = await request<{ bonusPointRule: RoomBonusPointRule }>({
            action: 'updateBonusPointRule',
            payload
        });
        return data.bonusPointRule;
    }

    static async deleteBonusPointRule(payload: { roomId: string; userId: string; ruleId: string }): Promise<string> {
        const data = await request<{ bonusPointRuleId: string }>({
            action: 'deleteBonusPointRule',
            payload
        });
        return data.bonusPointRuleId;
    }

    static async useBonusPointOnRoll(payload: { roomId: string; userId: string; messageId: string }): Promise<RoomMessage> {
        const data = await request<{ message: RoomMessage }>({
            action: 'useBonusPointOnRoll',
            payload
        });
        return data.message;
    }

    static async updateBonusPointBalance(payload: { roomId: string; userId: string; targetUserId: string; points: number }): Promise<RoomBonusPointBalance> {
        const data = await request<{ bonusPointBalance: RoomBonusPointBalance }>({
            action: 'updateBonusPointBalance',
            payload
        });
        return data.bonusPointBalance;
    }

    static async updateNickname(payload: { roomId: string; userId: string; nickname?: string | null }): Promise<RoomMemberDetails> {
        const data = await request<{ member: RoomMemberDetails }>({
            action: 'updateNickname',
            payload
        });
        return data.member;
    }

    static async leaveRoom(payload: { roomId: string; userId: string }): Promise<void> {
        await request<{ roomId: string }>({
            action: 'leaveRoom',
            payload
        });
    }

    static async archiveRoom(payload: { roomId: string; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'archiveRoom',
            payload
        });
        return data.room;
    }

    static async unarchiveRoom(payload: { roomId: string; userId: string }): Promise<RoomDetails> {
        const data = await request<{ room: RoomDetails }>({
            action: 'unarchiveRoom',
            payload
        });
        return data.room;
    }

    static async sendMessage(payload: { roomId: string; userId: string; content?: string; type: 'text' | 'dice'; dice?: { notation: string; total: number; rolls: number[] }; skipBonusPointRules?: boolean }): Promise<RoomMessage> {
        const data = await request<{ message: RoomMessage }>({
            action: 'message',
            payload
        });
        return data.message;
    }

    static async fetchRoomDices(roomId: string, userId: string): Promise<{ dices: RoomDice[]; categories: RoomDiceCategory[] }> {
        const data = await request<{ roomId: string; dices: RoomDice[]; categories: RoomDiceCategory[] }>({
            action: 'roomDices',
            payload: { roomId, userId }
        });
        return { dices: data.dices, categories: data.categories };
    }

    static async createRoomDice(payload: { roomId: string; userId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
        const data = await request<{ dice: RoomDice }>({
            action: 'createDice',
            payload
        });
        return data.dice;
    }

    static async updateRoomDice(payload: { roomId: string; userId: string; diceId: string; notation: string; description?: string | null; categoryId?: string | null }): Promise<RoomDice> {
        const data = await request<{ dice: RoomDice }>({
            action: 'updateDice',
            payload
        });
        return data.dice;
    }

    static async deleteRoomDice(payload: { roomId: string; userId: string; diceId: string }): Promise<void> {
        await request<{ diceId: string }>({
            action: 'deleteDice',
            payload
        });
    }

    static async createDiceCategory(payload: { roomId: string; userId: string; name: string }): Promise<RoomDiceCategory> {
        const data = await request<{ category: RoomDiceCategory }>({
            action: 'createDiceCategory',
            payload
        });
        return data.category;
    }

    static async fetchRollAwards(roomId: string): Promise<{ awards: RoomRollAward[]; enabled: boolean }> {
        const data = await request<{ roomId: string; rollAwards: RoomRollAward[]; enabled: boolean }>({
            action: 'rollAwards',
            payload: { roomId }
        });
        return { awards: data.rollAwards, enabled: data.enabled };
    }

    static async updateRollAwardsSettings(payload: { roomId: string; userId: string; enabled: boolean }): Promise<{ roomId: string; enabled: boolean }> {
        const data = await request<{ rollAwardsEnabled: { roomId: string; enabled: boolean } }>({
            action: 'setRollAwardsEnabled',
            payload
        });
        return data.rollAwardsEnabled;
    }

    static async createRollAward(payload: { roomId: string; userId: string; name: string; description?: string | null; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] }): Promise<RoomRollAward> {
        const data = await request<{ rollAward: RoomRollAward }>({
            action: 'createRollAward',
            payload
        });
        return data.rollAward;
    }

    static async updateRollAward(payload: { roomId: string; userId: string; awardId: string; name: string; description?: string | null; diceResults: number[]; diceNotation?: string | null; diceNotations?: string[] }): Promise<RoomRollAward> {
        const data = await request<{ rollAward: RoomRollAward }>({
            action: 'updateRollAward',
            payload
        });
        return data.rollAward;
    }

    static async deleteRollAward(payload: { roomId: string; userId: string; awardId: string }): Promise<string> {
        const data = await request<{ rollAwardId: string }>({
            action: 'deleteRollAward',
            payload
        });
        return data.rollAwardId;
    }

    static async fetchDiceRolls(roomId: string, options?: { limit?: number; since?: string }): Promise<RoomMessage[]> {
        const endpoint = new URL(getApiUrl(`/rooms/${roomId}/dice-rolls`));
        if (options?.limit !== undefined) {
            endpoint.searchParams.set('limit', String(options.limit));
        }
        if (options?.since) {
            endpoint.searchParams.set('since', options.since);
        }

        const response = await fetch(endpoint.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            },
            credentials: 'include'
        });

        const text = await response.text();
        const payload = parseJson<ApiResponse<{ roomId: string; diceRolls: RoomMessage[] }>>(text);

        if (!response.ok) {
            const fallbackMessage = payload?.error ?? (text.trim() || `Request failed with status ${response.status}`);
            throw new Error(fallbackMessage);
        }

        if (!payload) {
            throw new Error(t('errors.invalidServerResponse'));
        }

        if (!payload.success) {
            throw new Error(payload.error || t('errors.unknown'));
        }

        return payload.data.diceRolls;
    }
}
