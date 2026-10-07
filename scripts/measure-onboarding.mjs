// Usage: node scripts/measure-onboarding.mjs <API_URL> "<room link of the INVITING person, with #own_...>"
// Prints how long it took from the invited person claiming their seat to their agent's greeting.
// Target (PROJECT.md section 13, Phase 5): under 2 minutes.
const [api, link] = process.argv.slice(2);
if (!api || !link) { console.error('Usage: node scripts/measure-onboarding.mjs <API_URL> "<room link with #token>"'); process.exit(2); }
const m = /\/r\/(r_[a-z2-7]+)#(own_[\w-]+)/.exec(link);
if (!m) { console.error("The link must look like https://.../r/r_xxxx#own_xxxx"); process.exit(2); }
const [, room, token] = m;
const get = async (p) => {
  const r = await fetch(`${api.replace(/\/$/, "")}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};
const view = await get(`/rooms/${room}`);
const { messages } = await get(`/rooms/${room}/messages?limit=200`);
const humans = view.seats.filter((s) => s.kind === "human");
const second = humans.find((s) => s.slot === 2);
const agent2 = view.seats.find((s) => s.kind === "agent" && s.owner_seat_id === second?.id);
if (!second?.claimed) { console.log("The second person has not joined yet."); process.exit(1); }
const joined = messages.find((x) => x.kind === "system" && x.seat_id === null && /joined the room\.|đã vào phòng\./.test(x.body));
const greet = messages.find((x) => x.seat_id === agent2?.id && x.kind === "chat");
console.log(`second person: ${second.name}   agent: ${agent2?.name ?? "(none)"}`);
console.log(`joined (claimed) at: ${joined?.created_at ?? "not found"}`);
console.log(`agent greeting at:   ${greet?.created_at ?? "not yet"}`);
if (joined && greet) {
  const s = (new Date(greet.created_at) - new Date(joined.created_at)) / 1000;
  console.log(`claim to greeting: ${s.toFixed(0)} s  ->  ${s < 120 ? "PASS (under 2 minutes)" : "FAIL (over 2 minutes)"}`);
  console.log("Start the stopwatch when the invited person opens the invite link; this number starts at the claim, so add the time they took to type their name.");
} else process.exit(1);
