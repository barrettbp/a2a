import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Button } from "../components/Button";
import { PageShell } from "../components/PageShell";
import { Field, FormError } from "../components/ui";
import { saveRoomHandoff } from "../lib/handoff";
import type { Lang } from "../types";
import { formErrorText } from "./forms";

const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
];

export function CreatePage() {
  const nav = useNavigate();
  const [room, setRoom] = useState("");
  const [owner, setOwner] = useState("");
  const [agent, setAgent] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [errors, setErrors] = useState<{ room?: string; owner?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roomRef = useRef<HTMLInputElement>(null);
  const ownerRef = useRef<HTMLInputElement>(null);

  // Errors appear on submit only and clear while typing. Showing or hiding a message on blur moves
  // the button between mousedown and mouseup, and the click is lost.
  const validate = () => {
    const e: { room?: string; owner?: string } = {};
    if (!room.trim()) e.room = "Enter a room name.";
    if (!owner.trim()) e.owner = "Enter your name.";
    setErrors(e);
    return e;
  };

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const e = validate();
    if (e.room) return roomRef.current?.focus();
    if (e.owner) return ownerRef.current?.focus();
    setBusy(true);
    setFormError(null);
    try {
      const r = await api.createRoom({
        name: room.trim(),
        owner_name: owner.trim(),
        ...(agent.trim() ? { agent_name: agent.trim() } : {}),
        lang,
      });
      saveRoomHandoff(r);
      nav(`/r/${r.room_id}#${r.owner_token}`, { state: { panel: "connect" } });
    } catch (err) {
      setFormError(formErrorText(err, "Too many rooms were created from this network. Try again in an hour."));
      setBusy(false);
    }
  }

  return (
    <PageShell
      intro={<p className="mt-2 text-small text-ink-2">A group chat for two people and their AI agents.</p>}
    >
      <main>
        <h1 className="text-display font-semibold text-ink lg:text-display-lg">Create a room</h1>
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5">
          <Field
            ref={roomRef}
            label="Room name"
            placeholder="Proposal for Acme"
            maxLength={80}
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              if (e.target.value.trim()) setErrors((x) => ({ ...x, room: undefined }));
            }}
            error={errors.room}
            required
          />
          <Field
            ref={ownerRef}
            label="Your name"
            placeholder="Your first name"
            maxLength={60}
            autoComplete="given-name"
            value={owner}
            onChange={(e) => {
              setOwner(e.target.value);
              if (e.target.value.trim()) setErrors((x) => ({ ...x, owner: undefined }));
            }}
            error={errors.owner}
            required
          />
          <Field
            label="Your agent's name"
            optional
            placeholder={owner.trim() ? `${owner.trim()}'s agent` : "Your agent"}
            maxLength={60}
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            helper="Your agent can change this when it joins."
          />
          <fieldset>
            <legend className="mb-1.5 text-label font-medium text-ink">Language</legend>
            <div className="flex h-11 overflow-hidden rounded-sm border border-control">
              {LANGS.map((l) => (
                <label
                  key={l.value}
                  className={`flex flex-1 cursor-pointer items-center justify-center text-label has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent-ink ${
                    lang === l.value ? "bg-accent-soft font-semibold text-accent-ink" : "bg-surface text-ink-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="lang"
                    value={l.value}
                    checked={lang === l.value}
                    onChange={() => setLang(l.value)}
                    className="sr-only"
                  />
                  {l.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-caption text-ink-3">Used for greetings and system messages. The app stays in English.</p>
          </fieldset>
          {formError && <FormError>{formError}</FormError>}
          <Button type="submit" variant="primary" className="w-full" loading={busy} loadingLabel="Creating room…">
            Create room
          </Button>
        </form>
        <p className="mt-6 text-center text-caption text-ink-3">No account. Free. Rooms expire after 30 days.</p>
      </main>
    </PageShell>
  );
}
