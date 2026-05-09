import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroCard } from "./HeroCard";

const userInfoById = new Map([
  ["u1", { name: "Alice", avatarUrl: undefined }],
  ["u2", { name: "Bob", avatarUrl: undefined }],
]);

describe("HeroCard", () => {
  it("renders the winner title and 'Tonight's pick' eyebrow", () => {
    render(
      <HeroCard
        winnerTitle="Dune Part Two"
        voterIds={["u1", "u2"]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
      />,
    );
    expect(screen.getByText("Dune Part Two")).toBeInTheDocument();
    expect(screen.getByText(/tonight'?s pick/i)).toBeInTheDocument();
  });

  it("shows the Reconsider button only when isHost is true", () => {
    const { rerender } = render(
      <HeroCard
        winnerTitle="X"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /reconsider/i }),
    ).not.toBeInTheDocument();

    rerender(
      <HeroCard
        winnerTitle="X"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={true}
        onReconsider={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /reconsider/i }),
    ).toBeInTheDocument();
  });

  it("calls onReconsider when host clicks the button", async () => {
    const onReconsider = vi.fn();
    render(
      <HeroCard
        winnerTitle="X"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={true}
        onReconsider={onReconsider}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /reconsider/i }),
    );
    expect(onReconsider).toHaveBeenCalledTimes(1);
  });
});

describe("HeroCard spin and animateOnMount", () => {
  it("renders the winner directly when not spinning", () => {
    render(
      <HeroCard
        winnerTitle="Winner"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
        spinningTitles={[]}
        animateOnMount={true}
      />,
    );
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("cycles through spinning titles before settling on the winner when animateOnMount", () => {
    vi.useFakeTimers();
    try {
      render(
        <HeroCard
          winnerTitle="Winner"
          voterIds={[]}
          userInfoById={userInfoById}
          isHost={false}
          onReconsider={() => {}}
          spinningTitles={["Alpha", "Beta", "Winner"]}
          animateOnMount={true}
        />,
      );
      expect(screen.getByRole("heading")).toHaveTextContent(/Alpha|Beta|Winner/);
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole("heading")).toHaveTextContent("Winner");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the winner immediately when animateOnMount is false (late joiner)", () => {
    render(
      <HeroCard
        winnerTitle="Winner"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
        spinningTitles={["Alpha", "Beta", "Winner"]}
        animateOnMount={false}
      />,
    );
    // No spin even with multiple tied titles — late joiner sees winner directly.
    expect(screen.getByRole("heading")).toHaveTextContent("Winner");
  });
});
