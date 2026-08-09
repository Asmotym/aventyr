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
    count: number;
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

export type ArticleStatus = 'draft' | 'unpublished' | 'published';

export interface ArticleTag {
    id: string;
    name: string;
    slug: string;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface ArticleSummary {
    id: string;
    uid: string;
    slug: string;
    title: string;
    introduction: string;
    excerpt: string;
    status: ArticleStatus;
    authorId?: string | null;
    authorName?: string | null;
    publishedAt?: string | null;
    archivedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    tags: ArticleTag[];
}

export interface ArticleDetails extends ArticleSummary {
    markdownSource?: string;
    sanitizedHtml: string;
}

export interface ArticleDraft {
    id: string;
    uid: string;
    ownerId: string;
    title?: string | null;
    introduction?: string | null;
    markdownSource: string;
    selectedTagIds: string[];
    createdAt?: string;
    updatedAt?: string;
}

export type RoomCriticalRuleOperator = 'moreThan' | 'lessThan';

export interface RoomCriticalRule {
    threshold: number;
    operator: RoomCriticalRuleOperator;
    color: string;
}

export type RoomBonusPointConditionOperator = 'moreThan' | 'lessThan' | 'between';
export type RoomBonusPointAdjustmentSign = '+' | '-';

export interface RoomBonusPointCondition {
    operator: RoomBonusPointConditionOperator;
    threshold: number;
    thresholdMax?: number | null;
}

export interface RoomBonusPointSpendAdjustment {
    sign: RoomBonusPointAdjustmentSign;
    amount: number;
}

export interface RoomBonusPointSettings {
    roomId: string;
    enabled: boolean;
    maxPointsPerUser: number;
    allowExtremeSpend: boolean;
}

export interface RoomBonusPointRule {
    id: string;
    roomId: string;
    name: string;
    diceNotation: string;
    condition: RoomBonusPointCondition;
    spendAdjustment: RoomBonusPointSpendAdjustment;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoomBonusPointBalance {
    roomId: string;
    userId: string;
    points: number;
    username?: string;
    nickname?: string;
    avatar?: string;
}

export interface RoomSummary {
    id: string;
    name: string;
    inviteCode: string;
    isProtected: boolean;
    memberCount: number;
    lastActivity?: string | null;
    archivedAt?: string | null;
    isArchived?: boolean;
    isCreator?: boolean;
}

export interface RoomDetails extends RoomSummary {
    createdBy?: string | null;
    createdAt?: string;
    rollAwardsEnabled?: boolean;
    criticals?: RoomCriticalRule[];
    bonusPointSettings?: RoomBonusPointSettings;
    sessionInactivityMinutes?: number;
}

export type RoomSessionStartReason = 'manual' | 'activity';
export type RoomSessionCloseReason = 'manual' | 'inactivity' | 'room_archived';

export interface RoomSessionConfiguration {
    rollAwards: { enabled: boolean; awards: RoomRollAward[] };
    criticals: RoomCriticalRule[];
    bonusPoints: RoomBonusPointSettings & { rules: RoomBonusPointRule[] };
}

export interface RoomSessionAwardUserResult {
    userId: string;
    displayName: string;
    count: number;
}

export interface RoomSessionAwardResult {
    award: RoomRollAward;
    users: RoomSessionAwardUserResult[];
    leaders: RoomSessionAwardUserResult[];
    maxHits: number;
}

export interface RoomSessionCriticalResult {
    rule: RoomCriticalRule;
    matchCount: number;
}

export interface RoomSessionBonusUserResult {
    userId: string;
    displayName: string;
    awarded: number;
    used: number;
}

export interface RoomSessionRecap {
    messageCount: number;
    rollCount: number;
    durationSeconds: number;
    rollAwards: RoomSessionAwardResult[];
    criticals: RoomSessionCriticalResult[];
    bonusPoints: {
        awarded: number;
        used: number;
        users: RoomSessionBonusUserResult[];
    };
}

export interface RoomSession {
    id: string;
    roomId: string;
    startedAt: string;
    lastActivityAt: string;
    endedAt?: string | null;
    startReason: RoomSessionStartReason;
    closeReason?: RoomSessionCloseReason | null;
    configuration: RoomSessionConfiguration;
    recap: RoomSessionRecap;
}

export type RoomSessionListItem = Pick<RoomSession, 'id' | 'roomId' | 'startedAt' | 'endedAt' | 'closeReason'> & {
    durationSeconds: number;
};

export interface RoomMemberDetails {
    userId: string;
    username?: string;
    nickname?: string;
    avatar?: string;
    joinedAt?: string;
    lastSeen?: string;
    isOnline?: boolean;
}

export type RoomMessageType = 'text' | 'dice';

export interface RoomMessage {
    id: string;
    roomId: string;
    userId: string | null;
    username?: string;
    nickname?: string;
    avatar?: string;
    content?: string | null;
    type: RoomMessageType;
    diceNotation?: string | null;
    diceTotal?: number | null;
    diceRolls?: number[] | null;
    pointUsed?: boolean;
    diceBaseTotal?: number | null;
    bonusPointAdjustment?: number | null;
    bonusPointsUsed?: number;
    bonusPointRuleUsed?: { id: string; name: string } | null;
    bonusPointRulesSkipped?: boolean;
    createdAt: string;
    sessionId?: string | null;
}

export interface RoomDice {
    id: string;
    roomId: string;
    notation: string;
    description?: string | null;
    categoryId?: string;
    categoryName?: string;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoomDiceCategory {
    id: string;
    roomId: string;
    name: string;
    sortOrder?: number;
    isDefault?: boolean;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface RoomRollAward {
    id: string;
    roomId: string;
    name: string;
    description?: string | null;
    diceResults: number[];
    diceNotations?: string[];
    diceNotation?: string | null;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export type RoomRealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type RoomRealtimeDetails = Omit<RoomDetails, 'isCreator'>;

export interface RoomBonusPointSnapshot {
    roomId: string;
    settings: RoomBonusPointSettings;
    rules: RoomBonusPointRule[];
    balances: RoomBonusPointBalance[];
}

export interface RoomRollAwardsSnapshot {
    roomId: string;
    awards: RoomRollAward[];
    enabled: boolean;
}

interface RoomRealtimeEventBase {
    eventId: string;
    roomId: string;
    occurredAt: string;
}

export type RoomRealtimeEvent =
    | (RoomRealtimeEventBase & { type: 'connection.ready' })
    | (RoomRealtimeEventBase & { type: 'message.created'; message: RoomMessage })
    | (RoomRealtimeEventBase & { type: 'message.updated'; message: RoomMessage })
    | (RoomRealtimeEventBase & { type: 'room.updated'; room: RoomRealtimeDetails })
    | (RoomRealtimeEventBase & { type: 'room.archived'; archivedAt: string })
    | (RoomRealtimeEventBase & { type: 'member.updated'; member: RoomMemberDetails })
    | (RoomRealtimeEventBase & { type: 'member.removed'; userId: string; memberCount: number })
    | (RoomRealtimeEventBase & {
        type: 'presence.updated';
        userId: string;
        isOnline: boolean;
        lastSeen: string;
    })
    | (RoomRealtimeEventBase & { type: 'bonus_points.updated'; snapshot: RoomBonusPointSnapshot })
    | (RoomRealtimeEventBase & { type: 'roll_awards.updated'; snapshot: RoomRollAwardsSnapshot })
    | (RoomRealtimeEventBase & { type: 'session.started'; session: RoomSession })
    | (RoomRealtimeEventBase & { type: 'session.updated'; session: RoomSession })
    | (RoomRealtimeEventBase & { type: 'session.closed'; session: RoomSession });

export interface RoomRealtimeAuthenticateMessage {
    type: 'authenticate';
    tokenType: string;
    accessToken: string;
}
