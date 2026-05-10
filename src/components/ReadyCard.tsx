import { Button, Card } from "./ui";

export function ReadyCard({
  selfReady,
  readyCount,
  presentCount,
  isHost,
  noConsensusYet,
  finalizeDisabled,
  onToggleReady,
  onFinalizeNow,
}: {
  selfReady: boolean;
  readyCount: number;
  presentCount: number;
  isHost: boolean;
  noConsensusYet: boolean;
  finalizeDisabled: boolean;
  onToggleReady: (ready: boolean) => void;
  onFinalizeNow: () => void;
}) {
  return (
    <Card>
      <Card.Eyebrow>{`Ready · ${readyCount} / ${presentCount}`}</Card.Eyebrow>
      <Card.Body>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant={selfReady ? "secondary" : "primary"}
            onClick={() => onToggleReady(!selfReady)}
          >
            {selfReady ? "Not ready yet" : "I'm ready"}
          </Button>
          {isHost ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={finalizeDisabled}
              onClick={onFinalizeNow}
            >
              Finalize now
            </Button>
          ) : null}
        </div>
        {noConsensusYet ? (
          <p className="mt-3 text-xs text-text-muted">
            No candidate has crossed the threshold yet, change votes and
            re-ready up.
          </p>
        ) : null}
      </Card.Body>
    </Card>
  );
}
