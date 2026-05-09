# Visual system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the visual-system spec at `docs/superpowers/specs/2026-05-09-visual-system-design.md` to the Ensemble codebase: lock tokens in `globals.css`, build four component primitives in `src/components/ui/`, migrate the three existing UI files to use them, and apply the voter-convergence hero changes in `SessionUI.tsx`.

**Architecture:** Token-driven design system in Tailwind v4's `@theme`. Four primitives (Button, Card, Eyebrow, AvatarStack) replace inline Tailwind duplication. Voter convergence hero uses one Framer Motion spring on the `AvatarStack` to make vote-lands feel earned.

**Tech Stack:** Tailwind v4, React 19, TypeScript, Vitest + happy-dom + React Testing Library (added Task 0), Framer Motion (added Task 2), IBM Plex Sans + Plex Mono (added Task 1).

---

## Task 0: Test infrastructure setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (add deps + scripts)
- Modify: `tsconfig.app.json` (add Vitest globals types)
- Modify: `decisions.md` (log the test setup decision)

- [ ] **Step 1: Install test dependencies**

```bash
pnpm add -D vitest happy-dom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/ui
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Update `package.json` scripts**

Add to the `"scripts"` block in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Update `tsconfig.app.json` to include Vitest globals**

In the `compilerOptions.types` array, add `"vitest/globals"` and `"@testing-library/jest-dom"`. If a `types` array does not exist in `compilerOptions`, add it:

```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

Also confirm `src/test` is included in the `include` array (typically it already is via `src/**/*` patterns; if not, add it).

- [ ] **Step 6: Add a smoke test to verify setup**

Create `src/test/setup.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("vitest globals work", () => {
    expect(1 + 1).toBe(2);
  });

  it("dom is available", () => {
    const el = document.createElement("div");
    el.textContent = "hello";
    expect(el.textContent).toBe("hello");
  });
});
```

- [ ] **Step 7: Run the smoke test**

```bash
pnpm test
```

Expected: 2 tests pass, no errors.

- [ ] **Step 8: Add a "Decision" entry for test setup**

Append to `decisions.md`:

```markdown
## [2026-05-09] — Test runner: Vitest with happy-dom + React Testing Library

**Considered**: Vitest + happy-dom, Vitest + jsdom, Jest + jsdom, no tests for MVP.
**Decision**: Vitest with happy-dom and React Testing Library.
**Why**: Vitest is already adjacent (Vite-native, zero-config friction). happy-dom is faster than jsdom and fully covers component-level DOM needs. RTL is the standard React testing surface. The cost of "no tests for MVP" is shipping primitives that have no regression net for the cross-site visual audit; the cost of Jest is slower iteration and a second toolchain.
**Tradeoff accepted**: happy-dom occasionally diverges from real-browser behavior on edge cases (Shadow DOM, some CSS APIs); revisit if a primitive grows logic that hits those edges.
**Would revisit if**: We adopt Storybook, need visual regression testing, or component logic grows past what unit tests can cover (then Playwright component tests).
```

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts src/test/setup.ts src/test/setup.test.ts package.json pnpm-lock.yaml tsconfig.app.json decisions.md
git commit -m "$(cat <<'EOF'
Add Vitest + happy-dom + RTL test infrastructure

Vitest with happy-dom for fast, Vite-native component tests. RTL is the standard React surface. Decision logged in decisions.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: Visual tokens in globals.css

**Files:**
- Modify: `src/styles/globals.css` (full rewrite of the `@theme` block + import)

- [ ] **Step 1: Replace `globals.css` content**

Replace the entire contents of `src/styles/globals.css` with:

