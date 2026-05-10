import { Card } from "./ui";
import type { ThresholdRule } from "../lib/liveblocks";

const RULE_LABELS: Record<ThresholdRule["kind"], string> = {
  unanimous: "Unanimous",
  majority: "Majority",
  "first-to-n": "First to N",
};

export function ThresholdPicker({
  threshold,
  isHost,
  presentCount,
  onChange,
  candidatesPerPull,
  onCandidatesPerPullChange,
}: {
  threshold: ThresholdRule;
  isHost: boolean;
  presentCount: number;
  onChange: (rule: ThresholdRule) => void;
  candidatesPerPull: number;
  onCandidatesPerPullChange: (n: number) => void;
}) {
  function handleKindChange(kind: ThresholdRule["kind"]) {
    if (kind === "first-to-n") {
      const defaultN = Math.max(2, Math.ceil(presentCount / 2));
      onChange({ kind: "first-to-n", n: defaultN });
    } else {
      onChange({ kind });
    }
  }

  function handleNChange(value: number) {
    if (Number.isFinite(value) && value >= 1) {
      onChange({ kind: "first-to-n", n: Math.floor(value) });
    }
  }

  function handlePerPullChange(raw: string) {
    const value = Number(raw);
    if (Number.isFinite(value)) {
      onCandidatesPerPullChange(Math.floor(value));
    }
  }

  const showWarning =
    threshold.kind === "first-to-n" && threshold.n > presentCount;

  return (
    <Card>
      <Card.Eyebrow>Threshold</Card.Eyebrow>
      <Card.Body>
        <div className="space-y-3 text-sm text-text">
          <div className="flex flex-wrap items-center gap-3">
            {isHost ? (
              <>
                <select
                  aria-label="Threshold rule"
                  value={threshold.kind}
                  onChange={(e) =>
                    handleKindChange(e.target.value as ThresholdRule["kind"])
                  }
                  className="rounded-md border border-border bg-transparent px-3 py-1.5 text-text focus:border-border-strong focus:outline-none"
                >
                  {(Object.keys(RULE_LABELS) as ThresholdRule["kind"][]).map(
                    (kind) => (
                      <option key={kind} value={kind}>
                        {RULE_LABELS[kind]}
                      </option>
                    ),
                  )}
                </select>
                {threshold.kind === "first-to-n" ? (
                  <label className="flex items-center gap-2 text-text-muted">
                    N:
                    <input
                      aria-label="First-to-N value"
                      type="number"
                      min={1}
                      value={threshold.n}
                      onChange={(e) => handleNChange(Number(e.target.value))}
                      className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-text focus:border-border-strong focus:outline-none"
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <span>
                {RULE_LABELS[threshold.kind]}
                {threshold.kind === "first-to-n" ? ` (N=${threshold.n})` : null}
              </span>
            )}
            {showWarning ? (
              <span className="text-xs text-warn">
                N greater than present count: threshold cannot be reached yet.
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-text-muted">
            {isHost ? (
              <label className="flex items-center gap-2">
                Items per pull:
                <input
                  aria-label="Items per pull"
                  type="number"
                  min={1}
                  max={20}
                  value={candidatesPerPull}
                  onChange={(e) => handlePerPullChange(e.target.value)}
                  className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-text focus:border-border-strong focus:outline-none"
                />
              </label>
            ) : (
              <span>Items per pull: {candidatesPerPull}</span>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
