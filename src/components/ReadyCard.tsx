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
  // When you've flagged ready, the card picks up a soft saffron ring — your
  // contribution is in, the visual anchor is "waiting on others" not "act now."
  const cardClass = selfReady
    ? "transition-colors ring-1 ring-accent/30"
    : "transition-colors";

  const eyebrowLabel = selfReady
    ? `Waiting on others · ${readyCount} / ${presentCount}`
    : `Ready · ${readyCount} / ${presentCount}`;

  return (
    <Card className={cardClass}>
      <Card.Eyebrow>{eyebrowLabel}</Card.Eyebrow>
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
              title={
                finalizeDisabled
                  ? noConsensusYet
                    ? "No candidate has crossed the threshold yet"
                    : "Nothing to finalize"
                  : undefined
              }
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
