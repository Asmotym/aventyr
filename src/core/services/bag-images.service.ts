import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { getApiUrl } from 'modules/discord-auth/utils/urls.utils';
import type { BagScope } from 'netlify/core/types/bag.types';
export async function bagImageRequest(roomId: string, imageId?: string, file?: File, scope?: BagScope): Promise<Response> {
  const auth = await DiscordService.getInstance().getValidAuth();
  const response = await fetch(getApiUrl(`/rooms/${encodeURIComponent(roomId)}/bag/images${imageId ? '/' + encodeURIComponent(imageId) : '?scope=' + scope}`), {
    method: file ? 'POST' : 'GET', headers: { ...(auth ? { Authorization: `${auth.tokenType} ${auth.accessToken}` } : {}), ...(file ? { 'Content-Type': file.type } : {}) }, body: file,
  });
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Image unavailable'); }
  return response;
}
