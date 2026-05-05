import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import { useResonanceProfile } from "../hooks/useResonanceProfile";
import {
  generateSessionCode,
  isValidSessionCode,
} from "../lib/sessionCode";

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
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <p className="font-display text-[11px] tracking-[0.28em] text-text-muted uppercase">
          Ensemble
        </p>
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }}
        />
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
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
            <p className="font-display text-[10px] tracking-[0.22em] text-text-muted uppercase">
              New session
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Get a fresh 6-character code to share.
            </p>
            <button
              type="button"
              onClick={createSession}
              className="mt-4 w-full cursor-pointer rounded-md bg-text px-4 py-2 text-sm font-medium text-bg transition-colors hover:opacity-90"
            >
              Create session
            </button>
          </div>

          <form
            onSubmit={joinSession}
            className="rounded-lg border border-white/10 bg-white/[0.02] p-5"
          >
            <p className="font-display text-[10px] tracking-[0.22em] text-text-muted uppercase">
              Join with code
            </p>
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
              className="mt-2 w-full rounded-md border border-white/10 bg-transparent px-3 py-2 font-mono text-center text-lg tracking-[0.4em] uppercase text-text placeholder:text-text-muted/40 focus:border-white/30 focus:outline-none"
            />
            {joinError && (
              <p className="mt-2 text-xs text-amber-200/85">{joinError}</p>
            )}
            <button
              type="submit"
              className="mt-4 w-full cursor-pointer rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-white/5"
            >
              Join
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <p className="font-display text-[10px] tracking-[0.22em] text-text-muted uppercase">
            Resonance profile
          </p>
          <ProfileBody status={status} />
        </div>
      </section>
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
      return (
        <p className="mt-3 text-sm text-text-muted">Loading your profile…</p>
      );
    case "no-profile":
      return (
        <p className="mt-3 text-sm text-text-muted">
          No Resonance profile yet — finish onboarding in Resonance to use
          Ensemble.
        </p>
      );
    case "error":
      return (
        <p className="mt-3 text-sm text-amber-200/85">
          Couldn't load your profile: {status.message}
        </p>
      );
    case "ready":
      return (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-text-muted">
            {status.data.themes.length} themes ·{" "}
            {status.data.archetypes.length} archetypes
          </p>
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {status.data.themes.slice(0, 8).map((t) => (
              <li
                key={t.label}
                className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-text"
              >
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      );
  }
}
