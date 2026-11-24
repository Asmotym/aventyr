export type TalentCurrency = 'global' | 'tree';
export type TalentColor = 'primary' | 'blue' | 'green' | 'red' | 'purple' | 'neutral' | 'orange' | 'amber' | 'yellow' | 'lime' | 'teal' | 'cyan' | 'indigo' | 'pink' | 'rose' | 'brown';
export const TALENT_COLORS: readonly TalentColor[] = ['primary', 'red', 'rose', 'pink', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'brown', 'neutral'];
export type TalentLayout = 'classic' | 'centered' | 'free';
export interface TalentIcon {
    icon: string | null;
    imageId: string | null;
}
export type TalentCondition = {
    type: 'node';
    nodeId: string;
    amount: number;
} | {
    type: 'treePoints';
    amount: number;
} | {
    type: 'subtreePoints';
    subtreeId: string;
    amount: number;
};
export interface TalentConditions {
    mode: 'all' | 'any';
    items: TalentCondition[];
}
export interface TalentSubtree extends TalentIcon {
    id: string;
    name: string;
    description: string;
    maxPoints: number;
    x: number;
    y: number;
    width: number;
    height: number;
    boundsMode?: 'auto' | 'manual';
}
export interface TalentRank {
    id: string;
    name?: string;
    description?: string;
    cost?: number;
    conditions: TalentConditions;
}
export interface TalentNode extends TalentIcon {
    id: string;
    name: string;
    description: string;
    subtreeId: string | null;
    x: number;
    y: number;
    autoUnlock?: boolean;
    color?: TalentColor;
    cost?: number;
    category?: 'passive' | 'active';
    linkedTreeId?: string | null;
    unlocksTree?: boolean;
    parentMode: 'all' | 'any';
    conditions: TalentConditions;
    hide: TalentConditions;
    levels: TalentRank[];
}
export type TalentConnectorSide = 'top' | 'right' | 'bottom' | 'left';
export type TalentConnectionStyle = 'rounded' | 'square' | 'straight';
export type TalentArrowStyle = 'triangle' | 'chevron' | 'diamond' | 'none';
export interface TalentEdge {
    parent: string;
    child: string;
    parentSide?: TalentConnectorSide;
    childSide?: TalentConnectorSide;
    style?: TalentConnectionStyle;
    arrow?: TalentArrowStyle;
}
export interface TalentDecoration {
    id: string;
    shape: 'rectangle' | 'rounded' | 'ellipse' | 'diamond';
    text: string;
    color: TalentColor;
    fontSize: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface TalentTree extends TalentIcon {
    id: string;
    name: string;
    description: string;
    layout: TalentLayout;
    currency: TalentCurrency | 'both';
    archived?: boolean;
    parentTreeId?: string | null;
    accessMode?: 'available' | 'restricted';
    nodes: TalentNode[];
    edges: TalentEdge[];
    subtrees: TalentSubtree[];
    decorations?: TalentDecoration[];
    options: {
        connectionStyle?: TalentConnectionStyle;
        connectionArrow?: TalentArrowStyle;
        iconsOnly: boolean;
        levelPosition: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        allowRevert: boolean;
        allowRespec: boolean;
        selectSubtree: boolean;
        allowSpecializationRespec: boolean;
        refundSpecialization: boolean;
        separators: boolean;
        startingNodes: number;
    };
}
export interface TalentRankPayment {
    tree: number;
    global: number;
    automatic?: boolean;
}
/** Currency strings are accepted only for legacy stored progress. New payments are records. */
export type TalentPayment = TalentCurrency | TalentRankPayment;
export interface TalentProgress {
    selectedSubtree: string | null;
    levels: Record<string, TalentPayment[]>;
}
export interface TalentPlayer {
    global: number;
    trees: Record<string, number>;
    progress: Record<string, TalentProgress>;
    grantedTreeIds?: string[];
    unlockedTreeIds?: string[];
}
export interface TalentSettings {
    enabled: boolean;
    globalEnabled: boolean;
    maxGlobal: number;
}
export interface TalentRequirement {
    type: 'node' | 'treePoints' | 'subtreePoints';
    name: string;
    current: number;
    amount: number;
}
export interface TalentRequirementGroup {
    source: 'parents' | 'node' | 'rank';
    mode: 'all' | 'any';
    items: TalentRequirement[];
}
export interface TalentNodeState {
    cost?: number;
    level: number;
    maximum: number;
    hidden: boolean;
    canAllocate: boolean;
    canRevert: boolean;
    reason: string;
    requirements: TalentRequirement[];
    requirementGroups?: TalentRequirementGroup[];
    dependents: string[];
}
export interface TalentSnapshot {
    revision: number;
    settings: TalentSettings;
    canManage: boolean;
    trees: TalentTree[];
    player: TalentPlayer;
    states: Record<string, Record<string, TalentNodeState>>;
    members?: {
        userId: string;
        name: string;
        player: TalentPlayer;
    }[];
    hidden?: Record<string, string[]>;
    accessibleTreeIds?: string[];
}
export type TalentOperation = {
    op: 'read';
} | {
    op: 'settings';
    settings: TalentSettings;
} | {
    op: 'save';
    tree: TalentTree;
    confirmReset?: boolean;
} | {
    op: 'archive';
    treeId: string;
    archived: boolean;
} | {
    op: 'delete';
    treeId: string;
    confirmReset?: boolean;
} | {
    op: 'visibility';
    treeId: string;
    targetUserId: string;
    visible: boolean;
} | {
    op: 'access';
    treeId: string;
    targetUserId: string;
    granted: boolean;
} | {
    op: 'balance';
    targetUserId: string;
    treeId?: string;
    points: number;
} | {
    op: 'select';
    treeId: string;
    subtreeId: string;
} | {
    op: 'allocate' | 'revert';
    treeId: string;
    nodeId: string;
} | {
    op: 'respec';
    treeId: string;
    specialization: boolean;
    confirm?: boolean;
};
export interface TalentAction {
    action: 'talents';
    payload: {
        roomId: string;
        userId: string;
        revision?: number;
    } & TalentOperation;
}
export interface TalentResult {
    talents: TalentSnapshot;
    resetRequired?: {
        userId: string;
        name: string;
        global: number;
        tree: number;
    }[];
}
export const emptyTalentPlayer = (): TalentPlayer => ({ global: 0, trees: {}, progress: {}, grantedTreeIds: [], unlockedTreeIds: [] });
export const emptyTalentProgress = (): TalentProgress => ({ selectedSubtree: null, levels: {} });
export const emptyConditions = (): TalentConditions => ({ mode: 'all', items: [] });
export function newTalentTree(id: string, layout: TalentLayout): TalentTree {
    return { id, name: '', description: '', layout, parentTreeId: null, accessMode: 'available', currency: 'tree', icon: 'mdi-file-tree', imageId: null, nodes: [], edges: [], subtrees: [], decorations: [], options: { connectionStyle: 'rounded', connectionArrow: 'triangle', iconsOnly: true, levelPosition: 'bottom-right', allowRevert: true, allowRespec: true, selectSubtree: false, allowSpecializationRespec: true, refundSpecialization: true, separators: true, startingNodes: 0 } };
}
