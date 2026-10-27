# Room roles and rights (ROLZ-13)

Roles are scoped to a room and independent of application roles. Existing owners
are backfilled as `creator`; other members start as `player`. Membership refreshes
preserve saved roles and overrides. Run `npm run db:update` before deploying the
matching server/client. Schema setup is idempotent; it does not reset custom rights.

`server/core/utils/room-permissions.ts` defines the role defaults and the permission
catalog shared by client and server. Creator rights cannot be reduced. Administration
is restricted to creator/admin and is not an overridable permission. Chat, rolling,
personal bonus spending and owned-award use retain their existing rules. Dice and
categories retain their existing per-user ownership boundaries.

The authenticated `POST /api/rooms` action interface adds:

- `updateMemberRole`: `{ roomId, userId, targetUserId, role }`, where role is
  `player`, `dm` or `admin`. Clears overrides even when reapplying the role.
- `updateMemberRights`: `{ roomId, userId, targetUserId, rights }`, where rights is
  a boolean map using the shared permission identifiers. Replaces overrides;
  omitted keys inherit role defaults. `{}` resets to defaults.
- `transferRoomOwnership`: `{ roomId, userId, targetUserId }`. Only the current
  creator can call this. The former creator becomes admin; both members reset to
  defaults. The transaction locks the room, as do concurrent administration edits.
- `updateDiceCategory`: `{ roomId, userId, categoryId, name }`. Requires category
  management permission and ownership of the category in that room.

For all four actions, `userId` identifies the actor and must match the authenticated
Discord/API-key identity. Administration actions return `{ roomId, members }` with
the affected actor and target. Member payloads include `role`, `permissionOverrides`
and `effectivePermissions`. Unknown rights and non-boolean values are rejected.
Room lists include a viewer-specific `canArchive` capability.

Role/right changes publish `member.updated`. Ownership transfer also publishes
`room.updated` and both affected members. Reconnection rehydrates member rights.
Clients gate tabs and controls reactively; the server checks permissions again on
requests. Critical/bonus configuration required by gameplay remains available in
session snapshots even when the corresponding settings tabs are hidden.

DMs can confirm/cancel a pending award-assignment request, including activity-driven
starts. Ordinary manual start/close requires `manageSessions`. Unauthorized members
see the pending assignment screen with disabled controls.

Validation: `npm run server:test`, `npm run server:typecheck`, `npm run build`, and
`npm run server:test:awards` (local MySQL; creates and removes an isolated database).
The integration test covers legacy-schema backfill, repeat setup, role/override
changes, creator protection, transfer rollback/concurrency, and DM assignment.
