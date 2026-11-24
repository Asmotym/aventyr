import type { BagAction, BagSnapshot } from '../../../shared/rooms/bag.types';
import type { RoomRole } from '../../../shared/rooms/room-permissions';
import type { RoomBonusNotification, RoomBonusPointBalance, RoomBonusPointEffect, RoomBonusPointRule, RoomBonusPointSettings, RoomBonusPointSnapshot, RoomBonusPointTrigger, RoomCriticalRule, RoomDetails, RoomDice, RoomDiceCategory, RoomMemberDetails, RoomMessage, RoomRollAward, RoomSession, RoomSessionListItem, RoomSessionStartPreparation, RoomSessionStartRequest, StartRoomSessionPayload } from '../../../shared/rooms/rooms.types';
import type { TalentAction, TalentResult } from '../../../shared/rooms/talents.types';
export type RoomsAction = TalentAction | BagAction | {
    action: 'updateMemberRole' | 'updateMemberRights' | 'transferRoomOwnership';
    payload: {
        roomId: string;
        userId: string;
        targetUserId: string;
        role?: RoomRole;
        rights?: unknown;
    };
} | {
    action: 'list';
} | {
    action: 'create';
    payload: {
        name: string;
        password?: string | null;
        userId: string;
    };
} | {
    action: 'join';
    payload: {
        inviteCode: string;
        password?: string | null;
        userId: string;
    };
} | {
    action: 'setRoomFavorite';
    payload: {
        roomId: string;
        userId: string;
        favorite: boolean;
    };
} | {
    action: 'userRooms';
    payload: {
        userId: string;
    };
} | {
    action: 'messages';
    payload: {
        roomId: string;
        userId?: string;
        limit?: number;
        since?: string;
        before?: string;
    };
} | {
    action: 'members';
    payload: {
        roomId: string;
    };
} | {
    action: 'member';
    payload: {
        roomId: string;
        userId: string;
    };
} | {
    action: 'updateRoom';
    payload: {
        roomId: string;
        userId: string;
        name: string;
        sessionInactivityMinutes?: number;
    };
} | {
    action: 'sessionState';
    payload: {
        roomId: string;
    };
} | {
    action: 'startSession';
    payload: StartRoomSessionPayload;
} | {
    action: 'prepareSessionStart' | 'requestSessionStart';
    payload: {
        roomId: string;
        userId: string;
    };
} | {
    action: 'cancelSessionStart';
    payload: {
        roomId: string;
        userId: string;
        requestId: string;
    };
} | {
    action: 'useRollAward';
    payload: {
        roomId: string;
        userId: string;
        sessionId: string;
        assignmentId: string;
    };
} | {
    action: 'closeSession';
    payload: {
        roomId: string;
        userId: string;
    };
} | {
    action: 'sessions';
    payload: {
        roomId: string;
        before?: string;
        date?: string;
        limit?: number;
    };
} | {
    action: 'sessionRecap';
    payload: {
        roomId: string;
        sessionId: string;
    };
} | {
    action: 'updateCriticals';
    payload: {
        roomId: string;
        userId: string;
        criticals: RoomCriticalRule[];
    };
} | {
    action: 'mutateBonusConfiguration';
    payload: {
        roomId: string;
        userId: string;
        kind: 'trigger' | 'condition' | 'effect';
        operation: 'save' | 'delete' | 'reorder';
        entry?: RoomBonusPointTrigger | RoomBonusPointEffect;
        id?: string;
        ids?: string[];
    };
} | {
    action: 'bonusPoints';
    payload: {
        roomId: string;
    };
} | {
    action: 'updateBonusPointSettings';
    payload: {
        roomId: string;
        userId: string;
        enabled?: boolean;
        maxPointsPerUser?: number;
        allowExtremeSpend?: boolean;
    };
} | {
    action: 'createBonusPointRule';
    payload: {
        roomId: string;
        userId: string;
        name: string;
        diceNotation: string;
        condition: RoomBonusPointRule['condition'];
        spendAdjustment: RoomBonusPointRule['spendAdjustment'];
    };
} | {
    action: 'updateBonusPointRule';
    payload: {
        roomId: string;
        userId: string;
        ruleId: string;
        name: string;
        diceNotation: string;
        condition: RoomBonusPointRule['condition'];
        spendAdjustment: RoomBonusPointRule['spendAdjustment'];
    };
} | {
    action: 'deleteBonusPointRule';
    payload: {
        roomId: string;
        userId: string;
        ruleId: string;
    };
} | {
    action: 'useBonusPointOnRoll';
    payload: {
        roomId: string;
        userId: string;
        messageId: string;
    };
} | {
    action: 'updateBonusPointBalance';
    payload: {
        roomId: string;
        userId: string;
        targetUserId: string;
        points: number;
    };
} | {
    action: 'updateNickname';
    payload: {
        roomId: string;
        userId: string;
        nickname?: string | null;
    };
} | {
    action: 'leaveRoom';
    payload: {
        roomId: string;
        userId: string;
    };
} | {
    action: 'archiveRoom';
    payload: {
        roomId: string;
        userId: string;
    };
} | {
    action: 'unarchiveRoom';
    payload: {
        roomId: string;
        userId: string;
    };
} | {
    action: 'message';
    payload: {
        roomId: string;
        userId: string;
        content?: string;
        type: 'text' | 'dice';
        dice?: {
            notation: string;
            total: number;
            rolls: number[];
        };
        skipBonusPointRules?: boolean;
    };
} | {
    action: 'roomDices';
    payload: {
        roomId: string;
        userId: string;
    };
} | {
    action: 'createDice';
    payload: {
        roomId: string;
        userId: string;
        notation: string;
        description?: string | null;
        categoryId?: string | null;
    };
} | {
    action: 'updateDice';
    payload: {
        roomId: string;
        userId: string;
        diceId: string;
        notation: string;
        description?: string | null;
        categoryId?: string | null;
    };
} | {
    action: 'deleteDice';
    payload: {
        roomId: string;
        userId: string;
        diceId: string;
    };
} | {
    action: 'updateDiceCategory';
    payload: {
        roomId: string;
        userId: string;
        categoryId: string;
        name: string;
    };
} | {
    action: 'createDiceCategory';
    payload: {
        roomId: string;
        userId: string;
        name: string;
    };
} | {
    action: 'rollAwards';
    payload: {
        roomId: string;
    };
} | {
    action: 'setRollAwardsEnabled';
    payload: {
        roomId: string;
        userId: string;
        enabled: boolean;
        allowNonLeaders?: boolean;
    };
} | {
    action: 'createRollAward';
    payload: {
        roomId: string;
        userId: string;
        name: string;
        description?: string | null;
        diceResults: number[];
        diceNotation?: string | null;
        diceNotations?: string[];
    };
} | {
    action: 'updateRollAward';
    payload: {
        roomId: string;
        userId: string;
        awardId: string;
        name: string;
        description?: string | null;
        diceResults: number[];
        diceNotation?: string | null;
        diceNotations?: string[];
    };
} | {
    action: 'deleteRollAward';
    payload: {
        roomId: string;
        userId: string;
        awardId: string;
    };
};
export type RoomsActionResponse = TalentResult | {
    bag: BagSnapshot;
    affectedUsers?: string[];
    selectedId?: string;
    giftReceived?: import('../../../shared/rooms/bag.types').BagGiftNotification;
} | {
    preparation: RoomSessionStartPreparation;
} | {
    startRequest: RoomSessionStartRequest;
} | {
    rooms: RoomDetails[];
} | {
    room: RoomDetails;
    closedSession?: RoomSession;
} | {
    roomId: string;
    messages: RoomMessage[];
} | {
    roomId: string;
    members: RoomMemberDetails[];
} | {
    member: RoomMemberDetails;
} | {
    message: RoomMessage;
    effectMessages?: RoomMessage[];
    notifications?: Array<string | RoomBonusNotification>;
    session?: RoomSession;
    sessionStarted?: boolean;
    closedSession?: RoomSession;
} | {
    session: RoomSession | null;
} | {
    sessions: RoomSessionListItem[];
    nextCursor: string | null;
} | RoomBonusPointSnapshot | {
    bonusPointSettings: RoomBonusPointSettings;
} | {
    bonusPointRule: RoomBonusPointRule;
} | {
    bonusPointRuleId: string;
} | {
    bonusPointBalance: RoomBonusPointBalance;
} | {
    roomId: string;
    dices: RoomDice[];
    categories: RoomDiceCategory[];
} | {
    dice: RoomDice;
} | {
    diceId: string;
} | {
    roomId: string;
} | {
    category: RoomDiceCategory;
} | {
    roomId: string;
    rollAwards: RoomRollAward[];
    enabled: boolean;
    allowNonLeaders?: boolean;
} | {
    rollAwardsEnabled: {
        roomId: string;
        enabled: boolean;
        allowNonLeaders?: boolean;
    };
} | {
    rollAward: RoomRollAward;
} | {
    rollAwardId: string;
};
