import type { CollectionName, Snapshot } from './types';

/**
 * A portable description of a write. Commands return Change[]; the demo store
 * applies them in memory and the Firestore repository turns them into one
 * atomic batch. Keeping a single write path means both modes behave the same.
 */

/** Sentinel for an atomic numeric increment (maps to Firestore `increment`). */
export interface Increment {
  __op: 'increment';
  by: number;
}

export const inc = (by: number): Increment => ({ __op: 'increment', by });

export function isIncrement(value: unknown): value is Increment {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __op?: unknown }).__op === 'increment'
  );
}

export type Change =
  /** Create or fully replace a document. */
  | { kind: 'set'; collection: CollectionName; id: string; data: object }
  /** Update fields by dotted path (`evaluation.checklist.removed`). */
  | {
      kind: 'update';
      collection: CollectionName;
      id: string;
      fields: Record<string, unknown>;
    }
  /** Update fields on the team document. */
  | { kind: 'updateTeam'; fields: Record<string, unknown> };

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (typeof next !== 'object' || next === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (isIncrement(value)) {
    const current = typeof cursor[last] === 'number' ? (cursor[last] as number) : 0;
    cursor[last] = current + value.by;
  } else {
    cursor[last] = value;
  }
}

function applyFields(doc: object, fields: Record<string, unknown>) {
  for (const [path, value] of Object.entries(fields)) {
    setPath(doc as Record<string, unknown>, path, value);
  }
}

/**
 * Apply changes to a snapshot in place. Callers pass a clone when they need
 * the previous snapshot to stay untouched.
 */
export function applyChanges(snapshot: Snapshot, changes: Change[]): Snapshot {
  for (const change of changes) {
    if (change.kind === 'updateTeam') {
      applyFields(snapshot.team, change.fields);
      continue;
    }
    const list = snapshot[change.collection] as Array<{ id: string }>;
    const index = list.findIndex((doc) => doc.id === change.id);
    if (change.kind === 'set') {
      const doc = { ...(change.data as { id: string }), id: change.id };
      if (index >= 0) list[index] = doc;
      else list.push(doc);
    } else {
      if (index < 0) {
        throw new Error(`Cannot update missing ${change.collection}/${change.id}`);
      }
      applyFields(list[index], change.fields);
    }
  }
  return snapshot;
}
