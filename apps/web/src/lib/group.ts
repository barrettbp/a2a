import type { MessageKind } from "../types";

export interface GroupInput {
  kind: MessageKind;
  seat_id: string | null;
  to_seat_id: string | null;
  /** epoch ms */
  ts: number;
}

export const GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * For each item: `continues` = it joins the group of the previous item,
 * `endsGroup` = the next item does not join it.
 * Only consecutive chat messages with the same sender and addressee, under 5 minutes apart, group.
 */
export function groupFlags(items: GroupInput[]): { continues: boolean; endsGroup: boolean }[] {
  const joins = (a: GroupInput | undefined, b: GroupInput | undefined) =>
    !!a &&
    !!b &&
    a.kind === "chat" &&
    b.kind === "chat" &&
    a.seat_id !== null &&
    a.seat_id === b.seat_id &&
    a.to_seat_id === b.to_seat_id &&
    b.ts - a.ts < GROUP_GAP_MS &&
    b.ts - a.ts >= 0;
  return items.map((it, i) => ({
    continues: joins(items[i - 1], it),
    endsGroup: !joins(it, items[i + 1]),
  }));
}
