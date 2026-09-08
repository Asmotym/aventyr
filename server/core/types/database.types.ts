import type { AppTheme, AppThemeStyle } from './theme.types';
import type { AppLocale } from './locale.types';
import type { ArticleStatus, UserRole } from './data.types';

export interface DatabaseUser {
    discord_user_id?: string;
    username: string;
    avatar: string;
    about_me?: string;
    theme?: AppTheme;
    theme_style?: AppThemeStyle;
    locale?: AppLocale;
    role?: UserRole;
    rights_update?: boolean;
    rights_testing_ground?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface DatabaseUserApiKey {
    user_id: string;
    api_key_hash: string;
    api_key_encrypted: string;
    created_at?: string;
    updated_at?: string;
    last_used_at?: string | null;
}

export interface DatabaseArticle {
    id: string;
    uid: string;
    slug: string;
    title: string;
    introduction: string;
    markdown_source: string;
    sanitized_html: string;
    excerpt: string;
    author_id?: string | null;
    author_name?: string | null;
    status: ArticleStatus;
    published_at?: string | null;
    archived_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface DatabaseArticleTag {
    id: string;
    name: string;
    slug: string;
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface DatabaseArticleDraft {
    id: string;
    uid: string;
    owner_id: string;
    title?: string | null;
    introduction?: string | null;
    markdown_source: string;
    selected_tag_ids?: string | string[] | null;
    created_at?: string;
    updated_at?: string;
}

import type { RoomBonusPointCondition, RoomBonusPointSpendAdjustment, RoomCriticalRule } from './data.types';

export interface DatabaseRoom {
    id: string;
    name: string;
    invite_code: string;
    password_hash?: string | null;
    password_salt?: string | null;
    created_by?: string | null;
    roll_awards_enabled?: number | boolean | null;
    roll_awards_window?: number | null;
    room_criticals?: string | RoomCriticalRule[] | null;
    bonus_points_enabled?: number | boolean | null;
    bonus_points_max?: number | null;
    bonus_points_allow_extreme_spend?: number | boolean | null;
    session_inactivity_minutes?: number | null;
    archived_at?: string | null;
    created_at?: string;
    updated_at?: string;
    member_count?: number;
    last_activity?: string | null;
}

export interface NewRoom {
    id: string;
    name: string;
    invite_code: string;
    password_hash?: string | null;
    password_salt?: string | null;
    created_by?: string | null;
}

export interface DatabaseRoomMember {
    id: string;
    room_id: string;
    user_id: string;
    nickname?: string | null;
    joined_at?: string;
    last_seen?: string;
}

export interface DatabaseRoomMemberWithUser extends DatabaseRoomMember {
    username?: string | null;
    avatar?: string | null;
}

export interface DatabaseRoomMessage {
    id: string;
    room_id: string;
    user_id: string | null;
    content: string | null;
    type: 'text' | 'dice' | 'roll_award_usage';
    roll_award_usage?: string | import('./data.types').RoomMessage['rollAwardUsage'];
    dice_notation?: string | null;
    dice_total?: number | null;
    dice_rolls?: number[] | string | null;
    point_used?: number | boolean | null;
    dice_base_total?: number | null;
    bonus_point_adjustment?: number | null;
    bonus_points_used?: number | null;
    bonus_point_rule_used?: string | { id: string; name: string } | null;
    bonus_point_rules_skipped?: number | boolean | null;
    session_id?: string | null;
    created_at: string;
    username?: string | null;
    avatar?: string | null;
    member_nickname?: string | null;
}

export interface NewRoomMessage {
    id?: string;
    room_id: string;
    user_id: string;
    content?: string | null;
    type: 'text' | 'dice' | 'roll_award_usage';
    roll_award_usage?: string | import('./data.types').RoomMessage['rollAwardUsage'];
    dice_notation?: string | null;
    dice_total?: number | null;
    dice_rolls?: number[];
    point_used?: number | boolean;
    dice_base_total?: number | null;
    bonus_point_adjustment?: number | null;
    bonus_points_used?: number | null;
    bonus_point_rule_used?: string | null;
    bonus_point_rules_skipped?: number | boolean;
    session_id?: string | null;
}

export interface DatabaseRoomSession {
    id: string;
    room_id: string;
    started_by?: string | null;
    start_reason: 'manual' | 'activity';
    close_reason?: 'manual' | 'inactivity' | 'room_archived' | null;
    started_at: string;
    last_activity_at: string;
    ended_at?: string | null;
    configuration_json: string;
    recap_json?: string | null;
}

export interface DatabaseRoomSessionBonusEvent {
    id: string;
    session_id: string;
    room_id: string;
    user_id: string;
    event_type: 'awarded' | 'used';
    amount: number;
    message_id?: string | null;
    created_at: string;
}

export interface DatabaseRoomBonusPointRule {
    id: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    dice_notation: string;
    condition_operator: RoomBonusPointCondition['operator'];
    threshold: number;
    threshold_max?: number | null;
    adjustment_sign: RoomBonusPointSpendAdjustment['sign'];
    adjustment_amount: number;
    created_at?: string;
    updated_at?: string;
}

export interface NewRoomBonusPointRule {
    id?: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    dice_notation: string;
    condition_operator: RoomBonusPointCondition['operator'];
    threshold: number;
    threshold_max?: number | null;
    adjustment_sign: RoomBonusPointSpendAdjustment['sign'];
    adjustment_amount: number;
}

export interface DatabaseRoomBonusPointBalance {
    room_id: string;
    user_id: string;
    points: number;
    updated_at?: string;
    username?: string | null;
    avatar?: string | null;
    nickname?: string | null;
}

export interface DatabaseRoomDice {
    id: string;
    room_id: string;
    created_by?: string | null;
    category_id?: string | null;
    notation: string;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface NewRoomDice {
    id?: string;
    room_id: string;
    created_by?: string | null;
    category_id?: string | null;
    notation: string;
    description?: string | null;
}

export interface DatabaseRoomDiceCategory {
    id: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    sort_order?: number | null;
    is_default?: number | boolean | null;
    created_at?: string;
    updated_at?: string;
}

export interface NewRoomDiceCategory {
    id?: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    sort_order?: number;
    is_default?: number | boolean;
}

export interface DatabaseRoomRollAward {
    id: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    description?: string | null;
    dice_notation?: string | null;
    dice_results?: string | number[] | null;
    created_at?: string;
    updated_at?: string;
}

export interface NewRoomRollAward {
    id?: string;
    room_id: string;
    created_by?: string | null;
    name: string;
    description?: string | null;
    dice_notation?: string | null;
    dice_results: string;
}
