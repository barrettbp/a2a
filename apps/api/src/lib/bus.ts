export type RoomEvent =
  | { type: "message"; id: number; data: unknown }
  | { type: "seat"; data: unknown }
  | { type: "approval"; data: unknown };

/** In-process fan-out to SSE connections. One API process only (see PROJECT.md §3). */
export class RoomBus {
  private subs = new Map<string, Set<(e: RoomEvent) => void>>();

  subscribe(roomId: string, fn: (e: RoomEvent) => void): () => void {
    let set = this.subs.get(roomId);
    if (!set) this.subs.set(roomId, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.subs.delete(roomId);
    };
  }

  emit(roomId: string, e: RoomEvent) {
    for (const fn of this.subs.get(roomId) ?? []) fn(e);
  }
}
