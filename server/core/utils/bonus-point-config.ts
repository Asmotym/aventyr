import type { RoomBonusNotification, RoomBonusPointConfiguration, RoomBonusPointEffect, RoomBonusPointRule, RoomBonusPointTrigger } from '../types/data.types';
import { getDiceFaceInfo, getSelectedRawRoll, isNaturalExtremeRoll } from './bonus-point-dice';

export function parseBonusNotation(input: string) {
    const match = typeof input === 'string' && input.trim().match(/^([+-])?(\d+)?d([1-9]\d*)([+-]\d+)?$/i);
    if (!match) throw new Error('Invalid dice notation');
    const mode = match[1] ?? '', count = Number(match[2] ?? 1), sides = Number(match[3]), modifier = Number(match[4] ?? 0);
    if (![count, sides, modifier].every(Number.isSafeInteger) || count < 1 || sides < 1 || (mode && count < 2)) throw new Error('Invalid dice notation');
    const min = (mode ? 1 : count) + modifier, max = (mode ? sides : count * sides) + modifier;
    if (![min, max].every(Number.isSafeInteger)) throw new Error('Invalid dice bounds');
    return { notation: `${mode}${count === 1 ? '' : count}d${sides}${modifier ? (modifier > 0 ? '+' : '') + modifier : ''}`, min, max };
}

export function legacyTrigger(rule: RoomBonusPointRule): RoomBonusPointTrigger {
    const { operator, threshold, thresholdMax } = rule.condition;
    return { id: rule.id, roomId: rule.roomId, name: rule.name, legacyRule: rule, groups: [[
        ...(operator === 'between' ? [
            { diceNotation: rule.diceNotation, operator: 'moreThan' as const, threshold: threshold - 1 },
            { diceNotation: rule.diceNotation, operator: 'lessThan' as const, threshold: Number(thresholdMax) + 1 }
        ] : [{ diceNotation: rule.diceNotation, operator, threshold }])
    ]] };
}
export function legacyEffects(rules: RoomBonusPointRule[]): RoomBonusPointEffect[] {
    const seen = new Set<string>();
    return rules.filter(rule => !seen.has(rule.diceNotation) && Boolean(seen.add(rule.diceNotation))).map(rule => ({
        id: rule.id, roomId: rule.roomId, name: rule.name, diceNotation: rule.diceNotation, legacy: true,
        actions: [{ type: 'adjust', ...rule.spendAdjustment }]
    }));
}
export function countBonusTriggers(triggers: RoomBonusPointTrigger[], notation: string, total: number, rolls: number[]) {
    const canonical = parseBonusNotation(notation).notation;
    return triggers.filter(trigger => trigger.groups.some(group => group.length > 0 && group.every(condition => {
        const legacy = Boolean(trigger.legacyRule);
        const value = legacy ? getSelectedRawRoll(notation, rolls) : total;
        const matches = legacy ? getDiceFaceInfo(notation)?.faceNotation === condition.diceNotation : canonical === parseBonusNotation(condition.diceNotation).notation;
        return matches && (condition.operator === 'moreThan' ? value > condition.threshold : value < condition.threshold);
    }))).length;
}
export function matchesBonusSpendConditions(config: RoomBonusPointConfiguration, notation: string, total: number): boolean {
    return !config.conditions?.length || countBonusTriggers(config.conditions.map(condition => ({ ...condition, legacyRule: undefined })), notation, total, []) > 0;
}
export function evaluateBonusEffects(config: RoomBonusPointConfiguration, notation: string, total: number, rolls: number[], allowExtreme: boolean) {
    if (!matchesBonusSpendConditions(config, notation, total)) return { total, messages: [], effectIds: [], notifications: [], eligible: false };
    const parsed = parseBonusNotation(notation);
    const face = getDiceFaceInfo(notation);
    const normalized = parsed.notation;
    const rawTotal = normalized.startsWith('+') ? Math.min(...rolls)
        : normalized.startsWith('-') ? Math.max(...rolls) : rolls.reduce((sum, roll) => sum + roll, 0);
    const modifier = Number(normalized.match(/d\d+([+-]\d+)$/)?.[1] ?? 0);
    const naturalExtreme = rolls.length > 0 && (rawTotal + modifier === parsed.min || rawTotal + modifier === parsed.max);
    const effects = (config.effects ?? []).filter(effect => effect.legacy
        ? effect.diceNotation === face?.faceNotation
        : parseBonusNotation(effect.diceNotation).notation === normalized);
    let nextTotal = total, changed = false;
    const effectIds: string[] = [];
    const notifications: Array<string | RoomBonusNotification> = [];
    const messages: Array<{ text: string; effectId: string }> = [];
    for (const effect of effects) {
        const sides = face?.sides ?? parsed.max;
        if (effect.legacy && (total === 1 || total === sides)) continue;
        if (!allowExtreme && (effect.legacy ? isNaturalExtremeRoll(notation, rolls) : naturalExtreme)) continue;
        effectIds.push(effect.id);
        for (const action of effect.actions) {
            if (action.type === 'notification') notifications.push(action.severity === undefined && action.timeout === undefined ? action.text : { text: action.text, severity: action.severity, timeout: action.timeout });
            else if (action.type === 'message') messages.push({ text: action.text, effectId: effect.id });
            else {
                const adjusted = nextTotal + (action.sign === '-' ? -action.amount : action.amount);
                const next = Math.min(effect.legacy ? sides : parsed.max, Math.max(effect.legacy ? 1 : parsed.min, adjusted));
                changed ||= next !== nextTotal;
                nextTotal = next;
            }
        }
    }
    return { total: nextTotal, messages, effectIds, notifications, eligible: changed || messages.length > 0 || notifications.length > 0 };
}

