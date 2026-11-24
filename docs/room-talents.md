# Room talent trees

Talent trees start disabled in existing and new rooms. Run `npm run db:update`
before deploying the matching server and client. The four additive talent tables
are created idempotently; existing room settings and bonus points are preserved.

Creator, admin and DM have `manageTalentTrees` by default. Room administration can
override it, except for creators. Managers edit trees, distribute points and set
per-member visibility. Other members access only their visible trees and their
own progress. Hidden trees preserve investments and cannot be mutated by players.

The authenticated `POST /api/rooms` action `talents` accepts `roomId`, actor
`userId`, `op`, and, for writes, the current room talent `revision`. Operations and
payloads are defined in `server/core/types/talents.types.ts`. All reads and writes
check current room membership. Writes serialize with room administration and
reject stale revisions. Read results contain authoritative balances, node
availability and a revision. Manager results also include definitions, member
balances and visibility; player results exclude hidden nodes and trees.

Each rank inherits its node’s point cost (default 1), with an optional rank
override; zero means free. Trees accept tree points, global points, or both
(tree points first, then global points for any remainder). One payment record
per purchased rank stores both currency amounts for exact historical refunds. Global caps apply
to balance assignments; refunds may exceed them. Tree points have no balance cap.
Point earning is manual. Talents do not automatically modify rolls or awards.

Graphs are directed and acyclic. Explicit requirements supplement parent
requirements; both support all/any groups. Free-layout rectangles cannot overlap,
and a node belongs to its containing rectangle. Centered trees accept zero or
2–50 starting nodes; nonzero counts must match their root count. Use the editor's
Generate starting nodes control to seed roots, then connect descendants.

Incompatible edits and tree deletion first return `resetRequired` without writing.
Resubmit the same operation with `confirmReset: true` and the same revision after
reviewing the affected members/refunds. The editor retains its opening revision,
so a newer save cannot silently be overwritten by an older draft. Reopen an
editor after a revision conflict to load the latest definition. Deleted trees'
tree-point balances remain stored against the original tree ID; global refunds
remain immediately available. Respec refunds original currencies unless the
specialization option explicitly disables refunds. Point removal never cascades.

Images use separate authenticated talent endpoints, with the same 5 MB static
JPEG/PNG/WebP validation as bag images. They do not require the bag feature.
Unreferenced uploads are available only to their uploader while they retain
management rights. Player image access follows current visible tree references.

Committed mutations publish a payload-free `talents.updated` invalidation. Clients
refetch authorized state after invalidations, permission changes and reconnects.
Definitions and private player progress are never sent in these broadcasts.

In the tree editor, right-click a talent or subtree to open its right-hand sidebar. Apply edits
to the local tree draft, then use the tree editor’s Save action to persist them.
Cancelling the sidebar leaves its unapplied edits out of the draft. Canvas moves
remain independent of sidebar field edits and are preserved when applying them. Touch and keyboard users can use
the selected-talent edit action or the subtree heading/list to open the same forms. The sidebar stays inside the room editor without a backdrop;
Escape closes it before closing the tree editor.

Drag a subtree’s move handle to move its region and member talents together on
the 20-unit grid. Arrow keys on the handle move one grid step. Free-layout drops
that overlap another subtree restore the original region and node positions.
Drag any subtree border or corner to resize its width and height. Resizing snaps
to the grid and keeps talents in place, with a minimum size of 80 × 80. Free-layout
overlaps roll back the resize; membership is recomputed after a valid drop.
Arrow keys also resize a focused border handle. Manual bounds are saved with the
tree, including for Centered layouts, and stay synchronized with an open sidebar.

Right-dragging pans the canvas, including when starting over a talent or subtree;
a stationary right-click on a player-view talent retains its point-removal action.
Mouse-wheel zoom works while hovering over or focusing the canvas.

Hover or focus a talent to show connector dots on its four borders. Drag a dot
onto a border dot of another talent to make a parent-to-child connection. The
chosen source and target borders are saved and used in the player view.
Self-links, duplicate connections and cycles are rejected. Select a connection
line to show its Remove connection action and Rounded, Square, and Straight style
buttons. Arrow buttons choose a triangle, chevron, diamond, or hide the arrowhead.
Each connection’s line and arrow styles are saved and used in the player view. Keyboard users can activate a connector,
then activate the target dot; Escape cancels. Connection edits also update an
open talent sidebar without discarding pending field edits.

