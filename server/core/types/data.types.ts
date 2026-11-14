import type { ArticleTranslations } from '../articles/document';
import type { AppLocale } from './locale.types';
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

export type ArticleStatus = 'draft' | 'unpublished' | 'published';

export const ARTICLE_SORTS = ['newest', 'oldest', 'title-asc', 'title-desc'] as const;
export type ArticleSort = typeof ARTICLE_SORTS[number];
export function isArticleSort(value: unknown): value is ArticleSort {
    return ARTICLE_SORTS.includes(value as ArticleSort);
}
export interface ArticleCategory {
    urlSegment?: string;
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    position: number;
    createdAt?: string;
    updatedAt?: string;
    articleCount?: number;
    draftCount?: number;
}

export interface ArticleTag {
    id: string;
    name: string;
    slug: string;
    createdBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface ArticleSummary {
    requestedLocale?: AppLocale;
    resolvedLocale?: AppLocale;
    availableLocales?: AppLocale[];
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
    categories: ArticleCategory[];
}

export interface ArticleDetails extends ArticleSummary {
    translations?: ArticleTranslations;
    markdownSource?: string;
    sanitizedHtml: string;
}

export interface ArticleDraft {
    translations?: ArticleTranslations;
    id: string;
    uid: string;
    ownerId: string;
    title?: string | null;
    introduction?: string | null;
    markdownSource: string;
    selectedTagIds: string[];
    selectedCategoryIds: string[];
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

export interface RoomBonusPointTrigger {
    id: string;
    roomId: string;
    name: string;
    groups: Array<Array<{ diceNotation: string; operator: 'lessThan' | 'moreThan'; threshold: number }>>;
    legacyRule?: RoomBonusPointRule;
}
export interface RoomBonusNotification { text: string; severity?: 'info' | 'success' | 'warning' | 'error'; timeout?: number }
export type RoomBonusPointAction = { type: 'adjust'; sign: '+' | '-'; amount: number } | { type: 'message'; text: string } | ({ type: 'notification' } & RoomBonusNotification);
export interface RoomBonusPointEffect {
    id: string;
    roomId: string;
    name: string;
    diceNotation: string;
    actions: RoomBonusPointAction[];
    legacy?: boolean;
}
export interface RoomBonusPointConfiguration {
    version?: 2;
    triggers?: RoomBonusPointTrigger[];
    effects?: RoomBonusPointEffect[];
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
    canArchive?: boolean;
}

export interface RoomDetails extends RoomSummary {
    createdBy?: string | null;
    createdAt?: string;
    bagEnabled?: boolean;
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
    bonusPoints: RoomBonusPointSettings & RoomBonusPointConfiguration & { rules: RoomBonusPointRule[] };
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

export interface RoomSessionAwardAssignment {
    id: string;
    sessionId: string;
    sourceSessionId: string;
    userId: string;
    award: RoomRollAward;
    usedAt: string | null;
    usageMessageId: string | null;
}

export interface RoomSessionStartRequest {
    id: string;
    roomId: string;
    previousSessionId: string | null;
    status: 'pending' | 'cancelled' | 'started';
    sessionId: string | null;
}

export interface RoomSessionStartPreparation {
    closedSession?: RoomSession;
    session: RoomSession | null;
    previousSessionId: string | null;
    candidates: Array<{ award: RoomRollAward; users: RoomSessionAwardUserResult[] }>;
    request: RoomSessionStartRequest | null;
}

export interface StartRoomSessionPayload {
    roomId: string;
    userId: string;
    requestId?: string;
    previousSessionId?: string | null;
    selections?: Array<{ awardId: string; userId: string }>;
    reason?: RoomSessionStartReason;
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
    ownedAwards?: RoomSessionAwardAssignment[];
}

export type RoomSessionListItem = Pick<RoomSession, 'id' | 'roomId' | 'startedAt' | 'endedAt' | 'closeReason'> & {
    durationSeconds: number;
};

export interface RoomMemberDetails {
    role?: import('../utils/room-permissions').RoomRole;
    permissionOverrides?: import('../utils/room-permissions').RoomPermissionOverrides;
    effectivePermissions?: import('../utils/room-permissions').RoomRights;
    userId: string;
    username?: string;
    nickname?: string;
    avatar?: string;
    joinedAt?: string;
    lastSeen?: string;
    isOnline?: boolean;
}

export type RoomMessageType = 'text' | 'dice' | 'roll_award_usage' | 'item_share' | 'bonus_effect';

export interface RoomMessage {
    bonusEffect?: { sourceRollId: string; effectIds: string[] } | null;
    bonusPointEffectsUsed?: string[];
    itemSnapshot?: import('./bag.types').BagItem;
    id: string;
    roomId: string;
    userId: string | null;
    username?: string;
    nickname?: string;
    avatar?: string;
    content?: string | null;
    type: RoomMessageType;
    rollAwardUsage?: { assignmentId: string; award: RoomRollAward } | null;
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

export type RoomRealtimeDetails = Omit<RoomDetails, 'isCreator' | 'canArchive'>;

export interface RoomBonusPointSnapshot extends RoomBonusPointConfiguration {
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
    | (RoomRealtimeEventBase & { type: 'bag.snapshot'; snapshot: import('./bag.types').BagSnapshot; requestId?: string })
    | (RoomRealtimeEventBase & { type: 'bag.error'; scope: import('./bag.types').BagScope; message: string; requestId?: string; code?: string })
    | (RoomRealtimeEventBase & { type: 'bag.presence'; scope: import('./bag.types').BagScope; presence: import('./bag.types').BagPresence[] })
    | (RoomRealtimeEventBase & { type: 'session.start_requested'; request: RoomSessionStartRequest })
    | (RoomRealtimeEventBase & { type: 'session.start_cancelled'; request: RoomSessionStartRequest })
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
