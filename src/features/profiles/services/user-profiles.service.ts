import { apiRequest, toQuery } from '@/shared/services/api.service';
import type { PublicUserProfile } from 'netlify/core/types/data.types';

const pendingProfileRequests = new Map<string, Promise<PublicUserProfile>>();

export function fetchPublicUserProfile(userId: string, roomId?: string): Promise<PublicUserProfile> {
  const key = `${userId}:${roomId ?? ''}`;
  const pending = pendingProfileRequests.get(key);
  if (pending) return pending;

  const request = apiRequest<PublicUserProfile>(
    `/users/${encodeURIComponent(userId)}/profile${toQuery({ roomId })}`,
  ).finally(() => pendingProfileRequests.delete(key));
  pendingProfileRequests.set(key, request);
  return request;
}

export function saveAboutMe(userId: string, aboutMe: string): Promise<PublicUserProfile> {
  return apiRequest<PublicUserProfile>(`/users/${encodeURIComponent(userId)}/profile`, {
    method: 'PATCH',
    body: JSON.stringify({ aboutMe }),
  });
}
