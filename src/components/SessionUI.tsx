import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
} from "@liveblocks/react/suspense";
import { LiveObject } from "@liveblocks/client";
import type { Candidate } from "../lib/liveblocks";

export function SessionUI({ code }: { code: string }) {
  const candidates = useStorage((root) => root.candidates);
  const others = useOthers();
  const self = useSelf();
  const { user } = useUser();
  const navigate = useNavigate();

  const addCandidate = useMutation(
    ({ storage }, title: string) => {
      storage.get("candidates").push(
        new LiveObject<Candidate>({
          id: crypto.randomUUID(),
          title,
          addedBy: user?.id ?? "unknown",
          addedAt: Date.now(),
        }),
      );
    },
    [user?.id],
  );

  const removeCandidate = useMutation(({ storage }, id: string) => {
    const list = storage.get("candidates");
    for (let i = list.length - 1; i >= 0; i--) {
      if (list.get(i)?.get("id") === id) {
        list.delete(i);
        return;
      }
    }
  }, []);

  return (
    <main className="min-h-screen bg-bg p-6 text-text">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="cursor-pointer font-display text-[11px] tracking-[0.28em] text-text-muted uppercase transition-colors hover:text-text"
        >
          ← Ensemble
        </button>
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }}
        />
      </header>

      <section className="mx-auto mt-12 max-w-3xl space-y-8">
        <RoomCodeCard code={code} />

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <p className="font-display text-[10px] tracking-[0.22em] text-text-muted uppercase">
            In the room · {1 + others.length}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <MemberChip
              key={self.connectionId}
              name={self.info?.name}
              avatarUrl={self.info?.avatarUrl}
              isYou
            />
            {others.map((m) => (
              <MemberChip
                key={m.connectionId}
                name={m.info?.name}
                avatarUrl={m.info?.avatarUrl}
              />
            ))}
          </ul>
        </div>

        <CandidatesPanel
          candidates={candidates}
          onAdd={addCandidate}
          onRemove={removeCandidate}
        />
      </section>
    </main>
  );
}

function MemberChip({
  name,
  avatarUrl,
  isYou,
}: {
  name?: string;
  avatarUrl?: string;
  isYou?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-text">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full" />
      ) : (
        <span className="inline-block h-5 w-5 rounded-full bg-white/10" />
      )}
      <span>
        {name ?? "Anonymous"}
        {isYou && <span className="ml-1 text-text-muted">(you)</span>}
      </span>
    </li>
  );
}

function RoomCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const url = typeof window !== "undefined" ? window.location.href : "";

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard.writeText can reject in non-secure contexts.
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <p className="font-display text-[10px] tracking-[0.22em] text-text-muted uppercase">
        Session code
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          aria-label={`Session code ${code}`}
          className="rounded-md border border-white/10 px-3 py-2 font-mono text-2xl tracking-[0.3em] text-text select-all"
        >
          {code}
        </span>
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        >
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => copy(url, "link")}
          className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        >
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function CandidatesPanel({
  candidates,
  onAdd,
  onRemove,
}: {
  candidates: readonly { readonly id: string; readonly title: string }[];
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft("");
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <p className="font-display text-[10px] tracking-[0.22em] text-text-muted uppercase">
        Candidates · {candidates.length}
      </p>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a title…"
          maxLength={120}
          className="flex-1 rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-white/30 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="cursor-pointer rounded-md bg-text px-4 py-2 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:cursor-default disabled:opacity-30"
        >
          Add
        </button>
      </form>

      {candidates.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          No candidates yet. Add the first one.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.01] px-3 py-2 text-sm"
            >
              <span>{c.title}</span>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="cursor-pointer text-xs text-text-muted hover:text-amber-200/85"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
