import { reactive } from 'vue';
import { talentRequest } from './rooms.service';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';
import type { TalentOperation, TalentResult, TalentSnapshot } from 'netlify/core/types/talents.types';

const rooms = new Map<string, ReturnType<typeof createState>>();
function createState(roomId: string, userId: string) {
    const state = reactive({ snapshot: null as TalentSnapshot | null, busy: false, error: '' });
    let sequence = 0;
    async function load() {
        const current = ++sequence;
        try { const result = await talentRequest({ roomId, userId, op: 'read' }); if (sequence === current && (!state.snapshot || result.talents.revision >= state.snapshot.revision)) { state.snapshot = result.talents; state.error = ''; } }
        catch (error) { if (sequence === current) { state.snapshot = null; state.error = error instanceof Error ? error.message : String(error); } }
    }
    async function mutate(operation: TalentOperation, expectedRevision?: number): Promise<TalentResult | undefined> {
        if (state.busy || !state.snapshot) return;
        state.busy = true; state.error = ''; const current = ++sequence;
        try { const result = await talentRequest({ roomId, userId, revision: expectedRevision ?? state.snapshot.revision, ...operation }); if (sequence === current || !state.snapshot || result.talents.revision > state.snapshot.revision) state.snapshot = result.talents; return result; }
        catch (error) { await load(); state.error = error instanceof Error ? error.message : String(error); return; }
        finally { state.busy = false; }
    }
    return { state, load, mutate, roomId, userId };
}
export function talentRoom(roomId: string, userId: string) {
    const key = `${roomId}:${userId}`;
    if (!rooms.has(key)) rooms.set(key, createState(roomId, userId));
    return rooms.get(key)!;
}
export function refreshTalents(roomId: string) { for (const room of rooms.values()) if (room.roomId === roomId) void room.load(); }
export async function talentImageRequest(roomId: string, imageId?: string, file?: File) {
    const auth = await DiscordService.getInstance().getValidAuth();
    const response = await fetch(getApiUrl(`/rooms/${encodeURIComponent(roomId)}/talents/images${imageId ? '/' + encodeURIComponent(imageId) : ''}`), {
        method: file ? 'POST' : 'GET', headers: { ...(auth ? { Authorization: `${auth.tokenType} ${auth.accessToken}` } : {}), ...(file ? { 'Content-Type': file.type } : {}) }, body: file
    });
    if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error ?? `Image request failed (${response.status})`); }
    return response;
}
