import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactionRow, type ReactionState } from "./ReactionRow";

const ZERO_STATE: ReactionState = {
  thumbsUp: { count: 0, selfReacted: false },
  heart: { count: 0, selfReacted: false },
  thinking: { count: 0, selfReacted: false },
  yikes: { count: 0, selfReacted: false },
};

describe("ReactionRow", () => {
  it("renders all 4 buttons regardless of count", () => {
    render(<ReactionRow state={ZERO_STATE} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: /thumbs-up reaction/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /heart reaction/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /thinking reaction/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yikes reaction/i })).toBeInTheDocument();
  });

  it("hides the count when count is 0", () => {
    render(<ReactionRow state={ZERO_STATE} onToggle={() => {}} />);
    // The only text content inside buttons should be the emoji characters
    const thumbBtn = screen.getByRole("button", { name: /thumbs-up reaction/i });
    expect(thumbBtn.querySelector(".font-mono")).toBeNull();
  });

  it("shows the count when count is greater than 0", () => {
    const state: ReactionState = {
      ...ZERO_STATE,
      thumbsUp: { count: 3, selfReacted: false },
    };
    render(<ReactionRow state={state} onToggle={() => {}} />);
    const thumbBtn = screen.getByRole("button", { name: /thumbs-up reaction, count 3/i });
    expect(thumbBtn).toBeInTheDocument();
    expect(thumbBtn.querySelector(".font-mono")).toHaveTextContent("3");
  });

  it("sets aria-pressed true when selfReacted", () => {
    const state: ReactionState = {
      ...ZERO_STATE,
      heart: { count: 1, selfReacted: true },
    };
    render(<ReactionRow state={state} onToggle={() => {}} />);
    const heartBtn = screen.getByRole("button", { name: /heart reaction/i });
    expect(heartBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("sets aria-pressed false when not selfReacted", () => {
    render(<ReactionRow state={ZERO_STATE} onToggle={() => {}} />);
    const thumbBtn = screen.getByRole("button", { name: /thumbs-up reaction/i });
    expect(thumbBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onToggle with the correct kind when clicked", async () => {
    const onToggle = vi.fn();
    render(<ReactionRow state={ZERO_STATE} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: /thinking reaction/i }));
    expect(onToggle).toHaveBeenCalledWith("thinking");
  });

  it("calls onToggle with the correct kind for each button", async () => {
    const onToggle = vi.fn();
    render(<ReactionRow state={ZERO_STATE} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: /yikes reaction/i }));
    expect(onToggle).toHaveBeenCalledWith("yikes");
  });

  it("does not call onToggle when disabled", async () => {
    const onToggle = vi.fn();
    render(<ReactionRow state={ZERO_STATE} disabled onToggle={onToggle} />);
    const thumbBtn = screen.getByRole("button", { name: /thumbs-up reaction/i });
    expect(thumbBtn).toBeDisabled();
    await userEvent.click(thumbBtn);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
