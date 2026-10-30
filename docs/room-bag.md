# Room Bag (AVENTYR-31)

The Bag dialog provides a shared Team inventory and an owner-only Personal inventory per room member. All roles default to `viewBag` and `editBag`; editing requires both. Creator privileges do not bypass Personal ownership. Room editors enable Bag in Settings → Bag. Disabled and archived rooms reject inventory operations; disabling retains data and existing chat shares.

## API and persistence

Authenticated `POST /api/rooms` supports `bag`, `setBagEnabled`, `createBagSection`, `updateBagSection`, `deleteBagSection`, `createBagTemplate`, `updateBagTemplate`, `deleteBagTemplate`, `createBagItem`, `updateBagItem`, `deleteBagItem`, `giveBagItem`, and `shareBagItem`.

Each action supplies `payload: { roomId, userId, scope?: 'team' | 'personal', id?, revision?, data?, targetUserId?, enabled? }`. `userId` must match the authenticated actor. Personal ownership is derived from that actor. `bag` returns `{ bag }`; inventory writes return `{ bag, selectedId?, affectedUsers? }`; enablement returns `{ room }`; sharing returns the existing chat/session response. `BagSnapshot` and item/field definitions are in `server/core/types/bag.types.ts`.

Sections/templates accept `data: { name }` or `{ name, type, options }`. Items accept name, description, rarity, imageId, sectionId, displayDescription, and ordered fields. Field types are `string`, `integer`, `select`, and `multi-select`; fields carry `name`, `type`, `options`, `value`, `display`, and optional `templateId`. Custom definitions are copied at attachment time. Renaming/deleting a template does not change items already using a copy. IDs, creator and revisions are server-controlled. Names are limited to 120 characters, descriptions to 10,000, text values to 4,000, fields per item to 50, and options per select to 100.

Updates, deletion and giving require the current entry revision. A stale revision returns HTTP 409, without changing stored data. The editor preserves its draft on errors; “Replace draft with latest version” deliberately reloads a saved item. Deleting sections moves items to Uncategorized. Giving moves a Personal item into another current member’s Personal Uncategorized table, preserving ID, creator, fields, flags and image. Room-row transaction locks serialize administration, Bag changes and transfers; recipient membership is checked under lock.

`shareBagItem` saves a server-generated immutable `item_share` snapshot in chat through the existing session activity lifecycle. Sharing Personal items explicitly confirms disclosure. Changes/deletion/transfers never change old chat snapshots. Existing room-chat access rules apply to snapshots and their images.

## Images and realtime

`POST /api/rooms/:roomId/bag/images?scope=team|personal` accepts raw JPEG/PNG/WebP bytes with the corresponding Content-Type, a 5 MB body limit, and the existing bearer/API-key authentication. Sharp verifies and normalizes static images to WebP within 1024×1024. The response is `{ success: true, data: { imageId } }`. Authenticated `GET /api/rooms/:roomId/bag/images/:imageId` requires membership and authorized inventory or chat-snapshot access. Bytes live in MySQL; clients use revocable blob URLs rather than public asset URLs. Hourly cleanup removes unreferenced assets older than one hour, retaining images referenced by chat snapshots. Include this table in database backups.

WebSockets publish scoped `bag.changed` invalidations; clients reload authenticated snapshots and compare revisions. Team recipients require current `viewBag`; Personal events target affected owners’ connections. No inventory payload is broadcast to the room. `bag.presence` client frames include scope, state (`viewing`, `adding`, `editing`, `closed`), sectionId and itemId. The server derives the actor from the socket, validates referenced entries, and distributes presence only to authorized viewers. Clients heartbeat every 10 seconds; presence expires after 30 seconds and is removed on disconnect or rights loss. Presence is advisory, not an edit lock.

## Deployment and verification

Run `npm run db:update` against the intended database before deploying matching server and client. The migration is additive and repeatable; Bag starts disabled for every room. No external image-storage configuration is needed. Install the updated production dependencies, including Sharp’s native binaries, on the target platform.

Run `npm run server:test`, `npm run server:typecheck`, and `npm run build`. `npm run server:test:bag` uses local MySQL root credentials from the same environment conventions as the existing integration suite; it creates and removes a uniquely named test database. Never point integration tests at shared production infrastructure. Bag test coverage includes privacy, permission defaults/overrides, stale edits, transfers, template copies, image processing, shared image retention and scoped events.

Watch existing correlated action logs for `room.action.*Bag*`, image operations `bag.image.upload`/`bag.image.read`, cleanup failures, and committed-action publication failures.
