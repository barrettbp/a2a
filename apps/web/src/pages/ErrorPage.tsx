import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";

export type ErrorKind = "invite-used" | "room-gone" | "not-found" | "no-access" | "no-key";

const COPY: Record<ErrorKind, { title: string; body: string }> = {
  "invite-used": {
    title: "This invite was already used.",
    body: "Invites work once. If you joined earlier, open the room link you bookmarked. Otherwise ask the person who invited you.",
  },
  "room-gone": { title: "This room is gone.", body: "Rooms are deleted 30 days after they are created." },
  "not-found": { title: "Page not found.", body: "Check the link and try again." },
  "no-access": {
    title: "You don't have access to this seat.",
    body: "Open the room link you bookmarked when you created or joined the room. A lost link can't be recovered.",
  },
  "no-key": {
    title: "Open the link you were given.",
    body: "Your room link contains your key. Open the link you bookmarked when you created or joined the room. A lost link can't be recovered.",
  },
};

export function ErrorPage({ kind }: { kind: ErrorKind }) {
  const c = COPY[kind];
  useEffect(() => {
    const prev = document.title;
    document.title = `${c.title} · Snapwork`;
    return () => {
      document.title = prev;
    };
  }, [c.title]);
  return (
    <PageShell card={false}>
      <main>
        <h1 className="text-display font-semibold text-ink lg:text-display-lg">{c.title}</h1>
        <p className="mt-2 text-body text-ink-2">{c.body}</p>
        <Link to="/" className="btn btn-primary mt-6 w-full lg:w-auto">
          Create a new room
        </Link>
      </main>
    </PageShell>
  );
}

export function NotFoundPage() {
  return <ErrorPage kind="not-found" />;
}
