# Session-owned Roll Awards

The immediately previous closed session determines eligible owners. Only its tied winners who are still room members can receive an award that remains configured. Offline members are eligible. New sessions snapshot the current award definition; later edits or deletion do not affect an existing assignment. Assignments have one use and expire at session end.

The leader selects owners before the session starts. Text, rolls, and send-as actions wait in the client queue until approval; cancelling restores local text drafts and retains generated rolls for explicit retry. Waiting actions are not persisted across page reloads. Unknown HTTP outcomes are never automatically retried.

## Interfaces

The existing `/api/rooms` action endpoint supports:

- `prepareSessionStart`: `{ roomId, userId }` → `{ preparation }`. Resolves inactivity, returns the current session or candidates and the persisted start request.
- `requestSessionStart`: same input/output; creates or reuses the room's pending request when selection is needed.
- `cancelSessionStart`: `{ roomId, userId, requestId }` → `{ startRequest }`.
- `startSession`: adds `requestId`, `previousSessionId`, `selections: [{ awardId, userId }]`, and optional `reason` (`manual` or `activity`). The leader must submit every eligible award.
- `useRollAward`: `{ roomId, userId, sessionId, assignmentId }` → `{ message, session }`. Repeated use returns the original message while the session remains active.

These actions verify the supplied user against Discord authentication or an API key. `RoomSession.ownedAwards` exposes assignment snapshots and usage state. Chat adds `roll_award_usage` with structured `rollAwardUsage` metadata. The normal `message` action accepts only text and dice.

Realtime adds `session.start_requested` and `session.start_cancelled`, and reuses session/message events for confirmed starts and usage. Structured `session_start_required` HTTP conflicts mean no message was stored and the client may re-enter the gate. No retry follows an ambiguous transport failure.

## Migration and validation

Run `npm run db:update` against the intended environment before deploying server and client together. The additive migration creates `room_session_awards`, `room_session_start_requests`, and the nullable `room_messages.roll_award_usage` column. It does not assign awards retroactively or modify existing recaps. Existing active sessions have no owned awards until their next session.

Run `npm run server:test`, `npm run server:typecheck`, and `npm run build`. `npm run server:test:awards` additionally tests real MySQL transactions, concurrency beyond the connection-pool size, idempotency, rollback, expiry, and persisted request recovery. It uses local MySQL at `127.0.0.1`, the configured `MYSQL_PORT` and `MYSQL_ROOT_PASSWORD`, and creates and removes a uniquely named temporary database. It does not use the application's database.

The awards-only history panel is removed; session recaps continue to contain the original roll-award results. Profiles show assigned awards and usage status.
