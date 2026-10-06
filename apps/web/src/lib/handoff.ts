import { keys, setItem } from "../storage";
import type { CreateResult } from "../types";

/**
 * Keep what the server only returns once, so a reload of the room page still has it:
 * the invite link (localStorage, until claimed) and the connect prompt (sessionStorage, this tab only).
 * The owner token is NOT stored here: the room page reads it from the URL fragment, which also
 * lets it show the bookmark banner on first load.
 */
export function saveRoomHandoff(r: CreateResult): void {
  if (r.invite_url) setItem("local", keys.invite(r.room_id), r.invite_url);
  setItem("session", keys.prompt(r.room_id), r.connect_prompt);
}