export function validateBonusEntry(kind: 'trigger' | 'condition' | 'effect', value: RoomBonusPointTrigger | RoomBonusPointEffect) {
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) throw new Error('Name is required (maximum 100 characters)');
    if (kind !== 'effect') {
        const trigger = value as RoomBonusPointTrigger;
        if (!Array.isArray(trigger.groups) || !trigger.groups.length || trigger.groups.length > 20) throw new Error('Add at least one condition group (maximum 20)');
        for (const group of trigger.groups) {
            if (!Array.isArray(group) || !group.length || group.length > 20) throw new Error('Add conditions to every group (maximum 20)');
            for (const condition of group) {
                const notation = parseBonusNotation(condition.diceNotation).notation;
                if (trigger.legacyRule && !/^d[1-9]\d*$/.test(notation)) throw new Error('Existing triggers use dice types such as d10. Create a new trigger for full notation.');
                if (!['moreThan','lessThan'].includes(condition.operator) || typeof condition.threshold !== 'number' || !Number.isFinite(condition.threshold)) throw new Error('Invalid condition');
            }
        }
    } else {
        const effect = value as RoomBonusPointEffect;
        const notation = parseBonusNotation(effect.diceNotation).notation;
        if (effect.legacy && !/^d[1-9]\d*$/.test(notation)) throw new Error('Existing effects use dice types such as d10. Create a new effect for full notation.');
        if (!Array.isArray(effect.actions) || !effect.actions.length || effect.actions.length > 50) throw new Error('Add at least one action (maximum 50)');
        for (const action of effect.actions) {
            if (action.type === 'notification') {
                if (action.severity !== undefined && !['info', 'success', 'warning', 'error'].includes(action.severity)) throw new Error('Invalid notification severity');
                if (action.timeout !== undefined && (!Number.isInteger(action.timeout) || (action.timeout !== -1 && (action.timeout < 1000 || action.timeout > 60000)))) throw new Error('Notification duration must be 1000–60000 ms, or -1 to stay visible');
            }
            if (action.type === 'adjust') {
                if (!['+','-'].includes(action.sign) || !Number.isSafeInteger(action.amount) || action.amount < 1) throw new Error('Adjustment must be a positive integer');
            } else if (!['message', 'notification'].includes(action.type) || typeof action.text !== 'string' || !action.text.trim() || action.text.length > 2000) throw new Error('Message text is required (maximum 2000 characters)');
        }
    }
}
