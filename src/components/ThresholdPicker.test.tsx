import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThresholdPicker } from "./ThresholdPicker";
import type { ThresholdRule } from "../lib/liveblocks";

describe("ThresholdPicker", () => {
  it("renders read-only when isHost is false", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={false}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(
      screen.queryByRole("radiogroup", { name: /threshold rule/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/unanimous/i)).toBeInTheDocument();
  });

  it("renders the segmented threshold control when isHost is true", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: /threshold rule/i });
    expect(group).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /unanimous/i }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("emits onChange with the selected rule", async () => {
    const onChange = vi.fn<(rule: ThresholdRule) => void>();
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={onChange}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /majority/i }));
    expect(onChange).toHaveBeenCalledWith({ kind: "majority" });
  });

  it("shows the N stepper only when first-to-n is selected", () => {
    const { rerender } = render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(
      screen.queryByRole("group", { name: /first-to-n value/i }),
    ).not.toBeInTheDocument();

    rerender(
      <ThresholdPicker
        threshold={{ kind: "first-to-n", n: 2 }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("group", { name: /first-to-n value/i }),
    ).toBeInTheDocument();
  });

  it("warns when N exceeds present count", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "first-to-n", n: 5 }}
        isHost={true}
        presentCount={2}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(screen.getByText(/cannot be reached yet/i)).toBeInTheDocument();
  });
});

describe("ThresholdPicker items-per-pull", () => {
  it("renders the items-per-pull stepper only for the host", () => {
    const { rerender } = render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={false}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(
      screen.queryByRole("group", { name: /items per pull/i }),
    ).not.toBeInTheDocument();

    rerender(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("group", { name: /items per pull/i }),
    ).toBeInTheDocument();
  });

  it("emits onCandidatesPerPullChange when stepping up", async () => {
    const onCandidatesPerPullChange = vi.fn<(n: number) => void>();
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={onCandidatesPerPullChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /increase items per pull/i }),
    );
    expect(onCandidatesPerPullChange).toHaveBeenCalledWith(6);
  });

  it("disables decrement at the minimum", async () => {
    const onCandidatesPerPullChange = vi.fn<(n: number) => void>();
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={1}
        onCandidatesPerPullChange={onCandidatesPerPullChange}
      />,
    );
    const decrement = screen.getByRole("button", {
      name: /decrease items per pull/i,
    });
    expect(decrement).toBeDisabled();
  });

  it("shows read-only items-per-pull text for non-hosts", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={false}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={7}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(screen.getByText(/items per pull: 7/i)).toBeInTheDocument();
  });
});
