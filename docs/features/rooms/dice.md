# Dice, categories and critical rules

## Where to work

| Responsibility | Source |
| --- | --- |
| Dice panel and management dialog | [components/dice/](../../../src/features/rooms/components/dice/) |
| Dice/settings managers | [useRoomDiceManager.ts](../../../src/features/rooms/composables/useRoomDiceManager.ts), [useCriticalRules.ts](../../../src/features/rooms/composables/useCriticalRules.ts) |
| Parsing, inline commands and rolling | [dice.utils.ts](../../../src/features/rooms/utils/dice.utils.ts) |
| Critical calculation | [room-criticals.utils.ts](../../../src/features/rooms/utils/room-criticals.utils.ts) |
| Authoritative action handling | [rooms.service.ts](../../../server/features/rooms/rooms.service.ts), [room-messages.service.ts](../../../server/features/rooms/chat/room-messages.service.ts) |
| Dice/category persistence | [room-dices.table.ts](../../../server/features/rooms/dice/repositories/room-dices.table.ts), [room-dice-categories.table.ts](../../../server/features/rooms/dice/repositories/room-dice-categories.table.ts) |

## Behavior to preserve

- Reuse the parser for notation and inline dice commands. Preserve count, sides, signed modifiers, descriptions and the original individual rolls; do not derive everything from the final total.
- Aventyr advantage takes the lowest die and disadvantage the highest. This affects critical rules and bonus conditions too; do not replace it with another game's convention.
- Keep personal ownership boundaries for dice and categories alongside room management permissions. Renaming another user's category is not implied by seeing it.
- Critical/fumble rules and bonus configuration are distinct. Preserve active session snapshots: editing room settings applies to future sessions, without rewriting existing rolls or recaps.
- Rolling passes through the session-start gate. Cancellation retains the generated roll for explicit retry; an unknown HTTP outcome must not generate or send another roll automatically.

Keep pure calculations in utilities, editor state in the existing managers, persistence and authorization on the server. If notation semantics change, inspect [bonus points](bonus-points.md) and [session awards](sessions.md) before changing only the panel.

## Verification

Run `npm run test:frontend` for dice/critical calculations, then `npx playwright test tests/browser/rooms/dice.spec.ts tests/browser/rooms/settings.spec.ts`. Add server tests for validation/permissions or message changes and run `npm run build`. Include signed notation, multi-die modes, boundaries and invalid input; use deterministic random values in logic tests.
