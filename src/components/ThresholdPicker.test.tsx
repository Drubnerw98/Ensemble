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
      />,
    );
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    rerender(
      <ThresholdPicker
        threshold={{ kind: "first-to-n", n: 2 }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("warns when N exceeds present count", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "first-to-n", n: 5 }}
        isHost={true}
        presentCount={2}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/cannot be reached yet/i)).toBeInTheDocument();
  });
});