```css
@import "tailwindcss";

@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap");

/* Visual tokens for Ensemble's design system. See
   docs/superpowers/specs/2026-05-09-visual-system-design.md for the full
   reasoning. Cross-site audit (Resonance + Constellation + Ensemble) will
   harmonize these by editing tokens, not components. */
@theme {
  --font-sans:
    "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:
    "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --font-display:
    "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;

  --color-bg: #05060a;
  --color-surface: #0c0f16;
  --color-border: #1a1f2a;
  --color-border-strong: #2a3140;
  --color-text: #e9ecf2;
  --color-text-muted: #a1a8b3;
  --color-accent: #e8a857;
  --color-accent-soft: #b8843a;
  --color-warn: #db7b47;
}

html,
body,
#root {
  height: 100%;
  width: 100%;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Verify the build**

```bash
pnpm build
```

Expected: clean build, no warnings about unknown utilities. Existing classes (`bg-bg`, `text-text`, etc.) still work because their tokens are unchanged. New classes (`bg-surface`, `border-border`, `bg-accent`, `text-warn`, etc.) are now available.

- [ ] **Step 3: Manually verify in dev**

```bash
pnpm dev
```

Open the app, log in, see Home and Session pages. They should look essentially identical to before (no styled components reference the new tokens yet). Font has changed from Fira to Plex on every text element. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "$(cat <<'EOF'
Add visual system tokens to globals.css

Swap font import from Fira to IBM Plex (Sans + Mono). Add accent (saffron), accent-soft, warn (terracotta), surface, border, border-strong color tokens. Existing tokens unchanged so consumers keep working.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Install Framer Motion

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

```bash
pnpm add framer-motion
```

- [ ] **Step 2: Verify the build**

```bash
pnpm typecheck && pnpm build
```

Expected: clean build. Framer Motion exposes types automatically; nothing imports it yet.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
Add framer-motion for voter-convergence hero motion

One spring used in one place (AvatarStack vote-lands). Adds ~50KB gzipped after tree-shaking; standard React motion choice.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Eyebrow primitive (TDD)

**Files:**
- Create: `src/components/ui/Eyebrow.tsx`
- Create: `src/components/ui/Eyebrow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/Eyebrow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Eyebrow } from "./Eyebrow";

describe("Eyebrow", () => {
  it("renders children", () => {
    render(<Eyebrow>Session code</Eyebrow>);
    expect(screen.getByText("Session code")).toBeInTheDocument();
  });

  it("appends count suffix when count is provided", () => {
    render(<Eyebrow count={3}>Candidates</Eyebrow>);
    expect(screen.getByText(/Candidates/)).toBeInTheDocument();
    expect(screen.getByText(/· 3/)).toBeInTheDocument();
  });

  it("does not render count suffix when count is undefined", () => {
    const { container } = render(<Eyebrow>Session code</Eyebrow>);
    expect(container.textContent).not.toMatch(/·/);
  });

  it("applies tracked-uppercase mono styling", () => {
    const { container } = render(<Eyebrow>label</Eyebrow>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/font-display/);
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/tracking-/);
  });
});
```

- [ ] **Step 2: Run the test, see it fail**

```bash
pnpm test src/components/ui/Eyebrow.test.tsx
```

Expected: fail with module-not-found error for `./Eyebrow`.

- [ ] **Step 3: Implement `Eyebrow.tsx`**

Create `src/components/ui/Eyebrow.tsx`:

```tsx
type EyebrowProps = {
  count?: number;
  children: React.ReactNode;
};

export function Eyebrow({ count, children }: EyebrowProps) {
  return (
    <p className="font-display text-[11px] tracking-[0.22em] text-text-muted uppercase">
      {children}
      {count !== undefined && ` · ${count}`}
    </p>
  );
}
```

- [ ] **Step 4: Run the test, see it pass**

```bash
pnpm test src/components/ui/Eyebrow.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Eyebrow.tsx src/components/ui/Eyebrow.test.tsx
git commit -m "$(cat <<'EOF'
Add Eyebrow primitive

