import { SignInButton } from "@clerk/clerk-react";
import { Button, Eyebrow } from "../components/ui";

export function Landing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="max-w-md text-center">
        <Eyebrow>Ensemble</Eyebrow>
        <h1 className="mt-4 text-3xl font-light tracking-tight">
          Decide together.
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Real-time voting on titles pulled from each person's Resonance.
          Sign in to start a session.
        </p>
        <div className="mt-8">
          <SignInButton mode="modal">
            <Button variant="primary">Sign in</Button>
          </SignInButton>
        </div>
      </div>
    </main>
  );
}
