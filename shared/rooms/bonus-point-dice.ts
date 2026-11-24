export interface DiceFaceInfo {
    faceNotation: string;
    sides: number;
}
export function getDiceFaceInfo(notation?: string | null): DiceFaceInfo | null {
    const match = notation?.trim().toLowerCase().match(/^[+-]?(?:\d+)?d([1-9]\d*)(?:[+-]\d+)?$/);
    if (!match)
        return null;
    const sides = Number(match[1]);
    if (!Number.isFinite(sides) || sides < 1)
        return null;
    return {
        faceNotation: `d${sides}`,
        sides
    };
}
export function getSelectedRawRoll(notation: string | null | undefined, rolls: number[] | null | undefined): number {
    if (!rolls?.length) {
        return Number.NaN;
    }
    const normalized = notation?.trim().toLowerCase() ?? '';
    const match = normalized.match(/^([+-])?(?:\d+)?d[1-9]\d*(?:[+-]\d+)?$/);
    if (match?.[1] === '+') {
        return Math.min(...rolls);
    }
    if (match?.[1] === '-') {
        return Math.max(...rolls);
    }
    return rolls[0];
}
export function isNaturalExtremeRoll(notation: string | null | undefined, rolls: number[] | null | undefined): boolean {
    const info = getDiceFaceInfo(notation);
    const selectedRoll = getSelectedRawRoll(notation, rolls);
    return Boolean(info && Number.isFinite(selectedRoll) && (selectedRoll === 1 || selectedRoll === info.sides));
}
export function clampTotalToDiceFace(value: number, sides: number): number {
    return Math.min(sides, Math.max(1, value));
}
