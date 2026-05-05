import { SignInButton } from "@clerk/clerk-react";

// Placeholder signed-out surface. Visual identity for Ensemble is a
// dedicated brainstorm — this page exists to gate the auth flow, not to
// pitch the product.
export function Landing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="max-w-md text-center">
        <p className="font-display text-[11px] tracking-[0.28em] text-text-muted uppercase">
          Ensemble
        </p>
        <h1 className="mt-4 text-3xl font-light tracking-tight">
          Decide together.
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Real-time taste convergence. Sign in with your Resonance account.
        </p>
        <div className="mt-8">
          <SignInButton mode="modal">
            <button
              type="button"
              className="cursor-pointer rounded-md bg-text px-5 py-2 text-sm font-medium text-bg transition-colors hover:opacity-90"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    </main>
  );
}