Validation:

- `npm run server:test`, `npm run server:typecheck`, `npm run build`
- `npm run server:test:talents` (creates/removes an isolated local MySQL database)
- `npm run test:talents:browser`

Each rank can have an optional name and description above its conditions in the
node editor. The node hover popup shows these entries below its general description;
unreached ranks have greyed-out names and descriptions, updating as points are
allocated or removed. Existing ranks without this text keep their current behavior.

The player viewer fills the available screen height and initially fits the
selected tree with a margin. Its header groups the tree title, talent count,
invested points, Fit View, and Reset Tree. Unspent global and tree point
balances sit in the tree navigation rather than a separate title row. The editor
keeps its larger navigation workspace for building trees.

The viewer stays within the available screen height, including when a talent is
selected. Tree navigation and long talent details have bounded content areas;
allocation controls remain visible. The viewer canvas has no grid, while the
editor retains its grid. Pan and zoom inside the canvas to explore larger trees.

The viewer canvas fills the remaining screen height. Initial framing and Fit View
fit the tree; subsequent zooming and panning remain under the user’s control
through viewport resizes. Viewer zoom supports up to 800%.

Dragging a node inside a subtree snaps its center to the subtree’s horizontal
and vertical centerlines within 10 screen pixels. Alignment guides appear while
snapped; exact center alignment takes precedence over the 20-unit grid. Subtree
bounds remain stable during a drag, including auto-sized centered subtrees.

Node centers also snap to the major 100-unit grid lines and intersections within
10 screen pixels, with solid alignment guides. Subtree centerlines take priority;
otherwise dragging falls back to the minor 20-unit grid away from major lines.

Tree Appearance includes default connection line and arrow styles. Existing and
new connections without overrides inherit these settings in both editor and viewer.
Per-connection styling takes precedence independently for line and arrow styles;
the reset action beside each style group restores inheritance for that property.

Unmet prerequisites appear in node hover popups and talent details, grouped by
parents, node conditions and next-rank conditions. Each group states whether all
or any requirement must be met and shows current/required ranks or invested points.
Satisfied groups are omitted, and hidden talent names remain undisclosed.
Condition and visibility-condition node selectors list nonempty subtree groups,
followed by Ungrouped for nodes without a valid subtree; headers cannot be selected.

Decorative shapes are available from the editor toolbar and Shapes tab. Rectangle,
rounded rectangle, ellipse and diamond forms support multiline text, color, text
size and dimensions. The Shapes tab lists shapes; selecting one, using its pencil
action, or right-clicking it opens the same side panel as node editing. Edits preview on the canvas; Apply
commits them to the tree draft and Cancel discards them. The panel offers visual
shape buttons, color swatches, a text-size slider and whole-label bold, italic,
underline and strikethrough toggles. Text stays centered in every form. Shapes use
the same eight border and corner resize handles as subtrees, with grid snapping and arrow-key
support. Use the move handle to position them anywhere, including outside subtrees.
Shape centers snap to subtree centerlines and major grid lines with the same tolerance,
priority and alignment guides as nodes. Fit View includes their bounds. Shapes are saved with the tree and displayed without editing controls in
the player viewer; they do not affect allocation, ranks, prerequisites or subtree
membership. Shape text is rendered as plain text. Existing trees without a
`decorations` field remain valid.

Node editing includes an Appearance section for the icon, image and color scheme.
The sixteen swatches match shapes, with warm, cool and neutral options including
orange, amber, yellow, lime, teal, cyan, indigo, pink, rose and brown. Colors
apply to node borders, icons, investment fills and progress indicators, as well as
the viewer detail emblem. Filled nodes use contrasting icon colors. Nodes without
a saved color keep the theme defaults. Color changes do not affect allocation,
costs or existing builds.

## Linked trees, organization and variable costs

Trees may be available by default or restricted to manual/earned access. Acquiring
a node’s first rank grants access while that node remains acquired. Refunding its
last rank, resetting the source tree, or removing the link hides the linked tree
unless another acquired node or a manual grant still grants access. The linked
tree’s build and wallet remain intact and return when access is restored. Reads
recompute earned access, including for older stored permanent grants. Explicit
per-member Hide always blocks use. The access dialog separates manual grants from
active talent unlocks. Reads filter unavailable definitions, states, progress and
balances; all player mutations enforce the same effective access.

