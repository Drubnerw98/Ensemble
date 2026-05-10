import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadyCard } from "./ReadyCard";

const baseProps = {
  selfReady: false,
  readyCount: 0,
  presentCount: 2,
  isHost: false,
  noConsensusYet: false,
  finalizeDisabled: true,
  onToggleReady: () => {},
  onFinalizeNow: () => {},
};

describe("ReadyCard", () => {
  it("renders the eyebrow with the ready ratio", () => {
    render(<ReadyCard {...baseProps} readyCount={1} presentCount={2} />);
    expect(screen.getByText(/ready, 1 \/ 2/i)).toBeInTheDocument();
  });

  it("button reads 'I'm ready' when selfReady is false", () => {
    render(<ReadyCard {...baseProps} selfReady={false} />);
    expect(
      screen.getByRole("button", { name: /i'?m ready/i }),
    ).toBeInTheDocument();
  });

  it("button reads 'Not ready yet' when selfReady is true", () => {
    render(<ReadyCard {...baseProps} selfReady={true} />);
    expect(
      screen.getByRole("button", { name: /not ready yet/i }),
    ).toBeInTheDocument();
  });

  it("calls onToggleReady with the negated current value", async () => {
    const onToggleReady = vi.fn<(ready: boolean) => void>();
    render(
      <ReadyCard
        {...baseProps}
        selfReady={false}
        onToggleReady={onToggleReady}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /i'?m ready/i }));
    expect(onToggleReady).toHaveBeenCalledWith(true);
  });

  it("hides the Finalize now button when isHost is false", () => {
    render(<ReadyCard {...baseProps} isHost={false} />);
    expect(
      screen.queryByRole("button", { name: /finalize now/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Finalize now button when isHost is true", () => {
    render(<ReadyCard {...baseProps} isHost={true} />);
    expect(
      screen.getByRole("button", { name: /finalize now/i }),
    ).toBeInTheDocument();
  });

  it("disables Finalize now when finalizeDisabled is true", () => {
    render(
      <ReadyCard {...baseProps} isHost={true} finalizeDisabled={true} />,
    );
    const btn = screen.getByRole("button", { name: /finalize now/i });
    expect(btn).toBeDisabled();
  });

  it("enables Finalize now when finalizeDisabled is false and calls onFinalizeNow", async () => {
    const onFinalizeNow = vi.fn();
    render(
      <ReadyCard
        {...baseProps}
        isHost={true}
        finalizeDisabled={false}
        onFinalizeNow={onFinalizeNow}
      />,
    );
    const btn = screen.getByRole("button", { name: /finalize now/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(onFinalizeNow).toHaveBeenCalledTimes(1);
  });

  it("hides the no-consensus hint when noConsensusYet is false", () => {
    render(<ReadyCard {...baseProps} noConsensusYet={false} />);
    expect(
      screen.queryByText(/no candidate has crossed the threshold/i),
    ).not.toBeInTheDocument();
  });

  it("shows the no-consensus hint when noConsensusYet is true", () => {
    render(<ReadyCard {...baseProps} noConsensusYet={true} />);
    expect(
      screen.getByText(/no candidate has crossed the threshold/i),
    ).toBeInTheDocument();
  });
});
