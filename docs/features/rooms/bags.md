# Room bags

Bag provides shared Team inventory and a Personal inventory per member. Keep privacy, ownership, revisions and immutable chat snapshots consistent across all operations.

## Where to work

| Responsibility | Source |
| --- | --- |
| Dialog, fields, item presets, images and previews | [components/bags/](../../../src/features/rooms/components/bags/) |
| Sorting, rarity and icon lookup | [rooms/utils/](../../../src/features/rooms/utils/) |
| Client snapshots/subscriptions | [rooms.store.ts](../../../src/features/rooms/stores/rooms.store.ts), [room-realtime.service.ts](../../../src/features/rooms/services/room-realtime.service.ts) |
| Core inventory mutations and inspection | [room-bag.service.ts](../../../server/services/rooms/room-bag.service.ts) |
| Custom-field library / whole-item presets | [room-bag-templates.service.ts](../../../server/services/rooms/room-bag-templates.service.ts), [room-bag-item-templates.service.ts](../../../server/services/rooms/room-bag-item-templates.service.ts) |
| Image validation/access/cleanup | [room-bag-images.service.ts](../../../server/services/rooms/room-bag-images.service.ts) |
| Contracts and validators | [bag.types.ts](../../../server/core/types/bag.types.ts), [bag-validation.ts](../../../server/core/utils/bag-validation.ts), [bag-item-template.ts](../../../server/core/utils/bag-item-template.ts) |
| Shared editor styles | [styles/features/rooms/](../../../src/assets/styles/features/rooms/) |

## Permissions and mutation rules

Bag starts disabled. Members need `viewBag` to read and both `viewBag`/`editBag` to edit. Personal writes are owner-only, including for room creators. Current members can inspect another member’s Personal inventory read-only with `viewBag`. Disabled or archived rooms reject inventory operations; disabling retains data and old chat shares.

Authenticated actions go through `POST /api/rooms`; the action union lives in [rooms.service.ts](../../../server/services/rooms.service.ts). Actor identity comes from authentication, not a freely chosen owner field. Entity edits/deletes/gifts require current revisions; bag-level operations such as reordering require the bag revision. A stale write returns 409. Preserve editor drafts until the user explicitly chooses to replace them with the latest version.

Serialize mutations and membership checks with the room transaction lock. Keep entity and bag revision increments in the same transaction, including out-of-band writes, then publish personalized snapshots after commit.

## Items, tabs and gifts

Items carry name, description, rarity, image/icon, section, ordered fields and display flags. Fields support string, integer, select and multi-select types. Attached definitions are copies; later library edits do not rewrite items. Use the shared validators rather than reproducing limits in new controls: names are capped at 120 characters, descriptions at 10,000, text values at 4,000, fields at 50 and select options at 100.

Uncategorized is a permanent null-section tab with per-bag icon/color metadata. Renaming it must not create a real section. Deleting a section moves its items there. `reorderBagSections` accepts a complete unique permutation including `uncategorized`, under the current bag revision. Preserve selected tab identity and keyboard/touch reorder alternatives.

Grid size and sorting are local preferences per user, room, scope and tab. Favorites belong to the item and are shared within its bag. Favorite changes require editing rights/revision but do not change the content edit timestamp. Sort favorites first, then apply the chosen creation/edit/name/rarity order. Moves and gifts preserve original creation dates.

Move transfers an item between Team and the actor’s Personal tabs. Give removes it from its source into the recipient’s pending inbox, preserving ID, creator, copied fields, flags and image. Only the recipient with editing rights/current revision can accept into a Personal section or reject back to the source (Uncategorized if the section disappeared). Pending gifts cannot be edited, moved, shared or inspected by others.

`shareBagItem` creates an immutable server-generated `item_share` message through the session activity gate. Personal sharing requires explicit disclosure confirmation; Personal-to-Team moves show a visibility notice. Future edits/deletion/transfers never rewrite old chat snapshots or revoke images still referenced by them.

## Custom fields and item templates

These are separate libraries, each owned by a user within a room and shared across their Team/Personal editors.

**Custom fields:** only the owner edits/deletes private definitions. Public definitions are discoverable in the room while the author remains a member. Using a public field records the copied definition. Privatizing/deleting the source creates a private replica for each consumer using their last-used version; later changes do not overwrite a consumer’s edited replica. Existing item fields and chat snapshots remain unchanged. Never expose private library metadata or editing presence to other members.

