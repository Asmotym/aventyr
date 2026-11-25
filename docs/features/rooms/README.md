# Rooms, membership, chat and realtime

Rooms own gameplay state and communication. Home composes the room experience; there is intentionally no separate room page lifecycle.

## Where to work

| Responsibility | Source |
| --- | --- |
| Room board, list and sidebar | [rooms/components/](../../../src/features/rooms/components/) |
| Chat, member tools and developer panel | [components/chat/](../../../src/features/rooms/components/chat/), [RoomMembersMenu](../../../src/features/rooms/components/RoomMembersMenu.component.vue) |
| Reactive room/session state | [rooms.store.ts](../../../src/features/rooms/stores/rooms.store.ts) |
| HTTP actions and socket recovery | [services/](../../../src/features/rooms/services/) |
| Room settings composition | [composables/](../../../src/features/rooms/composables/), [components/settings/](../../../src/features/rooms/components/settings/) |
| Action contracts and dispatch | [room action dispatcher](../../../server/features/rooms/rooms.service.ts) |
| Access, messages, sessions and subfeatures | [room features](../../../server/features/rooms) |
| Socket protocol and committed events | [room realtime](../../../server/features/rooms/realtime) |
| Domain contracts and schema | [shared contracts](../../../shared), [schema.ts](../../../server/app/schema.ts) |

Related guides: [permissions](permissions.md), [dice](dice.md), [bonus points](bonus-points.md), [sessions/awards](sessions.md), [bags](bags.md), [talents](talents.md).

## Entry and membership

Keep create/join validation, normalized names/codes, favorites, leave/archive/restore behavior and selected-room routing consistent across desktop/mobile. Failed actions retain input for explicit retry. Membership changes must refresh effective permissions and remove access to private state when appropriate.

Use the narrow room feature exports for cross-feature integration. Keep subfeature UI in its existing component folder and pure calculations in room utilities. Settings tabs compose their own managers; reusable infrastructure belongs in shared only when it has no room dependency.

## Chat and sessions

Text, dice and item shares use the existing server message contracts. Treat session start as a gate before sending, not an unrelated popup: preserve queued text, generated rolls and send-as identity through approval/cancellation. Never automatically resend after an ambiguous network failure. [Sessions](sessions.md) explains the persisted start request and safe retry cases.

Preserve message pagination/windowing and scroll behavior when updating the list. Render structured share/award metadata with its owning components. Notification failures must leave retry controls and editable drafts available; use the error owner once rather than notifying from every nested component.

Developer send-as and Bag tooling are for development. Client controls are development-gated; the server also authorizes developer operations. Never turn them into a production identity bypass.

## Realtime maintenance

Authenticate before subscribing. Keep reconnect reauthentication, room switches and teardown in the realtime service/store; clear stale subscriptions on leave/logout. Do not replace newer state with a late response from another room, account or scope.

Normal room events update/refetch the affected state. Talents use payload-free invalidation; Bag uses authorized personalized snapshots and presence. Respect each protocol instead of routing all events through a full chat reload. Publish mutations only after the database commit and enforce membership on every delivery.

## Verification

Run `npm run test:frontend`, `npm run test:rooms:browser` and `npm run build`. For backend changes, run `npm run server:test`, `npm run server:typecheck` and the affected integration suite from [testing](../../guides/testing.md). Cover joining/leaving, room switching, permission loss, reconnect, failure/retry and mobile keyboard/focus behavior.

## Global settings transfer

The final room settings tab, **Import/Export**, transfers saved configuration through JSON files or the clipboard. Exports include only manageable sections. Room name and inactivity require `editRoom`; dice/categories affect the actor's own configuration. Roll Awards also requires the existing copy permission. Membership, credentials, personal settings, balances, player progress, inventory and session history are never transferred.

`aventyr-room-settings` version 1 contains `sections` and deduplicated `images`. Each optional section has selectable scalar `values` and named `lists`. Sections are `room`, `dices`, `rollAwards`, `criticals`, `bonusPoints`, `talents` and `bag` (Bag enabled only). Existing award arrays and `aventyr-talent-tree` version 1 packages are accepted. Files are limited to 50 MB; selected dice categories and linked/parent talent trees must travel together. Talent images are embedded base64 assets and validated before confirmation.

Add creates new list entries with fresh identities and preserves scalar settings. Duplicate category names receive numbered suffixes, shown in confirmation. Dice transfer requires both dice and category management rights. Replace clears lists in selected sections, imports selected entries and applies selected scalar values; unselected sections remain untouched. Talent Replace archives existing active trees, preserves their player data and imports new active copies. Archived trees still count toward the 50-tree limit. Bonus-point limit changes do not rewrite balances. Session configuration snapshots are unchanged.

Authenticated `exportSettings`, `previewSettingsImport` and `importSettings` actions use `/api/rooms/settings-transfer` (also accepted by the standard action endpoint within its normal body limit). Preview returns exact additions/removals/archives/value changes and a 15-minute token bound to the actor, room, selected package, mode and current saved configuration. Import rechecks permissions and the token under configuration locks, applies all sections in one transaction and publishes updates after commit. Stale, expired or ambiguous outcomes require a new review; no automatic retry occurs. For multiple replicas, configure the same `ROOM_SETTINGS_TRANSFER_SECRET` (32+ random characters) on each instance. Without it, tokens expire on server restart and require the same process.

Transfer coverage is included in `npm run server:test:rooms`; browser coverage is `tests/browser/rooms/settings-transfer.spec.ts`.
