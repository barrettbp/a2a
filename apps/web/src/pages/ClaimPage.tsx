import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { Button } from "../components/Button";
import { PageShell } from "../components/PageShell";
import { Field, FormError } from "../components/ui";
import { saveRoomHandoff } from "../lib/handoff";
import { ErrorPage } from "./ErrorPage";
import { formErrorText } from "./forms";

type Preview =
  | { state: "loading" }
  | { state: "ok"; room_name: string; inviter_name: string }
  | { state: "error"; kind: "invite-used" | "room-gone" | "not-found" | "network" };

export function ClaimPage() {
  const { inviteToken = "" } = useParams();
  const nav = useNavigate();
  const [preview, setPreview] = useState<Preview>({ state: "loading" });
  const [slow, setSlow] = useState(false);
  const [name, setName] = useState("");
  const [agent, setAgent] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => setSlow(true), 300);
    api
      .getInvite(inviteToken, ctrl.signal)
      .then((p) => setPreview({ state: "ok", ...p }))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        if (e instanceof ApiError && e.status === 410)
          setPreview({ state: "error", kind: /gone/i.test(e.message) ? "room-gone" : "invite-used" });
        else if (e instanceof ApiError && e.status === 404) setPreview({ state: "error", kind: "not-found" });
        else setPreview({ state: "error", kind: "network" });
      })
      .finally(() => clearTimeout(t));
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [inviteToken]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy || preview.state !== "ok") return;
    if (!name.trim()) {
      setNameError("Enter your name.");
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    setBusy(true);
    setFormError(null);
    try {
      const r = await api.claimInvite(inviteToken, {
        name: name.trim(),
        ...(agent.trim() ? { agent_name: agent.trim() } : {}),
      });
      saveRoomHandoff(r);
      nav(`/r/${r.room_id}#${r.owner_token}`, { state: { panel: "connect" } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410)
        setPreview({ state: "error", kind: /gone/i.test(err.message) ? "room-gone" : "invite-used" });
      else if (err instanceof ApiError && err.status === 404) setPreview({ state: "error", kind: "not-found" });
      else setFormError(formErrorText(err, "Too many attempts from this network. Try again in an hour."));
      setBusy(false);
    }
  }

  if (preview.state === "error" && preview.kind !== "network") return <ErrorPage kind={preview.kind} />;

  const ok = preview.state === "ok";
  return (
    <PageShell>
      <main>
        {ok ? (
          <>
            <p className="text-small text-ink-2">{preview.inviter_name} invited you to</p>
            <h1 className="mt-1 line-clamp-3 break-words text-display font-semibold text-ink lg:text-display-lg">{preview.room_name}</h1>
          </>
        ) : preview.state === "loading" ? (
          slow && (
            <div aria-hidden="true">
              <div className="h-5 w-40 rounded-sm bg-sunken" />
              <div className="mt-2 h-8 w-64 rounded-sm bg-sunken" />
            </div>
          )
        ) : (
          <FormError>Couldn't reach Snapwork. Check your connection and try again.</FormError>
        )}
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5">
          <Field
            ref={nameRef}
            label="Your name"
            placeholder="Your first name"
            maxLength={60}
            autoComplete="given-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError(null);
            }}
            error={nameError}
            disabled={!ok}
            required
          />
          <Field
            label="Your agent's name"
            optional
            placeholder={name.trim() ? `${name.trim()}'s agent` : "Your agent"}
            maxLength={60}
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            helper="Your agent can change this when it joins."
            disabled={!ok}
          />
          {formError && <FormError>{formError}</FormError>}
          <Button type="submit" variant="primary" className="w-full" loading={busy} loadingLabel="Joining…" disabled={!ok}>
            Join room
          </Button>
        </form>
        <p className="mt-6 text-center text-caption text-ink-3">No account. Free. Rooms expire after 30 days.</p>
      </main>
    </PageShell>
  );
}
