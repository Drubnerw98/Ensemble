import { useCallback, useEffect, useRef, useState } from "react";
import type { TmdbResult } from "../lib/tmdb";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelectResult: (result: TmdbResult) => void;
  onSubmitFreeform: (title: string) => void;
  // Injected so the component doesn't call searchTmdb directly — makes
  // testing straightforward without module mocking gymnastics.
  search: (query: string) => Promise<TmdbResult[]>;
  disabled?: boolean;
};

export function CandidateAutocomplete({
  value,
  onChange,
  onSelectResult,
  onSubmitFreeform,
  search,
  disabled,
}: Props) {
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  // Track whether we've received a response for the current query so
  // we can differentiate "loading" from "no results".
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which query the last search was for so stale responses from
  // slow network don't clobber results for a newer query.
  const lastQueryRef = useRef("");

  const runSearch = useCallback(
    async (query: string) => {
      lastQueryRef.current = query;
      setSearched(false);
      const res = await search(query);
      // Discard stale responses.
      if (lastQueryRef.current !== query) return;
      setResults(res);
      setSearched(true);
      setOpen(true);
      setHighlightIndex(-1);
    },
    [search],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      // Resetting to empty when query is too short is synchronous state
      // cleanup, not a derived computation — there is no external system
      // to subscribe to here. The rule exists to prevent cascading renders
      // from subscriptions; this resets three flags atomically on a known
      // short input and does not cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runSearch]);

  const closeDropdown = () => {
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleSelect = (result: TmdbResult) => {
    closeDropdown();
    onSelectResult(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const max = results.length > 0 ? results.length - 1 : -1;
      setHighlightIndex((i) => Math.min(i + 1, max));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && results[highlightIndex]) {
        handleSelect(results[highlightIndex]);
      } else {
        const title = value.trim();
        if (title) {
          closeDropdown();
          onSubmitFreeform(title);
        }
      }
    }
  };

  const showDropdown = !disabled && open && value.length >= 2;

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay so click on a dropdown item fires before the dropdown hides.
          setTimeout(() => closeDropdown(), 150);
        }}
        placeholder="Add a title..."
        maxLength={120}
        disabled={disabled}
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-border-strong focus:outline-none min-h-11 sm:min-h-0"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        role="combobox"
      />

      {showDropdown ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-bg shadow-lg"
        >
          {results.length > 0 ? (
            results.map((result, i) => (
              <DropdownItem
                key={result.tmdbId}
                result={result}
                highlighted={i === highlightIndex}
                onSelect={handleSelect}
              />
            ))
          ) : searched ? (
            <li className="px-3 py-2 text-sm text-text-muted">
              No matches. Press Enter to add anyway.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function DropdownItem({
  result,
  highlighted,
  onSelect,
}: {
  result: TmdbResult;
  highlighted: boolean;
  onSelect: (r: TmdbResult) => void;
}) {
  const typeLabel = result.mediaType === "movie" ? "movie" : "show";

  return (
    <li
      role="option"
      aria-selected={highlighted}
      onMouseDown={(e) => {
        // Prevent blur on the input from firing before the click.
        e.preventDefault();
        onSelect(result);
      }}
      className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm${
        highlighted ? " bg-white/10" : " hover:bg-white/5"
      }`}
    >
      {result.posterUrl ? (
        <img
          src={result.posterUrl}
          alt=""
          className="h-[60px] w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-[60px] w-10 shrink-0 rounded bg-white/10" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-text">{result.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
          {result.year !== null ? <span>{result.year}</span> : null}
          <span className="rounded border border-border px-1">{typeLabel}</span>
        </div>
      </div>
    </li>
  );
}