**Item Templates:** whole-item presets include description, rarity, image/icon, ordered field definitions/defaults and display flags. Members can publish presets or import public presets as independent private copies. Publishing embedded field definitions must not expose the source’s private field library.

Applying a preset preserves item identity, name, section, favorites and nonconflicting ordinary fields; it replaces previous template fields and applies appearance/description defaults after confirming populated-content replacement. Trimmed case-insensitive field conflicts use the preset definition and retain old values only when valid. Keep the combined 50-field limit. Template definitions are fixed in the item editor while values/display flags remain editable.

Items embed an `itemTemplate` snapshot and mark copied fields with `itemTemplateField`. Source changes never rewrite items or imported copies. Validate newly attached sources at save time; unavailable/changed definitions require reselection while preserving the draft. Use the shared rarity selector and editor styles for item/preset UI. Legacy display flags remain readable even where their old controls are no longer shown.

## Images

`POST /api/rooms/:roomId/bag/images?scope=team|personal` accepts raw static JPEG/PNG/WebP with matching Content-Type, up to 5 MB. Sharp normalizes to WebP within 1024×1024. Authenticated reads require membership and an authorized inventory, preset or chat reference. Store bytes in MySQL and use revocable blob URLs in the client.

Hourly cleanup removes unreferenced uploads older than one hour; item, preset/private-import and immutable chat references retain their images. Include image tables in backups and install Sharp’s platform-compatible native binaries. There is no external image-storage dependency.

## Realtime and profile inspection

Opening Bag sends authenticated `bag.subscribe` on the room socket, with scope and optional inspection target. The server sends `bag.snapshot` and authorized presence. Switching scope replaces the subscription; closing unsubscribes. HTTP performs writes and image uploads; full personalized socket snapshots keep inventory reactive independently of chat/session hydration.

Team delivery requires current rights. Personal subscriptions are owner-scoped; targeted inspection exposes contents read-only with empty template catalogs and no presence. Recheck access on every delivery. Reconnect replays the subscription/interaction state. Ignore older revisions and responses for another room/scope/target, and never overwrite an unsaved draft. Subscription errors are scoped; access loss clears cached contents/presence. Server revision checks every two seconds recover missed publications without sending unchanged snapshots.

Presence is advisory: interaction states heartbeat every 10 seconds and expire after 30 seconds or on close/disconnect/rights loss. Derive the actor from the authenticated socket and validate referenced entries. Personal activity is private; template-management presence is owner-only even in Team scope.

Profile inspection uses the existing Bag panel with write/share/scope-switch controls hidden. Keep the target identity through reconnect and clear/close inspection on permission or membership loss. The [shared injection interface](../../../src/shared/composables/useBagInspection.ts) connects profiles to rooms without a profile-to-room-store dependency.

## Session recaps

Bag actions do not start sessions or extend inactivity. Successful creates, saved edits, deletions and outgoing gifts count for the source bag; repeated edits count separately. Accept/reject, moves, favorites, shares, sections and templates do not count.

New sessions snapshot `bagTrackingVersion: 1`. Older/running sessions without that version show unavailable data; do not backfill fictional activity. Events commit with inventory mutations and close under the room lock into frozen recap aggregates. Return Team counts and only the authenticated viewer’s Personal counts. Never expose other owners’ aggregates in shared session responses or socket broadcasts. Disabling Bag preserves historical statistics.

## Migration and verification

Run `npm run db:update` and deploy matching client/server versions. Schema setup is additive and repeatable. Existing items receive migration-time creation/edit dates where no historical dates exist. Legacy Personal field templates keep their owner/IDs; legacy Team templates become private to the creator because their author was unknown. Migrated rows are removed from the legacy source so deleted templates are not recreated later. Item presets need no item backfill.

Run `npm run test:frontend`, `npm run test:rooms:browser`, `npm run server:test:bag`, `npm run server:typecheck` and `npm run build`. The MySQL suite includes real authenticated sockets for privacy, push, transfers, reconnect and access revocation. See [testing](../../guides/testing.md) for setup. Check stale edits, personalized payloads and image retention for new operations; monitor Bag action/image/cleanup errors and committed-publication failures.
