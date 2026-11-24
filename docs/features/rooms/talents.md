# Room talent trees

Talents combines tree definitions, per-member access and player progression. Keep visual editing separate from authoritative allocation and historical payment records.

## Where to work

| Responsibility | Source |
| --- | --- |
| Settings, viewer, editor and canvas | [components/talents/](../../../src/features/rooms/components/talents/) |
| Client requests, images and invalidation recovery | [talents.service.ts](../../../src/features/rooms/services/talents.service.ts) |
| Authorized reads/mutations, wallets and images | [room-talents.service.ts](../../../server/features/rooms/talents/room-talents.service.ts) |
| Operation and definition contracts | [talents.types.ts](../../../shared/rooms/talents.types.ts) |
| Validation, progression and compatibility | [talents.ts](../../../shared/rooms/talents.ts) |
| Versioned import/export | [talent-transfer.ts](../../../shared/rooms/talent-transfer.ts), [TalentTreeTransfer](../../../src/features/rooms/components/talents/TalentTreeTransfer.component.vue) |
| Feature styles | [talents.css](../../../src/assets/styles/features/rooms/talents.css) |

## Access, revisions and transactions

Talents starts disabled. Creator/admin/DM default to `manageTalentTrees`; overrides apply except to creators. Managers edit definitions, distribute points and configure member visibility. Players see only authorized trees/nodes and their own progress. Hidden or archived trees retain investments but reject player mutations.

The authenticated `talents` action takes room/actor/operation and a current talent revision for writes. Verify membership on reads and writes; serialize writes with room administration. Responses are authoritative for revision, balances and availability. Never disclose hidden definitions, names, progress or wallets in player payloads.

Incompatible edits/deletion return `resetRequired` without writing. Review affected players/refunds, then resubmit with `confirmReset: true` and the same revision. Preserve the editor’s opening revision; after a conflict, reopen against the latest definition rather than silently retrying an old draft. Point removal must not silently cascade.

Committed writes publish payload-free `talents.updated`. Refetch authorized state on invalidation, permission change and reconnect; never broadcast private builds or definitions in the event.

## Costs, conditions and refunds

Each rank inherits its node cost (default 1), optionally overridden per rank; zero is free. Trees accept tree points, global points or both, spending tree points first. Global assignment caps do not cap refunds; tree balances have no cap. Point earning is manual. Passive/Active categories are visual metadata, with no activation, cooldown or automatic roll effects.

Store each rank’s actual `{ tree, global }` payment. Normalize legacy `"tree"`/`"global"` entries as one-point payments on load and save canonically on mutation. Cost edits never reprice purchases/refunds. Invested-point conditions and caps use payments; rank prerequisites/progress count ranks, including free ranks. Respec refunds original currencies unless the specialization explicitly disables refunds. Deleted-tree balances remain attached to their original tree ID; global refunds are immediately available.

Graphs are directed and acyclic. Parent and explicit prerequisites support all/any groups. Validate conditions, specialization caps and visibility on the server as well as the UI. Details show unmet groups without revealing hidden talent names.

Automatic unlock grants only the first rank free when prerequisites, node/first-rank conditions, visibility and specialization allow it. Reads/mutations reconcile chains and linked access. Automatic ranks contribute zero invested points and cannot be individually refunded; losing prerequisites withdraws them. Paid later ranks/descendants still prevent invalid parent refunds. Reset regrants eligible roots. Disabling automatic unlock requests reset confirmation if paid ranks would become invalid; preserve existing historical payments.

## Linked trees and organization

Trees can be available by default or require manual/earned access. A gateway node’s first acquired rank grants access while retained. Refunding/resetting/removing the link withdraws that grant, but another acquired node or manual grant can keep access. Explicit per-member Hide always wins. Recompute earned access, including legacy permanent grants; hiding never deletes builds or wallets.

Parent trees organize navigation only. Reject cycles and cross-room references. Promote accessible children when a parent is inaccessible or deleted. Deleting a destination clears links/grants to it. Keep manual grants distinct from earned access in management controls.

## Canvas and editing

Keep editor changes in the local tree draft until Save. Sidebar Apply commits its local fields; Cancel discards them without undoing independent canvas moves. Context panels are deliberately nonmodal so the canvas remains usable; Escape closes a sidebar before the editor. Provide touch/keyboard actions alongside right-click and drag.

- Classic, Centered and Free layouts share validation. Centered layouts accept zero or 2–50 starting nodes matching the root count. Free subtree regions cannot overlap; invalid drops/resizes restore original positions.
- Subtree moves carry contained nodes. Border/corner resizing preserves node positions, respects minimum bounds and recomputes membership after valid drops. Retain manual bounds, including in Centered layouts.
- Preserve pan/zoom coordinate transforms, 20-unit snapping, major-grid/subtree-center alignment and keyboard alternatives. Screen-space snapping tolerances must remain consistent at different zoom levels. Double-click creation uses the pointer position without rearranging existing nodes.
- Connection endpoints save border choices. Reject cycles, duplicates and self-links. Per-connection line/arrow overrides inherit independently from tree defaults; resetting one must not reset the other.
- Node colors, rank names/descriptions, active/passive shapes and decorative shapes survive save/export/player rendering. Decorations are plain-text visual metadata, may extend outside subtrees and never affect allocation or membership.
- Viewer framing initially fits the tree; later resize must preserve user pan/zoom. Fit View includes decorations. Keep bounded details/navigation, mobile controls and allocation actions visible; the viewer has no editor grid.

## Images, import/export and archives

Talent images have dedicated authenticated endpoints and do not depend on Bag enablement. Apply the static JPEG/PNG/WebP 5 MB validation. Unreferenced uploads are uploader-only while management rights remain; player access follows currently visible references. Use the image component/service and object-URL cleanup.

The versioned `aventyr-talent-tree` package includes the complete definition and deduplicated base64 images, excluding builds/balances. Import validates before confirmation and reports counts; limit input to 50 MB and rooms to 50 trees. New imports always get a new tree identity while preserving internal graph references. Require an explicit parent choice when the original is unavailable; warn before disconnecting unavailable external links. Plain JSON imports may fall back to icons for missing images. Upload/remap bundled images only after confirmation.

Duplicate-name detection normalizes Unicode presentation, case and whitespace. Offer a numbered name or explicit same-name copy; never overwrite another tree. Keep manual clipboard fallbacks, reject invalid JSON before save, and test full option/appearance/rank-cost round trips.

Archive hides the tree but preserves definition, balances, builds, hierarchy and visibility. Archives remain manageable with Talents disabled and count toward the 50-tree limit. Restore preserves explicit Hide. Archived exports import as new active copies. Permanent deletion requires confirmation before a request, then a second refund/reset review when paid progress or specialization is affected; cancellation leaves the tree intact.

## Migration and verification

Run `npm run db:update` before deploying matching client/API versions. Talent tables are additive/idempotent and preserve other room settings/balances. JSON payment/definition additions retain legacy readers; do not rewrite purchases during migration.

Run `npm run test:frontend`, `npm run test:talents:browser`, `npm run server:test:talents`, `npm run server:typecheck` and `npm run build`. Test revision conflicts, exact historical refunds, hidden-state filtering, automatic chains, archive/restore and import/export when changing domain behavior. For canvas work, include zoomed dragging, overlap rollback, keyboard/touch, focus and mobile overflow. See [testing](../../guides/testing.md) for MySQL and browser setup.
