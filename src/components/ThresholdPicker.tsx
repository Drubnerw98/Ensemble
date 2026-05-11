import { Card, SegmentedControl, Stepper } from "./ui";
import type { ThresholdRule } from "../lib/liveblocks";

const RULE_OPTIONS: readonly { value: ThresholdRule["kind"]; label: string }[] = [
  { value: "unanimous", label: "Unanimous" },
  { value: "majority", label: "Majority" },
  { value: "first-to-n", label: "First to N" },
];

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

  function handleNChange(n: number) {
    onChange({ kind: "first-to-n", n });
  }

  const showWarning =
    threshold.kind === "first-to-n" && threshold.n > presentCount;

  return (
    <Card>
      <Card.Eyebrow>Threshold</Card.Eyebrow>
      <Card.Body>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {isHost ? (
              <>
                <SegmentedControl
                  ariaLabel="Threshold rule"
                  options={RULE_OPTIONS}
                  value={threshold.kind}
                  onChange={handleKindChange}
                />
                {threshold.kind === "first-to-n" ? (
                  <label className="flex items-center gap-2 text-xs tracking-wide text-text-muted">
                    <span className="font-display uppercase">N</span>
                    <Stepper
                      ariaLabel="First-to-N value"
                      value={threshold.n}
                      min={1}
                      max={Math.max(presentCount, 20)}
                      onChange={handleNChange}
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-text">
                {RULE_LABELS[threshold.kind]}
                {threshold.kind === "first-to-n" ? ` · N=${threshold.n}` : null}
              </span>
            )}
            {showWarning ? (
              <span className="text-xs text-warn">
                N greater than present count: threshold cannot be reached yet.
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs tracking-wide text-text-muted">
            {isHost ? (
              <label className="flex items-center gap-2">
                <span className="font-display uppercase">Items per pull</span>
                <Stepper
                  ariaLabel="Items per pull"
                  value={candidatesPerPull}
                  min={1}
                  max={20}
                  onChange={onCandidatesPerPullChange}
                />
              </label>
            ) : (
              <span className="text-sm text-text">
                Items per pull: {candidatesPerPull}
              </span>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
