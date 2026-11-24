export type UserRole = 'owner' | 'admin' | 'user';
export interface UserSummary {
    id: string;
    username: string;
    avatar: string;
    role: UserRole;
    createdAt?: string;
    updatedAt?: string;
}
export interface UserProfileRollAward {
    id: string;
    name: string;
    description?: string | null;
    count?: number;
    usedAt?: string | null;
}
export interface UserProfileRoomContext {
    roomId: string;
    bonusPoints?: {
        current: number;
        maximum: number;
    };
    rollAwards?: UserProfileRollAward[];
}
export interface PublicUserProfile {
    username: string;
    avatar: string;
    aboutMe: string;
    room?: UserProfileRoomContext;
}
