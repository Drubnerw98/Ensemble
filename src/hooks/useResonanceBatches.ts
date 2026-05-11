import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { fetchBatches, type ResonanceBatchSummary } from "../lib/api";

export type BatchesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; batches: readonly ResonanceBatchSummary[] }
  | { kind: "error"; message: string };

/**
 * Lazy loader for the Resonance batches list. Only the source-picker UI
 * needs it; the rest of the room ignores batches entirely. Caller invokes
 * `load()` on first picker open. Result is cached per-mount so reopening
 * the picker doesn't re-fetch unless `reload()` is called.
 */
export function useResonanceBatches(): {
  state: BatchesState;
  load: () => void;
  reload: () => void;
} {
  const { getToken } = useAuth();
  const [state, setState] = useState<BatchesState>({ kind: "idle" });
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: "loading" });
    try {
      const token = await getToken();
      if (!token) {
        setState({ kind: "error", message: "Sign in to Resonance to load batches." });
        return;
      }
      const batches = await fetchBatches(token);
      setState({ kind: "ready", batches });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load batches",
      });
    } finally {
      inFlight.current = false;
    }
  }, [getToken]);

  const load = useCallback(() => {
    if (state.kind === "ready" || state.kind === "loading") return;
    void run();
  }, [run, state.kind]);

  const reload = useCallback(() => {
    void run();
  }, [run]);

  // Effect-form noop so the hook stays consistent across renders even if the
  // caller doesn't invoke load() — keeps the surface predictable for tests.
  useEffect(() => {}, []);

  return { state, load, reload };
}
