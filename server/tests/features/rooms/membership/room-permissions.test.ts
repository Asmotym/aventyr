import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOM_PERMISSIONS,memberAccess,normalizeRoomOverrides,parseRoomOverrides,resolveRoomRights,roleDefaults } from '../../../../../shared/rooms/room-permissions';

test('room role defaults grant full creator/admin rights and assignment/talent management to DM', () => {
    assert.deepEqual(roleDefaults('creator'), roleDefaults('admin'));
    for (const key of ROOM_PERMISSIONS) assert.equal(roleDefaults('creator')[key], true);
    assert.deepEqual(ROOM_PERMISSIONS.filter(key => roleDefaults('player')[key]), ['viewBag', 'editBag', 'editNickname', 'manageDice', 'manageDiceCategories', 'viewRollAwards']);
    assert.deepEqual(roleDefaults('dm'), { ...roleDefaults('player'), assignRollAwards: true, manageTalentTrees: true });
});
test('overrides grant and revoke rights, normalize defaults, and cannot restrict creator', () => {
    const rights = resolveRoomRights('player', { editNickname: false, manageCriticals: true });
    assert.equal(rights.editNickname, false);
    assert.equal(rights.manageCriticals, true);
    assert.deepEqual(normalizeRoomOverrides('player', rights), { editNickname: false, manageCriticals: true });
    assert.deepEqual(normalizeRoomOverrides('player', roleDefaults('player')), {});
    assert.equal(resolveRoomRights('creator', { editRoom: false }).editRoom, true);
    assert.equal(memberAccess({ role: 'player', permissionOverrides: { editRoom: true } }).administration, false);
    assert.equal(memberAccess({ role: 'admin' }).administration, true);
});
test('stored overrides tolerate missing/corrupt values and discard unknown keys', () => {
    for (const value of [null, '', '{', [], 'false']) assert.deepEqual(parseRoomOverrides(value), {});
    assert.deepEqual(parseRoomOverrides('{"manageCriticals":true,"administration":true,"editNickname":"false"}'), { manageCriticals: true });
});

test('room summaries expose the viewer membership role for room list icons', async () => {
    const { mapRoomToSummary } = await import('../../../../features/rooms/domain/rooms.mappers');
    const room = { id: 'room', name: 'Room', invite_code: 'invite', created_by: 'owner' };
    for (const role of ['creator', 'admin', 'dm', 'player'] as const) {
        assert.equal(mapRoomToSummary({ ...room, viewer_role: role }).viewerRole, role);
    }
    assert.equal(mapRoomToSummary(room, { currentUserId: 'owner' }).viewerRole, 'creator');
    assert.equal(mapRoomToSummary(room).viewerRole, undefined);
});