The viewer navigation gives each title a full-width single line above its icon,
progress and point badge. Acquired gateway talents add a floating Unlocked paths
dock inside the canvas, with target-tree links and source talent labels. Links
appear only for accessible targets and disappear when the unlocking rank is gone.
On narrow screens the dock becomes a compact strip below the viewport so it does
not cover talents.

Parent trees provide organization only. The viewer supports collapsible nested
navigation; inaccessible parents are omitted and accessible children promoted.
Cycles and references outside the room are rejected. Deleting a parent promotes
its children; deleting a destination clears links and grants pointing to it.

Progress retains one entry per rank, including free ranks. New entries are
`{ tree: number, global: number }`; legacy `"tree"`/`"global"` entries normalize to
one-point records on load and are saved in canonical format on the next mutation.
No table migration is needed for these JSON additions. Deploy matching client
and server versions together. Point-spent conditions, subtree caps and invested
totals use actual historical payments; prerequisites and progress bars count ranks.
Changing costs never reprices existing purchases or their refunds.

Nodes are Passive talents by default, or may be marked Active skills. Categories
are visual metadata only: passive nodes are circular, active nodes are angular
squares, with shield/lightning badges and hover/detail labels. No skill activation, cooldown or roll effects are implemented.

Double-click empty editor canvas (including inside a subtree) to open a new talent
at the pointer, accounting for pan and zoom. Apply keeps that position in every
layout without rearranging existing talents; Cancel discards the new talent.

The node Conditions section offers Automatic unlock below Points per rank. It
awards only the first rank for free once parent rules, node and first-rank
conditions, visibility and specialization are satisfied; roots unlock directly
when otherwise eligible. Later ranks retain their configured costs. Reads and
mutations reconcile automatic chains and linked-tree access without spending
points. Automatic ranks cannot be individually refunded and contribute zero
invested points. Removing their prerequisites withdraws free automatic ranks;
paid later ranks or descendants still block an invalid parent refund. Resetting
regrants eligible automatic roots. Existing paid ranks retain their historical
payments. Disabling automatic unlock removes free grants, requesting the normal
reset confirmation if purchased ranks would become invalid. Inaccessible linked
tree progress stays intact.

Each settings card offers Export tree → Download JSON or Copy JSON. The versioned
`aventyr-talent-tree` package contains the complete tree definition and deduplicated
base64 images, without player balances or builds. All options, rank metadata and
costs, automatic unlock settings, node colors, connector styles, subtree bounds,
conditions and decorative shapes are retained.

The Add Talent Tree dialog offers file and clipboard import beneath the layout
choices. Imports validate first and show node, rank, connection, subtree, shape and
image counts before confirmation. Imported trees always get a new tree ID, keeping
internal graph IDs and references intact. When the original parent is missing, the review requires an explicit choice of
another parent or no parent before importing. Unavailable node links to other
trees are disconnected only after a visible warning. Plain tree JSON is also
accepted; unavailable image references show a warning and fall back to icons.
Bundled images are uploaded to the destination room after confirmation, with
shared image references remapped consistently.

A duplicate-name check ignores case, repeated whitespace and Unicode presentation.
It prompts for a new name with a numbered suggestion, or explicitly allows keeping
the original name for a separate tree. Existing definitions and builds are never
overwritten. Clipboard permission failures offer manual paste/copy, invalid JSON
never reaches save, and imports are bounded to 50 MB and the existing 50-tree limit.

Tree cards have a Tree actions menu with Archive and Delete. Archive hides the
tree from the active settings gallery and player viewer while retaining its
complete definition, balances, builds, hierarchy and per-member visibility.
Open archives at the end of the settings screen switches to archived cards using
the exact same card markup and styling. Their menu offers Restore and Delete;
restoring returns the tree and its saved progress. Archives remain manageable
when the feature is disabled and count toward the existing 50-tree room limit.
Imports of archived exports create active copies with new tree identities.

Permanent deletion always opens a confirmation dialog before a delete request is
sent. If purchased ranks or a specialization would be affected, the same dialog
shows the existing refund review and requires another confirmation. Cancelling
leaves the tree intact. Archive/restore is manager-only, revision-checked and
broadcast using the existing talent invalidation event. Archived trees cannot be
allocated, refunded or reset by players; restoring also preserves explicit Hide.
