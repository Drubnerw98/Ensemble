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
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/unanimous/i)).toBeInTheDocument();
  });

  it("renders a select when isHost is true", () => {
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
    expect(screen.getByRole("combobox")).toBeInTheDocument();
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
    await userEvent.selectOptions(screen.getByRole("combobox"), "majority");
    expect(onChange).toHaveBeenCalledWith({ kind: "majority" });
  });

  it("shows the N input only when first-to-n is selected", () => {
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
      screen.queryByLabelText(/first-to-n value/i),
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
    expect(screen.getByLabelText(/first-to-n value/i)).toBeInTheDocument();
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
  it("renders the items-per-pull input only for the host", () => {
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
    expect(screen.queryByLabelText(/items per pull/i)).not.toBeInTheDocument();

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
    expect(screen.getByLabelText(/items per pull/i)).toBeInTheDocument();
  });

  it("emits onCandidatesPerPullChange with the new value", async () => {
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
    const input = screen.getByLabelText(/items per pull/i);
    await userEvent.clear(input);
    await userEvent.type(input, "8");
    // Final emission should have value 8 (each keystroke fires for controlled inputs).
    const lastCall =
      onCandidatesPerPullChange.mock.calls[
        onCandidatesPerPullChange.mock.calls.length - 1
      ];
    expect(lastCall?.[0]).toBe(8);
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
