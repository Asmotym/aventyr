export interface DiceRoll {
  dice: string;
  result: number;
  rolls: number[];
  total: number;
  critical?: boolean;
  fumble?: boolean;
  description?: string;
}

export interface DiceRollOptions {
  advantage?: boolean;
  disadvantage?: boolean;
  modifier?: number;
  criticalRange?: number;
  fumbleRange?: number;
}

export type DiceRollMode = 'sum' | 'advantage' | 'disadvantage';

/**
 * Rolls a single die of specified sides
 * @param sides - Number of sides on the die
 * @returns Random number between 1 and sides
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Rolls multiple dice of the same type
 * @param count - Number of dice to roll
 * @param sides - Number of sides on each die
 * @returns Array of individual roll results
 */
export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

/**
 * Parses dice notation (e.g., "2d6", "1d20", "3d8+2")
 * @param notation - Dice notation string
 * @returns Parsed dice parameters
 */
export function parseDiceNotation(notation: string): {
  count: number;
  sides: number;
  modifier: number;
  mode: DiceRollMode;
} {
  const regex = /^([+-])?(\d+)?d(\d+)([+-]\d+)?$/i;
  const match = notation.toLowerCase().match(regex);
  
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }
  
  const prefix = match[1];
  const count = parseInt(match[2] || '1');
  const sides = parseInt(match[3]);
  const modifier = parseInt(match[4] || '0');
  const mode: DiceRollMode = prefix === '+'
    ? 'advantage'
    : prefix === '-'
      ? 'disadvantage'
      : 'sum';

  if (count < 1 || sides < 1) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  if (mode !== 'sum' && count === 1) {
    throw new Error(`Advantage and disadvantage require rolling more than one die: ${notation}`);
  }
  
  return { count, sides, modifier, mode };
}

/**
 * Rolls dice based on standard RPG notation
 * @param notation - Dice notation (e.g., "2d6", "1d20+3", "3d8-1")
 * @param options - Additional rolling options
 * @returns Complete dice roll result
 */
export function rollDiceNotation(
  notation: string, 
  options: DiceRollOptions = {},
  description?: string
): DiceRoll {
  const { count, sides, modifier, mode: parsedMode } = parseDiceNotation(notation);
  const mode = resolveRollMode(parsedMode, options);
  const rolls = rollDice(count, sides);
  const selectedRoll = selectRollResult(rolls, mode);
  const baseTotal = mode === 'sum'
    ? rolls.reduce((sum, roll) => sum + roll, 0)
    : selectedRoll;
  const total = baseTotal + (options.modifier || 0) + modifier;
  const normalizedDescription = description?.trim() || undefined;
  
  const critical = typeof options.criticalRange === 'number'
    ? selectedRoll <= options.criticalRange
    : undefined;
  const fumble = typeof options.fumbleRange === 'number'
    ? selectedRoll >= options.fumbleRange
    : undefined;
  
  return {
    dice: notation,
    result: total,
    rolls,
    total,
    critical,
    fumble,
    description: normalizedDescription
  };
}

export interface InlineDiceCommand {
  notation: string;
  description?: string;
}

/**
 * Attempts to extract an inline dice command from a free-form message.
 * Supports inputs like "1d20 Attack roll" or just "1d20".
 */
export function parseInlineDiceCommand(input: string | null | undefined): InlineDiceCommand | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^([+-]?[0-9]*d[0-9]+(?:[+-][0-9]+)?)(?:\s+(.*))?$/i);
  if (!match) {
    return null;
  }

  const notation = match[1];
  try {
    parseDiceNotation(notation);
  } catch {
    return null;
  }

  const description = match[2]?.trim();
  return {
    notation: notation.toLowerCase(),
    description: description?.length ? description : undefined,
  };
}

function resolveRollMode(parsedMode: DiceRollMode, options: DiceRollOptions): DiceRollMode {
  if (parsedMode !== 'sum') {
    return parsedMode;
  }
  if (options.advantage && options.disadvantage) {
    throw new Error('Cannot roll with both advantage and disadvantage.');
  }
  if (options.advantage) {
    return 'advantage';
  }
  if (options.disadvantage) {
    return 'disadvantage';
  }
  return 'sum';
}

function selectRollResult(rolls: number[], mode: DiceRollMode): number {
  if (!rolls.length) {
    throw new Error('At least one die must be rolled.');
  }
  if (mode === 'advantage') {
    return Math.min(...rolls);
  }
  if (mode === 'disadvantage') {
    return Math.max(...rolls);
  }
  return rolls[0];
}
