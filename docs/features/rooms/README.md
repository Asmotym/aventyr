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
| Action contracts and dispatch | [server/services/rooms.service.ts](../../../server/services/rooms.service.ts) |
| Access, messages, sessions and subfeatures | [server/services/rooms/](../../../server/services/rooms/) |
| Socket protocol and committed events | [server/realtime/](../../../server/realtime/) |
| Domain contracts and schema | [server/core/types/](../../../server/core/types/), [schema.ts](../../../server/core/database/schema.ts) |

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
