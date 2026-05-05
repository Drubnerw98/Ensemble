import { UserButton, useUser } from "@clerk/clerk-react";
import { useResonanceProfile } from "../hooks/useResonanceProfile";

// Signed-in surface. For step 2 this only proves auth + Resonance fetch
// work end-to-end on prod — the session/voting UI lands later.
export function Home() {
  const { user } = useUser();
  const status = useResonanceProfile();

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

      <section className="mx-auto mt-16 max-w-3xl">
        <h1 className="text-2xl font-light tracking-tight">
          Hi {user?.firstName ?? "there"}.
        </h1>

        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-5">
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
