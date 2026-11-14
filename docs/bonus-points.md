# Bonus points

Room settings separate **Triggers** (earning) from **Effects** (spending). Each
matching trigger grants one point, capped at the room maximum. Groups use OR;
conditions within a group use AND and inspect the same original roll total.
Spending never evaluates triggers again.

New configurations match full canonical notation: `1D10` equals `d10`, while
`2d10`, `d10+2`, `+2d10`, and `-2d10` remain distinct. Advantage selects the
lowest die and disadvantage the highest, following Aventyr's existing convention.
Every matching effect runs in displayed order; its actions run in displayed order.
The Add Effect chooser offers result adjustments, chat messages, and notifications.
Notifications use the global snackbar queue and appear only for the player spending
the point, after the spend commits; they do not create chat messages. Optional
severity (info/success/warning/error) and duration (1000–60000 ms, or -1 to stay
until dismissed) are retained in the queue. Defaults are info and 3500 ms.
An adjustment is clamped after each action to the notation's possible range,
including its modifier. Messages are literal text, attributed to System, with a
reference to the source roll. Internal effect names never appear in chat.

One spend consumes one point regardless of matching effect count. Message-only
effects are supported. A spend with no effective action is rejected. Natural
extremes follow the room's Advanced option. The entire spend (balance, roll,
messages, and recap event) commits or rolls back together. Clients receive events
only after commit.

## Compatibility

Startup schema setup creates separate trigger/effect tables, then migrates each
room in a transaction under its room lock. The room version marker prevents
reruns from recreating entries that administrators subsequently removed.

Each old rule becomes a trigger preserving dice-face matching, selected raw die,
and inclusive `between` conditions. Only the first old spending adjustment per
dice type becomes an effect. Migrated entries retain server-owned compatibility
metadata through edits and display a compatibility hint. To use full-notation
behavior, create a new trigger/effect. Old tables and balances are retained.

Unversioned session snapshots continue using the old evaluator. New sessions
snapshot version 2, including ordered triggers and effects. Settings edits take
effect next session. Stored historical snapshots and messages are never rewritten.
Old rule-write APIs return 409 with instructions to reload.

## Deployment and verification

1. Back up the database and pause settings writes during the coordinated release;
   do not keep an older backend accepting legacy writes after migration.
2. Run `npm run db:update` to add the schema and migrate room definitions, then
   deploy the backend and frontend together. Normal startup also runs the
   idempotent schema setup. Migration failure prevents startup from completing.
3. Before reopening writes, confirm every room has `bonus_config_version = 2`.
   Before any new edits, trigger counts must equal legacy rule counts, and effect
   counts must equal distinct legacy dice types per room. Each effect's ID must
   match its first legacy rule in `created_at` order. Compare member balances to
   the backup; migration does not update them.
4. Check an active legacy session and a newly started session, then monitor room
   action errors, especially `useBonusPointOnRoll` and
   `mutateBonusConfiguration`. Retain legacy tables/readers during rollout;
   rolling back application code after new configuration writes requires restoring
   configuration from backup, because old code cannot execute version 2.

## Checks

- `npm run build`
- `npm run server:typecheck`
- `npm run server:test`
- `npm run server:test:bonus` (creates and deletes a uniquely named local MySQL database)
- `npm run test:rooms:browser`

The integration test uses local MySQL on port `MYSQL_PORT` (3306 by default),
with root password `MYSQL_ROOT_PASSWORD` (`root` by default). It never targets the
application database. Browser checks mock HTTP and room WebSocket traffic.
