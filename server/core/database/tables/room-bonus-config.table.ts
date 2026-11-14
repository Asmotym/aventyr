import { randomUUID } from 'crypto';
import { execute, query, transaction } from '../client';
import type { RoomBonusPointEffect, RoomBonusPointTrigger } from '../../types/data.types';
import { legacyEffects, legacyTrigger, parseBonusNotation, validateBonusEntry } from '../../utils/bonus-point-config';
import { listRoomBonusPointRules } from './room-bonus-points.table';
import { mapBonusPointRuleRecord } from '../../../services/rooms/rooms.mappers';
import { BadRequestError, NotFoundError } from '../../errors/http-errors';

type Kind = 'trigger' | 'condition' | 'effect';
const table = (kind: Kind) => kind === 'trigger' ? 'room_bonus_triggers' : kind === 'condition' ? 'room_bonus_conditions' : 'room_bonus_effects';
export async function listBonusEntries<T extends RoomBonusPointTrigger | RoomBonusPointEffect>(roomId: string, kind: Kind): Promise<T[]> {
    const rows = await query<Array<{ id: string; definition: string | T }>>(`SELECT id, definition FROM ${table(kind)} WHERE room_id = ? ORDER BY position, id`, [roomId]);
    return rows.map(row => ({ ...(typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition), id: row.id, roomId }));
}
export async function migrateRoomBonusConfiguration(roomId: string) {
    return transaction(async () => {
        const room = await query<Array<{ bonus_config_version: number }>>('SELECT bonus_config_version FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
        if (!room[0] || room[0].bonus_config_version === 2) return;
        const rules = (await listRoomBonusPointRules(roomId)).map(mapBonusPointRuleRecord);
        for (const [kind, entries] of [['trigger', rules.map(legacyTrigger)], ['effect', legacyEffects(rules)]] as const) {
            for (const [position, entry] of entries.entries()) await execute(`INSERT INTO ${table(kind)} (id, room_id, position, definition) VALUES (?, ?, ?, ?)`, [entry.id, roomId, position, JSON.stringify(entry)]);
        }
        await execute('UPDATE rooms SET bonus_config_version = 2 WHERE id = ?', [roomId]);
    });
}
export async function mutateBonusEntry(roomId: string, kind: Kind, operation: 'save' | 'delete' | 'reorder', entry?: RoomBonusPointTrigger | RoomBonusPointEffect, id?: string, ids?: string[]) {
    await migrateRoomBonusConfiguration(roomId);
    await transaction(async () => {
        await query('SELECT id FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
        const entries = await listBonusEntries(roomId, kind);
        if (operation === 'reorder') {
            if (!Array.isArray(ids) || ids.length !== entries.length || new Set(ids).size !== ids.length || ids.some(id => !entries.some(entry => entry.id === id))) throw new BadRequestError('Invalid ordering');
            for (const [position, entryId] of ids.entries()) await execute(`UPDATE ${table(kind)} SET position = ? WHERE id = ? AND room_id = ?`, [position, entryId, roomId]);
        } else if (operation === 'delete') {
            if (!entries.some(entry => entry.id === id)) throw new NotFoundError('Configuration not found');
            await execute(`DELETE FROM ${table(kind)} WHERE id = ? AND room_id = ?`, [id, roomId]);
        } else {
            try { validateBonusEntry(kind, entry!); } catch (error) { throw new BadRequestError((error as Error).message); }
            const existing = entry?.id ? entries.find(item => item.id === entry.id) : undefined;
            if (entry?.id && !existing) throw new NotFoundError('Configuration not found');
            // Compatibility flags are owned by the server and survive edits.
            let normalized: RoomBonusPointTrigger | RoomBonusPointEffect;
            if (kind !== 'effect') {
                const trigger = entry as RoomBonusPointTrigger;
                normalized = { id: existing?.id ?? randomUUID(), roomId, name: trigger.name.trim(), groups: trigger.groups.map(group => group.map(condition => ({ diceNotation: parseBonusNotation(condition.diceNotation).notation, operator: condition.operator, threshold: condition.threshold }))), legacyRule: kind === 'trigger' ? (existing as RoomBonusPointTrigger | undefined)?.legacyRule : undefined };
            } else {
                const effect = entry as RoomBonusPointEffect;
                normalized = { id: existing?.id ?? randomUUID(), roomId, name: effect.name.trim(), diceNotation: parseBonusNotation(effect.diceNotation).notation, actions: effect.actions.map(action => action.type === 'adjust' ? { type: 'adjust', sign: action.sign, amount: action.amount } : { type: action.type, text: action.text.trim(), ...(action.type === 'notification' ? { severity: action.severity, timeout: action.timeout } : {}) }), legacy: (existing as RoomBonusPointEffect | undefined)?.legacy };
            }
            try { validateBonusEntry(kind, normalized); } catch (error) { throw new BadRequestError((error as Error).message); }
            await execute(`INSERT INTO ${table(kind)} (id, room_id, position, definition) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE definition = VALUES(definition)`, [normalized.id, roomId, entries.length, JSON.stringify(normalized)]);
        }
    });
}
