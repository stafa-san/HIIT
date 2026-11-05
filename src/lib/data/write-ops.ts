import { isIncrement, type Change } from '@/lib/domain/changes';

/**
 * SDK-agnostic Firestore writes. The browser (firebase/firestore) and the
 * server (firebase-admin) each turn these into a batch with their own API.
 */
export interface WriteOp {
  op: 'set' | 'update';
  path: string;
  data: Record<string, unknown>;
}

export const teamPath = (teamId: string) => `teams/${teamId}`;

export function toWriteOps(
  changes: Change[],
  teamId: string,
  makeIncrement: (by: number) => unknown,
): WriteOp[] {
  const convert = (fields: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      out[key] = isIncrement(value) ? makeIncrement(value.by) : value;
    }
    return out;
  };
  return changes.map((change): WriteOp => {
    if (change.kind === 'updateTeam') {
      return { op: 'update', path: teamPath(teamId), data: convert(change.fields) };
    }
    const path = `${teamPath(teamId)}/${change.collection}/${change.id}`;
    if (change.kind === 'set') return { op: 'set', path, data: { ...change.data, id: change.id } };
    return { op: 'update', path, data: convert(change.fields) };
  });
}
