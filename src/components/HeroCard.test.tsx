import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
