import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidateAutocomplete } from "./CandidateAutocomplete";
import type { TmdbResult } from "../lib/tmdb";

const DUNE: TmdbResult = {
  tmdbId: 438631,
  title: "Dune: Part Two",
  year: 2024,
  posterUrl: "https://image.tmdb.org/t/p/w342/abc.jpg",
  mediaType: "movie",
};

const SEVERANCE: TmdbResult = {
  tmdbId: 95396,
  title: "Severance",
  year: 2022,
  posterUrl: null,
  mediaType: "tv",
};

function makeSearch(returnValue: TmdbResult[] = [DUNE, SEVERANCE]) {
  return vi.fn().mockResolvedValue(returnValue);
}

function renderAutocomplete(
  overrides: Partial<Parameters<typeof CandidateAutocomplete>[0]> = {},
) {
  const onSelectResult = vi.fn();
  const onSubmitFreeform = vi.fn();
  const onChange = vi.fn();
  const search = makeSearch();

  const props = {
    value: "",
    onChange,
    onSelectResult,
    onSubmitFreeform,
    search,
    ...overrides,
  };

  render(<CandidateAutocomplete {...props} />);
  return { onSelectResult, onSubmitFreeform, onChange, search };
}

// All tests use real timers. The search mock resolves immediately, so
// we only need to wait for the 250ms debounce; waitFor polls until the
// DOM settles without fighting fake-timer / waitFor deadlocks.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CandidateAutocomplete", () => {
  it("renders an input with no dropdown initially", () => {
    renderAutocomplete();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not fire search for queries shorter than 2 chars", async () => {
    const search = makeSearch();
    renderAutocomplete({ value: "a", search });
    // Wait longer than the debounce to confirm search was never called.
    await new Promise((r) => setTimeout(r, 300));
    expect(search).not.toHaveBeenCalled();
  });

  it("fires search after 250ms debounce when value has 2+ chars", async () => {
    const search = makeSearch();
    renderAutocomplete({ value: "du", search });
    expect(search).not.toHaveBeenCalled();
    await waitFor(() => expect(search).toHaveBeenCalledWith("du"), { timeout: 500 });
  });

  it("shows dropdown results after search resolves", async () => {
    const search = makeSearch([DUNE]);
    renderAutocomplete({ value: "dune", search });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
      timeout: 500,
    });
    expect(screen.getByText("Dune: Part Two")).toBeInTheDocument();
  });

  it("calls onSelectResult with the result when an item is clicked", async () => {
    const search = makeSearch([DUNE]);
    const { onSelectResult } = renderAutocomplete({ value: "dune", search });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
      timeout: 500,
    });
    const item = screen.getByText("Dune: Part Two");
    // mousedown fires before blur to avoid the blur-before-click race.
    item.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await waitFor(() => expect(onSelectResult).toHaveBeenCalledWith(DUNE));
  });

  it("calls onSubmitFreeform when Enter is pressed with no TMDB matches", async () => {
    const search = makeSearch([]);
    const { onSubmitFreeform } = renderAutocomplete({ value: "unknown title", search });
    // Wait for the no-matches state (confirms search settled).
    await waitFor(() => expect(screen.getByText(/No matches/)).toBeInTheDocument(), {
      timeout: 500,
    });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "{Enter}");
    expect(onSubmitFreeform).toHaveBeenCalledWith("unknown title");
  });

  it("Enter with results but no highlight selects the top match", async () => {
    const search = makeSearch([DUNE, SEVERANCE]);
    const { onSelectResult, onSubmitFreeform } = renderAutocomplete({
      value: "du",
      search,
    });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
      timeout: 500,
    });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "{Enter}");
    expect(onSelectResult).toHaveBeenCalledWith(DUNE);
    expect(onSubmitFreeform).not.toHaveBeenCalled();
  });

  it("Enter with short value (dropdown closed) freeforms the draft", async () => {
    const search = makeSearch();
    const { onSubmitFreeform } = renderAutocomplete({ value: "X", search });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "{Enter}");
    expect(onSubmitFreeform).toHaveBeenCalledWith("X");
  });

  it("arrow keys move highlight through results", async () => {
    const search = makeSearch([DUNE, SEVERANCE]);
    renderAutocomplete({ value: "du", search });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
      timeout: 500,
    });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.type(input, "{ArrowDown}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  it("Escape closes the dropdown", async () => {
    const search = makeSearch([DUNE]);
    renderAutocomplete({ value: "du", search });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), {
      timeout: 500,
    });
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows 'No matches' message when search returns empty", async () => {
    const search = makeSearch([]);
    renderAutocomplete({ value: "xyzxyz", search });
    await waitFor(() => expect(screen.getByText(/No matches/)).toBeInTheDocument(), {
      timeout: 500,
    });
  });

  it("disabled state hides dropdown and prevents interaction", async () => {
    const search = makeSearch([DUNE]);
    renderAutocomplete({ value: "du", search, disabled: true });
    // Wait past debounce time; dropdown should remain absent.
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
