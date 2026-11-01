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

Opening Bag sends an authenticated `bag.subscribe` frame (`scope`, optional `requestId`) on the existing room WebSocket. The server derives room/user identity from that connection and immediately sends `bag.snapshot` plus the current `bag.presence`. Switching scopes replaces the subscription; closing Bag sends `bag.unsubscribe`. No manual reload or browser polling is needed. The initial read, updates, and interaction presence all arrive over the socket. Existing authenticated HTTP actions still perform transactional writes; image uploads remain on the dedicated HTTP endpoint.

Committed item, section, template and transfer actions push complete snapshots to affected subscribers. Team recipients require current `viewBag`; Personal snapshots and presence only reach that owner's connections. Snapshots are stored reactively in the room store and applied independently of chat/session hydration. Bag/entity revisions prevent older responses from overwriting newer state, and live updates never replace an unsaved editor draft. Reconnecting replays the active subscription and latest interaction state. Failed subscriptions return scoped `bag.error` events; access loss clears cached inventory and presence.

The server also checks revisions of subscribed bags every two seconds to recover missed publication and administrative/database changes. Out-of-band writes must increment both affected entity revisions and `room_bags.revision` in the same transaction. Only changed bags generate new snapshots, and every delivery rechecks current membership and Bag permissions. No data is sent to clients who are not subscribed.

`bag.presence` client frames include scope, state (`viewing`, `adding`, `editing`, `closed`), target (`bag`, `item`, `section`, `template`), sectionId, itemId, and templateId. The server derives the actor from the socket and validates referenced entries against its authorized bag. Avatars, row/section highlights and adding indicators update immediately on interaction changes. Clients heartbeat every 10 seconds; presence expires after 30 seconds and clears on close, disconnect, or rights loss. Presence is advisory, not an edit lock. Personal activity stays private.


## Deployment and verification

The realtime upgrade needs matching server and client versions: restart/deploy the backend and reload the client together. Bag subscriptions and snapshots replace the previous reload invalidations. No additional database migration is required for this realtime upgrade.

Run `npm run db:update` against the intended database before deploying matching server and client. The migration is additive and repeatable; Bag starts disabled for every room. No external image-storage configuration is needed. Install the updated production dependencies, including Sharp’s native binaries, on the target platform.

Run `npm run server:test`, `npm run server:typecheck`, and `npm run build`. `npm run server:test:bag` uses local MySQL root credentials from the same environment conventions as the existing integration suite; it creates and removes a uniquely named test database. Never point integration tests at shared production infrastructure. Bag test coverage includes privacy, permission defaults/overrides, stale edits, transfers, template copies, image processing, shared image retention and scoped events. The realtime integration suite uses real authenticated sockets for multiple users and verifies snapshot push, interaction presence, reconnect, external revision recovery and access revocation. Client tests cover subscription authentication order, reconnect replay, stale state, scope boundaries and chat-hydration independence.

Watch existing correlated action logs for `room.action.*Bag*`, image operations `bag.image.upload`/`bag.image.read`, cleanup failures, and committed-action publication failures.