Replaces six inline `font-display text-[11px] tracking-[0.22em] text-text-muted uppercase` duplications. Optional count prop appends "· N" suffix.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Button primitive (TDD)

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/Button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Create session</Button>);
    expect(screen.getByRole("button", { name: "Create session" })).toBeInTheDocument();
  });

  it("defaults to secondary variant and md size", () => {
    const { container } = render(<Button>x</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toMatch(/border-border/);
    expect(btn.className).toMatch(/bg-transparent/);
  });

  it("primary variant uses accent background", () => {
    const { container } = render(<Button variant="primary">x</Button>);
    expect(container.querySelector("button")!.className).toMatch(/bg-accent/);
  });

  it("ghost variant uses muted text and warn-on-hover", () => {
    const { container } = render(<Button variant="ghost">remove</Button>);
    const cls = container.querySelector("button")!.className;
    expect(cls).toMatch(/text-text-muted/);
    expect(cls).toMatch(/hover:text-warn/);
  });

  it("forwards onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("forwards disabled", () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards type attribute", () => {
    render(<Button type="submit">submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("sm size has tighter padding than md", () => {
    const { container, rerender } = render(<Button size="sm">x</Button>);
    const smCls = container.querySelector("button")!.className;
    rerender(<Button size="md">x</Button>);
    const mdCls = container.querySelector("button")!.className;
    expect(smCls).not.toBe(mdCls);
  });
});
```

- [ ] **Step 2: Run the test, see it fail**

```bash
pnpm test src/components/ui/Button.test.tsx
```

Expected: fail with module-not-found error.

- [ ] **Step 3: Implement `Button.tsx`**

Create `src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

type ButtonProps = {
  variant?: Variant;
  size?: Size;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const BASE =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer disabled:cursor-default disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-bg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-bg hover:bg-accent/90",
  secondary:
    "border border-border bg-transparent text-text hover:bg-surface hover:border-border-strong",
  ghost: "text-text-muted hover:text-warn",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const merged = `${BASE} ${VARIANTS[variant]} ${SIZES[size]}${
    className ? ` ${className}` : ""
  }`;
  return <button type={type} className={merged} {...rest} />;
}
```

- [ ] **Step 4: Run the test, see it pass**

```bash
pnpm test src/components/ui/Button.test.tsx
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Button.test.tsx
git commit -m "$(cat <<'EOF'
Add Button primitive (primary, secondary, ghost; sm, md)

Replaces six hand-rolled button patterns scattered across Home, Landing, and SessionUI. Default is secondary/md so most callers stay terse.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Card primitive (TDD)

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/Card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(
      <Card>
        <p>body content</p>
      </Card>,
    );
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("applies surface, border, padding classes", () => {
    const { container } = render(
      <Card>
        <p>x</p>
      </Card>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/bg-surface/);
    expect(root.className).toMatch(/border-border/);
    expect(root.className).toMatch(/rounded-lg/);
    expect(root.className).toMatch(/p-5/);
  });

  it("Card.Eyebrow renders an Eyebrow with the same styling rules", () => {
    render(
      <Card>
        <Card.Eyebrow>Session code</Card.Eyebrow>
      </Card>,
    );
    expect(screen.getByText("Session code")).toBeInTheDocument();
  });

  it("Card.Eyebrow forwards count", () => {
    render(
      <Card>
        <Card.Eyebrow count={5}>Candidates</Card.Eyebrow>
      </Card>,
    );
    expect(screen.getByText(/· 5/)).toBeInTheDocument();
  });

  it("Card.Body wraps children", () => {
    render(
      <Card>
        <Card.Body>
          <p>inside body</p>
        </Card.Body>
      </Card>,
    );
    expect(screen.getByText("inside body")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, see it fail**

```bash
pnpm test src/components/ui/Card.test.tsx
```

Expected: fail with module-not-found error.

- [ ] **Step 3: Implement `Card.tsx`**

Create `src/components/ui/Card.tsx`:

```tsx
import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

type CardProps = {
  children: ReactNode;
  className?: string;
};

function CardRoot({ children, className }: CardProps) {
  const merged = `rounded-lg border border-border bg-surface p-5${
    className ? ` ${className}` : ""
  }`;
  return <div className={merged}>{children}</div>;
}

function CardEyebrow({
  count,
  children,
}: {
  count?: number;
  children: ReactNode;
}) {
  return <Eyebrow count={count}>{children}</Eyebrow>;
}

function CardBody({ children }: { children: ReactNode }) {
  return <div className="mt-3">{children}</div>;
}

export const Card = Object.assign(CardRoot, {
  Eyebrow: CardEyebrow,
  Body: CardBody,
});
```

- [ ] **Step 4: Run the test, see it pass**

```bash
pnpm test src/components/ui/Card.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Card.test.tsx
git commit -m "$(cat <<'EOF'
Add Card primitive with Card.Eyebrow and Card.Body slots

Compound component because Card has internal layout opinions (eyebrow at top, body with mt-3 below). Replaces five inline `rounded-lg border border-white/10 bg-white/[0.02] p-5` instances.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: AvatarStack primitive (TDD)

**Files:**
- Create: `src/components/ui/AvatarStack.tsx`
- Create: `src/components/ui/AvatarStack.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/AvatarStack.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AvatarStack } from "./AvatarStack";

const userInfo = new Map<string, { name?: string; avatarUrl?: string }>([
  ["u1", { name: "Alice", avatarUrl: "https://example.com/a.png" }],
  ["u2", { name: "Bob", avatarUrl: "https://example.com/b.png" }],
  ["u3", { name: "Carol", avatarUrl: "https://example.com/c.png" }],
  ["u4", { name: "Dan", avatarUrl: "https://example.com/d.png" }],
]);

describe("AvatarStack", () => {
  it("renders nothing when userIds is empty", () => {
    const { container } = render(
      <AvatarStack userIds={[]} userInfoById={userInfo} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders up to max avatars (default 3)", () => {
    const { container } = render(
      <AvatarStack
        userIds={["u1", "u2", "u3", "u4"]}
        userInfoById={userInfo}
      />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(3);
  });

  it("respects custom max", () => {
    const { container } = render(
      <AvatarStack
        userIds={["u1", "u2", "u3", "u4"]}
        userInfoById={userInfo}
        max={2}
      />,
    );
    expect(container.querySelectorAll("img").length).toBe(2);
  });

  it("renders count when showCount is true", () => {
    render(
      <AvatarStack
        userIds={["u1", "u2", "u3", "u4"]}
        userInfoById={userInfo}
        showCount
      />,
    );
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("does not render count when showCount is false", () => {
    const { container } = render(
      <AvatarStack
        userIds={["u1", "u2", "u3"]}
        userInfoById={userInfo}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("highlight prop adds saffron ring class", () => {
    const { container } = render(
      <AvatarStack
        userIds={["u1"]}
        userInfoById={userInfo}
        highlight
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/ring-/);
    expect(root.className).toMatch(/ring-accent/);
  });

  it("size md uses larger avatar dimensions than sm", () => {
    const { container, rerender } = render(
      <AvatarStack
        userIds={["u1"]}
        userInfoById={userInfo}
        size="sm"
      />,
    );
    const smCls = (container.querySelector("img") as HTMLElement).className;
    rerender(
      <AvatarStack
        userIds={["u1"]}
        userInfoById={userInfo}
        size="md"
      />,
    );
    const mdCls = (container.querySelector("img") as HTMLElement).className;
    expect(smCls).not.toBe(mdCls);
  });

  it("falls back to muted circle when avatar URL is missing", () => {
    const partial = new Map([["u1", { name: "NoAvatar" }]]);
    const { container } = render(
      <AvatarStack userIds={["u1"]} userInfoById={partial} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("span")).not.toBeNull();
  });

  it("uses name as title attribute on avatar", () => {
    const { container } = render(
      <AvatarStack userIds={["u1"]} userInfoById={userInfo} />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("title")).toBe("Alice");
  });
});
```

- [ ] **Step 2: Run the test, see it fail**

```bash
pnpm test src/components/ui/AvatarStack.test.tsx
```

Expected: fail with module-not-found error.

- [ ] **Step 3: Implement `AvatarStack.tsx`**

Create `src/components/ui/AvatarStack.tsx`:

```tsx
import { AnimatePresence, motion } from "framer-motion";

type UserInfo = { name?: string; avatarUrl?: string };
type Size = "sm" | "md";

type AvatarStackProps = {
  userIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  max?: number;
  size?: Size;
  showCount?: boolean;
  highlight?: boolean;
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
};

const SIZE_OFFSET: Record<Size, string> = {
  sm: "-ml-1.5",
  md: "-ml-2.5",
};

const HERO_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 18,
} as const;

export function AvatarStack({
  userIds,
  userInfoById,
  max = 3,
  size = "sm",
  showCount = false,
  highlight = false,
}: AvatarStackProps) {
  if (userIds.length === 0) return null;

  const visible = userIds.slice(0, max);
  const sizeClass = SIZE_CLASS[size];
  const offsetClass = SIZE_OFFSET[size];

  const wrapperRing = highlight
    ? "ring-2 ring-accent/50 ring-offset-2 ring-offset-bg rounded-full"
    : "";

  return (
    <div className={`flex items-center gap-2 ${wrapperRing}`}>
      <div className="flex">
        <AnimatePresence initial={false}>
          {visible.map((id, i) => {
            const info = userInfoById.get(id);
            const offset = i > 0 ? offsetClass : "";
            const baseClass = `${sizeClass} shrink-0 rounded-full border border-bg ${offset}`;
            return (
              <motion.span
                key={id}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={HERO_SPRING}
                className="inline-flex"
              >
                {info?.avatarUrl ? (
                  <img
                    src={info.avatarUrl}
                    alt=""
                    title={info.name ?? "Member"}
                    referrerPolicy="no-referrer"
                    className={baseClass}
                  />
                ) : (
                  <span
                    title={info?.name ?? "Member"}
                    className={`${baseClass} bg-white/10`}
                  />
                )}
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
      {showCount && (
        <span className="text-xs text-text-muted">{userIds.length}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test, see it pass**

```bash
pnpm test src/components/ui/AvatarStack.test.tsx
```

Expected: 9 tests pass.

If a test fails because `motion.span` wraps the `img`/`span` and changes the DOM structure expectations, adjust the test selectors to navigate the wrapper. Specifically: the wrapper test for "size class" reads `container.querySelector("img")` — this should still work because the `img` is a descendant. If a test breaks on this, prefer fixing the test selector (`container.querySelectorAll("img").item(0)`) over removing motion.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/AvatarStack.tsx src/components/ui/AvatarStack.test.tsx
git commit -m "$(cat <<'EOF'
Add AvatarStack primitive with Framer Motion vote-lands spring

Replaces inline VoterStack in SessionUI. Sizes (sm/md), max overflow, optional count, and highlight ring (used as the "you voted" cue). Spring animation only fires on entry; exit is plain ease-out so removal does not feel celebratory.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: UI barrel export

**Files:**
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Create the barrel**

Create `src/components/ui/index.ts`:

```ts
export { Button } from "./Button";
export { Card } from "./Card";
export { Eyebrow } from "./Eyebrow";
export { AvatarStack } from "./AvatarStack";
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "$(cat <<'EOF'
Add ui barrel export

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Migrate Landing.tsx

**Files:**
- Modify: `src/routes/Landing.tsx`

- [ ] **Step 1: Replace `Landing.tsx` content**

Replace the entire contents of `src/routes/Landing.tsx` with:

```tsx
import { SignInButton } from "@clerk/clerk-react";
import { Button, Eyebrow } from "../components/ui";

export function Landing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="max-w-md text-center">
        <Eyebrow>Ensemble</Eyebrow>
        <h1 className="mt-4 text-3xl font-light tracking-tight">
          Decide together.
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Real-time taste convergence. Sign in with your Resonance account.
        </p>
        <div className="mt-8">
          <SignInButton mode="modal">
            <Button variant="primary">Sign in</Button>
          </SignInButton>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify typecheck and build**

```bash
pnpm typecheck && pnpm build
```

Expected: clean.

- [ ] **Step 3: Manually verify in dev**

```bash
pnpm dev
```

Open the app while signed out. Landing should render with the same layout, now using the primitives. Typography should look slightly different (Plex). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Landing.tsx
git commit -m "$(cat <<'EOF'
Migrate Landing to ui primitives

Eyebrow + Button (primary variant) replace inline Tailwind. Tightest blast radius file, validates the system before larger migrations.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Migrate Home.tsx

**Files:**
- Modify: `src/routes/Home.tsx`

- [ ] **Step 1: Replace `Home.tsx` content**

Replace the entire contents of `src/routes/Home.tsx` with:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import { useResonanceProfile } from "../hooks/useResonanceProfile";
import {
  generateSessionCode,
  isValidSessionCode,
} from "../lib/sessionCode";
import { Button, Card, Eyebrow } from "../components/ui";

export function Home() {
  const { user } = useUser();
  const status = useResonanceProfile();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  function createSession() {
    navigate(`/s/${generateSessionCode()}`);
  }

  function joinSession(e: React.FormEvent) {
    e.preventDefault();
    const normalized = joinCode.trim().toUpperCase();
    if (!isValidSessionCode(normalized)) {
      setJoinError("Codes are 6 characters, letters and digits only.");
      return;
    }
    setJoinError(null);
    navigate(`/s/${normalized}`);
  }

  return (
    <main className="min-h-screen bg-bg p-6 text-text">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Eyebrow>Ensemble</Eyebrow>
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }}
        />
      </header>

      <section className="mx-auto mt-16 max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-light tracking-tight">
            Hi {user?.firstName ?? "there"}.
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Start a session, or join one with a code.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <Card.Eyebrow>New session</Card.Eyebrow>
            <Card.Body>
              <p className="text-sm text-text-muted">
                Get a fresh 6-character code to share.
              </p>
              <Button
                variant="primary"
                onClick={createSession}
                className="mt-4 w-full"
              >
                Create session
              </Button>
            </Card.Body>
          </Card>

          <Card>
            <Card.Eyebrow>Join with code</Card.Eyebrow>
            <Card.Body>
              <form onSubmit={joinSession}>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-center text-lg tracking-[0.4em] uppercase text-text placeholder:text-text-muted/40 focus:border-border-strong focus:outline-none"
                />
                {joinError && (
                  <p className="mt-2 text-xs text-warn">{joinError}</p>
                )}
                <Button type="submit" className="mt-4 w-full">
                  Join
                </Button>
              </form>
            </Card.Body>
          </Card>
        </div>

        <Card>
          <Card.Eyebrow>Resonance profile</Card.Eyebrow>
          <Card.Body>
            <ProfileBody status={status} />
          </Card.Body>
        </Card>
      </section>
    </main>
  );
}

function ProfileBody({
  status,
}: {
  status: ReturnType<typeof useResonanceProfile>;
}) {
  switch (status.state) {
    case "idle":
    case "loading":
      return <p className="text-sm text-text-muted">Loading your profile…</p>;
    case "no-profile":
      return (
        <p className="text-sm text-text-muted">
          No Resonance profile yet — finish onboarding in Resonance to use
          Ensemble.
        </p>
      );
    case "error":
      return (
        <p className="text-sm text-warn">
          Couldn't load your profile: {status.message}
        </p>
      );
    case "ready":
      return (
        <div className="space-y-2 text-sm">
          <p className="text-text-muted">
            {status.data.themes.length} themes ·{" "}
            {status.data.archetypes.length} archetypes
          </p>
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {status.data.themes.slice(0, 8).map((t) => (
              <li
                key={t.label}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-text"
              >
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      );
  }
}
```

Note: `ProfileBody` lost its `mt-3` on each branch because that spacing now lives in `Card.Body`. Visual parity should hold. The amber warning becomes `text-warn` (terracotta-shifted, per the spec's two-warm-color rule).

- [ ] **Step 2: Verify typecheck and build**

```bash
pnpm typecheck && pnpm build
```

Expected: clean.

- [ ] **Step 3: Manually verify in dev**

```bash
pnpm dev
```

Open the app signed in. Home page should render with the same structure: greeting, two cards (new / join), and the Resonance profile card. Verify the join flow still works (typing `ABC123` should navigate to `/s/ABC123` if the code is valid). Verify the error state by typing an invalid code (e.g. `abc`); the error text should appear in the new terracotta `text-warn` color. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Home.tsx
git commit -m "$(cat <<'EOF'
Migrate Home to ui primitives

Card + Card.Eyebrow + Card.Body replace inline card markup. Button (primary + secondary) replace hand-rolled buttons. Error state moves from amber-200/85 to text-warn (terracotta-shifted). Join-code input stays inline because its centered uppercase shape is one-of-one.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Migrate SessionUI.tsx and apply the hero

**Files:**
- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Replace `SessionUI.tsx` content**

Replace the entire contents of `src/components/SessionUI.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
} from "@liveblocks/react/suspense";
import { LiveList, LiveObject } from "@liveblocks/client";
import type { Candidate } from "../lib/liveblocks";
import { AvatarStack, Button, Card } from "./ui";

type UserInfo = { name?: string; avatarUrl?: string };

const EMPTY_VOTER_LIST: readonly string[] = [];

export function SessionUI({ code }: { code: string }) {
  const candidates = useStorage((root) => root.candidates);
  const votes = useStorage((root) => root.votes);
  const others = useOthers();
  const self = useSelf();
  const { user } = useUser();
  const navigate = useNavigate();

  const userInfoById = useMemo(() => {
    const map = new Map<string, UserInfo>();
    if (self.id) {
      map.set(self.id, {
        name: self.info?.name,
        avatarUrl: self.info?.avatarUrl,
      });
    }
    for (const other of others) {
      if (other.id) {
        map.set(other.id, {
          name: other.info?.name,
          avatarUrl: other.info?.avatarUrl,
        });
      }
    }
    return map;
  }, [self.id, self.info, others]);

  const votedCandidateIds = useMemo(() => {
    const set = new Set<string>();
    if (!self.id) return set;
    for (const [candidateId, voterIds] of votes) {
      if (voterIds.includes(self.id)) set.add(candidateId);
    }
    return set;
  }, [votes, self.id]);

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
    const votesMap = storage.get("votes");
    for (let i = list.length - 1; i >= 0; i--) {
      if (list.get(i)?.get("id") === id) {
        list.delete(i);
        votesMap.delete(id);
        return;
      }
    }
  }, []);

  const castVote = useMutation(({ storage, self }, candidateId: string) => {
    const votesMap = storage.get("votes");
    const list = votesMap.get(candidateId);
    if (!list) {
      votesMap.set(candidateId, new LiveList([self.id]));
      return;
    }
    for (let i = 0; i < list.length; i++) {
      if (list.get(i) === self.id) return;
    }
    list.push(self.id);
  }, []);

  const unvote = useMutation(({ storage, self }, candidateId: string) => {
    const votesMap = storage.get("votes");
    const list = votesMap.get(candidateId);
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list.get(i) === self.id) {
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

        <Card>
          <Card.Eyebrow count={1 + others.length}>In the room</Card.Eyebrow>
          <Card.Body>
            <ul className="flex flex-wrap gap-2">
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
          </Card.Body>
        </Card>

        <CandidatesPanel
          candidates={candidates}
          votes={votes}
          userInfoById={userInfoById}
          votedCandidateIds={votedCandidateIds}
          onAdd={addCandidate}
          onRemove={removeCandidate}
          onVote={castVote}
          onUnvote={unvote}
        />
      </section>
    </main>
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
    <Card>
      <Card.Eyebrow>Session code</Card.Eyebrow>
      <Card.Body>
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-label={`Session code ${code}`}
            className="rounded-md border border-border px-3 py-2 font-mono text-2xl tracking-[0.3em] text-text select-all"
          >
            {code}
          </span>
          <Button size="sm" onClick={() => copy(code, "code")}>
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
          <Button size="sm" onClick={() => copy(url, "link")}>
            {copied === "link" ? "Copied" : "Copy link"}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

function CandidatesPanel({
  candidates,
  votes,
  userInfoById,
  votedCandidateIds,
  onAdd,
  onRemove,
  onVote,
  onUnvote,
}: {
  candidates: readonly { readonly id: string; readonly title: string }[];
  votes: ReadonlyMap<string, readonly string[]>;
  userInfoById: ReadonlyMap<string, UserInfo>;
  votedCandidateIds: ReadonlySet<string>;
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
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
    <Card>
      <Card.Eyebrow count={candidates.length}>Candidates</Card.Eyebrow>
      <Card.Body>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a title…"
            maxLength={120}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-border-strong focus:outline-none"
          />
          <Button type="submit" variant="primary" disabled={!draft.trim()}>
            Add
          </Button>
        </form>

        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            No candidates yet. Add the first one.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {candidates.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                voterIds={votes.get(c.id) ?? EMPTY_VOTER_LIST}
                userInfoById={userInfoById}
                voted={votedCandidateIds.has(c.id)}
                onVote={onVote}
                onUnvote={onUnvote}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
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
    <li className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-text">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-5 w-5 rounded-full"
        />
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

function CandidateRow({
  candidate,
  voterIds,
  userInfoById,
  voted,
  onVote,
  onUnvote,
  onRemove,
}: {
  candidate: { readonly id: string; readonly title: string };
  voterIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  voted: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm">
      <span className="min-w-0 truncate">{candidate.title}</span>
      <div className="flex shrink-0 items-center gap-3">
        <AvatarStack
          userIds={voterIds}
          userInfoById={userInfoById}
          size="md"
          max={3}
          showCount
          highlight={voted}
        />
        <Button
          size="sm"
          variant={voted ? "primary" : "secondary"}
          onClick={() =>
            voted ? onUnvote(candidate.id) : onVote(candidate.id)
          }
        >
          {voted ? "Voted" : "Vote"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onRemove(candidate.id)}>
          remove
        </Button>
      </div>
    </li>
  );
}
```

Notes on what changed beyond the migration:

- `RoomCodeCard` and `CandidatesPanel` now use `Card` and `Card.Eyebrow`. The "Copy code" / "Copy link" buttons become `Button size="sm"` (secondary).
- The "in the room" section becomes a `Card` wrapping the existing chip list. `MemberChip` stays inline because identity (avatar + name) is its job, not convergence celebration. Border swaps from `border-white/10` to `border-border` to use the system token.
- `CandidateRow` uses `AvatarStack size="md"` with `highlight={voted}`. The "you voted" ring fires here.
- The "Vote" / "Voted" toggle uses Button's `primary` variant when voted (saffron), `secondary` when not. This is a brand-touch saffron use the spec endorses.
- The "remove" link becomes a ghost Button.
- The "← Ensemble" header back button stays inline (one-of-one shape, not a primitive candidate).

- [ ] **Step 2: Verify typecheck and build**

```bash
pnpm typecheck && pnpm build
```

Expected: clean.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all primitive tests still pass.

- [ ] **Step 4: Manually verify in dev with two browsers**

```bash
pnpm dev
```

Open the app in two browsers (or one normal + one private window) signed in as different Clerk users. Create a session in browser A, copy the code, join in browser B.

Verify:

- Both users appear in the "In the room" chip list with names visible.
- Adding a candidate in A appears in B.
- Voting in B: face appears in the candidate's `AvatarStack` with a spring entrance animation. Stack on the voted candidate gains a saffron ring on B's screen. The "Vote" button on the voted row goes from secondary to primary (saffron) on B's screen.
- A sees B's vote arrive: B's avatar springs into the stack with the same animation. A's "Vote" button on that row stays secondary (A has not voted yet).
- A votes too: A's avatar springs into the stack on both screens. Saffron ring appears around the stack on A's screen. Stack overflow shows the count next to it.
- Unvoting: avatar disappears (no exit spring), ring goes away, button drops back to secondary.
- Remove a candidate: row disappears on both screens.
- Browser console: no errors, no Liveblocks warnings.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Migrate SessionUI to ui primitives + apply voter convergence hero

Card + AvatarStack + Button replace inline duplications. CandidateRow voter stack goes from size sm (20px) to md (28px) with a saffron ring when the user has voted. In-the-room presence keeps its chip list (identity, not convergence). Vote button uses primary (saffron) when voted, secondary when not, completing the brand-touch saffron path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Verification and final cleanup

**Files:**
- Possibly small edits to remove any stragglers caught by the grep.

- [ ] **Step 1: Grep for remaining inline tokens**

```bash
grep -rE "border-white/|bg-white/\[" src/
```

Expected: zero matches.

If there are matches: read each, decide whether the file should be migrated to a token (likely) or whether the inline class is a legitimate one-off (rare). For inline tokens, edit the file to use the new tokens (`border-border`, `bg-surface`, etc.). Commit the cleanup separately:

```bash
git add <files>
git commit -m "$(cat <<'EOF'
Clean up remaining inline white/border tokens to system tokens

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Run all checks**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

Expected: every command exits 0.

- [ ] **Step 3: Push the branch**

```bash
git push
```

Per the project's commit-and-push cadence memory, push at meaningful checkpoints. End of the visual-system overhaul is one.

- [ ] **Step 4: Update CLAUDE.md state**

Find the `## Current state` section in `CLAUDE.md`. Update the phase line to reflect that the visual system has shipped and the next step is consensus flow:

```markdown
**Phase**: Visual system shipped (tokens, primitives, voter-convergence hero). Next: build step 6 (consensus flow).
```

Also update the "Architectural decisions locked" list to add an entry:

```markdown
11. Visual system: tokens-driven (saffron + terracotta on dark, IBM Plex pair, six-step type scale). See decisions.md and docs/superpowers/specs/2026-05-09-visual-system-design.md.
```

And update the "Conventions to lock when scaffolding" Status line: tests are now Vitest + happy-dom + RTL (logged in decisions.md), so remove that bullet from the TBD list.

- [ ] **Step 5: Add a "Decision" entry for visual system in `decisions.md`**

Append:

```markdown
## [2026-05-09] — Visual system: token-driven, saffron + terracotta on dark

**Considered**: Lean polish on existing inline Tailwind, design system in component primitives only, full token-driven system in @theme + primitives.
**Decision**: Token-driven system in Tailwind v4 @theme + four primitives (Button, Card, Eyebrow, AvatarStack). IBM Plex Sans + Plex Mono. Saffron (#E8A857) for brand/social/consensus, terracotta (#DB7B47) for warnings. One Framer Motion spring on AvatarStack vote-lands.
**Why**: Tokens in one file are extractable; the cross-site audit (Resonance + Constellation + Ensemble at ~95% complete) needs a system to harmonize against, not a pile of styled components. Plex Sans + Plex Mono are designed as a paired family which makes the eyebrow-mono / body-sans relationship intentional rather than coincidental. Saffron and terracotta as two warm hues rather than one shared amber prevents "consensus reached" and "couldn't load profile" from looking the same.
**Tradeoff accepted**: One more font import, two more color tokens, and one runtime motion library compared to "polish in place." Worth it for the durable system artifact.
**Would revisit if**: We add a light theme (would need a parallel set of tokens), the cross-site audit picks a different shared palette, or Framer Motion gets superseded by a smaller alternative we adopt elsewhere.
```

- [ ] **Step 6: Commit and push the meta updates**

```bash
git add CLAUDE.md decisions.md
git commit -m "$(cat <<'EOF'
Log visual system decision and refresh CLAUDE.md state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Self-review

### Spec coverage

Walking the spec and pointing at tasks:

- **Color tokens** → Task 1
- **Type tokens (Plex pair)** → Task 1
- **Six-step type scale** → applied as utility classes inline in migrations (Tasks 8, 9, 10); the scale itself is documented in the spec, not a token, so no separate task is needed
- **Spacing vocabulary** → applied inline in migrations
- **Motion tokens** → Task 1 + Task 6 (consumed by AvatarStack)
- **Button primitive** → Task 4
- **Card primitive** → Task 5
- **Eyebrow primitive** → Task 3
- **AvatarStack primitive** → Task 6
- **Voter convergence hero (avatar size up, vote-lands motion, "you voted" ring)** → Task 6 (primitive supports it) + Task 10 (applied in CandidateRow)
- **Migration order: globals.css → primitives → Landing → Home → SessionUI** → Tasks 1, 3-6, 8, 9, 10 in this order
- **Verification grep returns zero** → Task 11
- **Test setup decision (Vitest + happy-dom)** → Task 0

No gaps.

### Placeholder scan

No "TBD", "implement later", or "add error handling" without code. Every code step shows the actual code. Migration steps show full file contents to avoid "make similar changes elsewhere." All commands have expected output.

### Type consistency

- `AvatarStackProps` uses `userInfoById: ReadonlyMap<string, UserInfo>` — same shape used in `SessionUI.tsx` (Task 10). UserInfo has `name?: string; avatarUrl?: string` consistently across primitive and consumer.
- `Button` `variant` and `size` types match between Task 4 definition and Task 9 / Task 10 usage.
- `Card.Eyebrow` accepts `count?: number` consistently (Task 5 implementation, Task 9 / Task 10 usage).

No drift detected.
