import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import { useResonanceProfile } from "../hooks/useResonanceProfile";
import {
  generateSessionCode,
  isValidSessionCode,
} from "../lib/sessionCode";
import { Button, Card, Eyebrow } from "../components/ui";
import { ConvergenceGlyph } from "../components/ConvergenceGlyph";
import { EcosystemSwitcher } from "../components/EcosystemSwitcher";
import { SiteFooter } from "../components/SiteFooter";

export function Home() {
  const { user } = useUser();
  const status = useResonanceProfile();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  function createSession() {
    navigate(`/s/${generateSessionCode()}`);
  }

  function joinSession(e: React.FormEvent) {
    e.preventDefault();
    const normalized = joinCode.trim().toUpperCase();
    if (!isValidSessionCode(normalized)) {
      setJoinError("Codes are 6 characters, letters and digits only.");
      return;
    }
    setJoinError(null);
    navigate(`/s/${normalized}`);
  }

  return (
    <main className="min-h-screen bg-bg p-6 text-text">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-accent">
            <ConvergenceGlyph size={20} />
          </span>
          <Eyebrow>Ensemble</Eyebrow>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden sm:block">
            <EcosystemSwitcher current="ensemble" />
          </div>
          <UserButton
            appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }}
          />
        </div>
      </header>

      <section className="mx-auto mt-16 max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-light tracking-tight">
            Hi {user?.firstName ?? "there"}.
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Start a session, or join one with a code.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <Card.Eyebrow>New session</Card.Eyebrow>
            <Card.Body>
              <p className="text-sm text-text-muted">
                Get a fresh 6-character code to share.
              </p>
              <Button
                variant="primary"
                onClick={createSession}
                className="mt-4 w-full"
              >
                Create session
              </Button>
            </Card.Body>
          </Card>

          <Card>
            <Card.Eyebrow>Join with code</Card.Eyebrow>
            <Card.Body>
              <form onSubmit={joinSession}>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="ABC123"
                  maxLength={6}
                  className="min-h-11 w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-center text-lg tracking-[0.4em] uppercase text-text placeholder:text-text-muted/40 focus:border-border-strong focus:outline-none sm:min-h-0"
                />
                {joinError && (
                  <p className="mt-2 text-xs text-warn">{joinError}</p>
                )}
                <Button type="submit" className="mt-4 w-full">
                  Join
                </Button>
              </form>
            </Card.Body>
          </Card>
        </div>

        <Card>
          <Card.Eyebrow>Resonance profile</Card.Eyebrow>
          <Card.Body>
            <ProfileBody status={status} />
          </Card.Body>
        </Card>
      </section>

      <SiteFooter />
    </main>
  );
}

function ProfileBody({
  status,
}: {
  status: ReturnType<typeof useResonanceProfile>;
}) {
  switch (status.state) {
    case "idle":
    case "loading":
      return <p className="text-sm text-text-muted">Loading your profile…</p>;
    case "no-profile":
      return (
        <p className="text-sm text-text-muted">
          No Resonance profile yet, finish onboarding in Resonance to use
          Ensemble.
        </p>
      );
    case "error":
      return (
        <p className="text-sm text-warn">
          Couldn't load your profile: {status.message}
        </p>
      );
    case "ready":
      return (
        <div className="space-y-2 text-sm">
          <p className="text-text-muted">
            {status.data.themes.length} themes ·{" "}
            {status.data.archetypes.length} archetypes
          </p>
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {status.data.themes.slice(0, 8).map((t) => (
              <li
                key={t.label}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-text"
              >
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      );
  }
}
