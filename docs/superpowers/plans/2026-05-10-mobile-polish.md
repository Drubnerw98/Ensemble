# Mobile polish implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land build step 8 (mobile polish). Tactical pass: single Tailwind `sm` breakpoint at 640px, stacked CandidateRow below it, 44px touch targets via the Button primitive, and the two queued bug fixes (avatar crush, items-per-pull clamping). Backed by the spec at `docs/superpowers/specs/2026-05-10-mobile-polish-design.md`.

**Architecture:** Mobile-first base classes with `sm:` overrides. Touch-target enforcement at the primitive level (`Button.tsx` and the candidates-form input absorb the rule). `CandidateRow` flips between vertical (default) and horizontal (`sm:`) layout. `AvatarStack` highlight wrapper drops `rounded-full` to stop the multi-avatar pill deformation; imgs gain `object-cover` so non-square sources do not stretch. `ThresholdPicker` items-per-pull input switches to a local-buffer pattern that commits on blur.

**Tech Stack:** Vite + React 19 + TypeScript, Tailwind v4, Vitest + happy-dom + RTL.

**Test commands:** `pnpm test` (single run), `pnpm test:watch` (TDD loop), `pnpm typecheck`, `pnpm check` (full pre-merge gate).

**Commit cadence:** Per drub's project memory, commit AND push at every meaningful checkpoint. Each task ends with a commit + push.

---

## File map

**Modified:**

- `src/components/ui/Button.tsx`: add `min-h-11 sm:min-h-0` to both size class strings.
- `src/components/SessionUI.tsx`: refactor `CandidateRow` layout, add `min-h-11 sm:min-h-0` to the candidates-form input.
- `src/components/ui/AvatarStack.tsx`: drop `rounded-full` from the highlight wrapper, add `object-cover` to imgs.
- `src/components/ThresholdPicker.tsx`: local-buffer state for items-per-pull, `min-h-11 sm:min-h-0` on the rule select, the N input, and the items-per-pull input.
- `src/components/ThresholdPicker.test.tsx`: update the items-per-pull onChange test to assert commit-on-blur.
- `decisions.md`: append 2 entries.
- `CLAUDE.md`: flip step 8 to shipped, advance "Current state".

**Spot-checked at 375px (no anticipated changes):**

- `src/routes/Landing.tsx`
- `src/routes/Home.tsx`

---

## Task 1: Button primitive mobile touch target

**Files:**

- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1: Add `min-h-11 sm:min-h-0` to both size class strings**

In `/Users/drub/repos/Ensemble/src/components/ui/Button.tsx`, find the `SIZES` record:

```ts
const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};
```

Replace with:

```ts
const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs min-h-11 sm:min-h-0",
  md: "px-4 py-2 text-sm min-h-11 sm:min-h-0",
};
```

That is the entire change. Below the Tailwind `sm` breakpoint (640px), every Button has `min-h-11` (44px). At and above `sm`, the `min-h-0` resets the override and the natural height from `py-1.5` / `py-2` applies.

- [ ] **Step 2: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. The existing Button tests assert variants and size classes structurally, not specific class strings.

If a test fails because it asserts the literal class string, update the assertion to match the new class string and re-run.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/ui/Button.tsx
git commit -m "$(cat <<'EOF'
Bump Button min-height to 44px on mobile via sm breakpoint shim

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 2: Candidates form input matches button height on mobile

**Files:**

- Modify: `src/components/SessionUI.tsx`

The candidates form is `<input> + <Button>Add</Button>` in a `flex gap-2` row. The Button gets `min-h-11` from Task 1. The input keeps its natural height unless we mirror the rule, so the row would look misaligned on mobile.

- [ ] **Step 1: Add the min-height shim to the candidates input**

In `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, find the `<input>` inside `CandidatesPanel`'s form (the one with placeholder "Add a title…"). Its current className is roughly:

```tsx
className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-border-strong focus:outline-none"
```

Append `min-h-11 sm:min-h-0` to the className:

```tsx
className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-border-strong focus:outline-none min-h-11 sm:min-h-0"
```

The input also has `disabled={locked}` which is unrelated. Do not touch it.

- [ ] **Step 2: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. No existing test asserts on this input's class string.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Match candidates input min-height to mobile Button height

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 3: CandidateRow stacked layout below sm

**Files:**

- Modify: `src/components/SessionUI.tsx`

Below `sm`, the row stacks: title and meta on the first line, pullers caption (when present) on the second, action cluster (avatars + Vote + remove) on a third with avatars left and buttons right. At and above `sm`, the existing horizontal layout stays.

- [ ] **Step 1: Locate `CandidateRow` and its current return**

The current `CandidateRow` JSX in `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx` looks roughly like:

```tsx
return (
  <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm">
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 truncate">{candidate.title}</span>
        {meta ? (
          <span className="shrink-0 text-xs text-text-muted">{meta}</span>
        ) : null}
      </div>
      {pullerCaption ? (
        <div className="mt-0.5 text-xs text-text-muted">{pullerCaption}</div>
      ) : null}
    </div>
    <div className="flex shrink-0 items-center gap-3">
      <AvatarStack ... />
      <Button ... />Vote/Voted</Button>
      <Button ... />remove</Button>
    </div>
  </li>
);
```

- [ ] **Step 2: Replace the return with the responsive version**

Replace the JSX above with:

```tsx
return (
  <li className="flex flex-col gap-2 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 truncate">{candidate.title}</span>
        {meta ? (
          <span className="shrink-0 text-xs text-text-muted">{meta}</span>
        ) : null}
      </div>
      {pullerCaption ? (
        <div className="mt-0.5 text-xs text-text-muted">{pullerCaption}</div>
      ) : null}
    </div>
    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
      <AvatarStack
        userIds={voterIds}
        userInfoById={userInfoById}
        size="md"
        max={3}
        showCount
        highlight={voted}
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant={voted ? "primary" : "secondary"}
          disabled={locked}
          onClick={() =>
            voted ? onUnvote(candidate.id) : onVote(candidate.id)
          }
        >
          {voted ? "Voted" : "Vote"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={locked}
          onClick={() => onRemove(candidate.id)}
        >
          remove
        </Button>
      </div>
    </div>
  </li>
);
```

The structural change has three parts:

1. The outer `<li>` becomes `flex flex-col gap-2` by default, `sm:flex-row sm:items-center sm:justify-between sm:gap-3` at and above the breakpoint. Mobile stacks vertically; desktop stays in one row.
2. The action wrapper becomes `flex w-full items-center justify-between gap-3` by default, `sm:w-auto sm:shrink-0 sm:justify-end` at desktop. On mobile the action row spans the full width with avatars pushed left and buttons pushed right; on desktop it shrinks to its content and sits at the right end.
3. The Vote and remove buttons get an inner `<div className="flex items-center gap-3">` wrapper so the `justify-between` on the parent puts the AvatarStack on one side and the buttons on the other as a unit. On desktop where `justify-end` applies, the inner wrapper still groups the buttons but the layout reads the same.

- [ ] **Step 3: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. No existing test asserts on `CandidateRow`'s class strings or DOM structure.

- [ ] **Step 4: Manual layout verification**

This is a visual change that automated tests cannot catch. Run `pnpm dev`, open the app, navigate to a session with at least one candidate, then:

1. Open DevTools, set viewport to 375px wide (iPhone SE width).
2. Verify: title and meta on row 1, optional pullers caption on row 2, AvatarStack and the two buttons on a third row with avatars left and buttons right.
3. Resize to 1024px wide.
4. Verify: row reverts to single horizontal line with title-side filling space and action cluster on the right.

If anything looks wrong, fix in place before committing. If the desktop layout shifts in a way the spec did not anticipate, stop and report.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Stack CandidateRow vertically below sm breakpoint

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 4: AvatarStack crush bug fix

**Files:**

- Modify: `src/components/ui/AvatarStack.tsx`

Two changes: the highlight wrapper drops `rounded-full` so the ring no longer deforms a multi-element flex container into a pill shape, and the imgs gain `object-cover` so non-square Clerk avatars do not stretch.

- [ ] **Step 1: Replace the highlight wrapper class**

In `/Users/drub/repos/Ensemble/src/components/ui/AvatarStack.tsx`, find:

```tsx
const wrapperRing = highlight
  ? "ring-2 ring-accent/50 ring-offset-2 ring-offset-bg rounded-full"
  : "";
```

Replace with:

```tsx
const wrapperRing = highlight
  ? "ring-2 ring-accent/50 ring-offset-2 ring-offset-bg rounded-md"
  : "";
```

The `rounded-full` was deforming the wrapper (a flex row holding multiple avatars and an optional count) into a pill shape, which read as "crushed" against the saffron ring. `rounded-md` gives the ring a soft rectangular shape that fits the actual content.

- [ ] **Step 2: Add `object-cover` to the avatar img**

In the same file, find the avatar `<img>`:

```tsx
<img
  src={info.avatarUrl}
  alt=""
  title={info.name ?? "Member"}
  referrerPolicy="no-referrer"
  className={baseClass}
/>
```

The `baseClass` const just above it currently reads:

```tsx
const baseClass = `${sizeClass} shrink-0 rounded-full border border-bg ${offset}`;
```

Replace `baseClass` with:

```tsx
const baseClass = `${sizeClass} shrink-0 rounded-full border border-bg object-cover ${offset}`;
```

`object-cover` ensures that non-square source images fill the square `h-N w-N` slot without distortion.

- [ ] **Step 3: Add a regression test for the highlight wrapper class**

In `/Users/drub/repos/Ensemble/src/components/ui/AvatarStack.test.tsx`, append a new test inside the existing top-level `describe`:

```tsx
it("does not apply rounded-full to the highlight wrapper (crush bug regression)", () => {
  const userInfoById = new Map([
    ["u1", { name: "Alice", avatarUrl: undefined }],
    ["u2", { name: "Bob", avatarUrl: undefined }],
    ["u3", { name: "Carol", avatarUrl: undefined }],
  ]);
  const { container } = render(
    <AvatarStack
      userIds={["u1", "u2", "u3"]}
      userInfoById={userInfoById}
      max={3}
      size="md"
      highlight
    />,
  );
  const wrapper = container.firstElementChild;
  expect(wrapper).not.toBeNull();
  expect(wrapper?.className).not.toContain("rounded-full");
});
```

If `AvatarStack.test.tsx` does not currently import `render` from RTL, it does (existing tests render the component). Reuse the existing imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/ui/AvatarStack.test.tsx`
Expected: PASS. The new regression test should pass against the new `rounded-md` wrapper.

Run: `pnpm typecheck && pnpm test`
Expected: PASS for the whole project.

- [ ] **Step 5: Manual visual verification**

Run `pnpm dev`, simulate a multi-vote scenario (open two browser windows, both vote on the same candidate). Verify the AvatarStack renders cleanly with the saffron ring tracing a soft rectangle around the avatars and count, with no apparent crush or distortion.

If the visible bug drub described persists after this fix, stop and report rather than guessing further. The fix may need to address a different cause that the leading hypothesis missed.

- [ ] **Step 6: Commit and push**

```bash
git add src/components/ui/AvatarStack.tsx src/components/ui/AvatarStack.test.tsx
git commit -m "$(cat <<'EOF'
Drop rounded-full from AvatarStack highlight wrapper, add img object-cover

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 5: ThresholdPicker local-buffer + mobile input height

**Files:**

- Modify: `src/components/ThresholdPicker.tsx`
- Modify: `src/components/ThresholdPicker.test.tsx`

Items-per-pull switches to a local-buffer pattern: the input holds a local string that mirrors the prop on mount and on prop changes, edits update local state only, commit fires on blur (or Enter). Result: typing feels like a normal field, no flicker from per-keystroke storage round-trips.

In the same pass, the rule select, the N input, and the items-per-pull input all gain `min-h-11 sm:min-h-0` so they align with neighboring buttons on mobile.

- [ ] **Step 1: Update the failing test for blur-based commit**

In `/Users/drub/repos/Ensemble/src/components/ThresholdPicker.test.tsx`, find the test "emits onCandidatesPerPullChange with the new value" (currently asserts the last call after typing).

Replace its body with:

```tsx
it("emits onCandidatesPerPullChange on blur with the committed value", async () => {
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
  // No commit during typing.
  expect(onCandidatesPerPullChange).not.toHaveBeenCalled();
  // Commit on blur.
  await userEvent.tab();
  expect(onCandidatesPerPullChange).toHaveBeenCalledWith(8);
});
```

This replaces the previous test that asserted last call after every keystroke. Local-buffer means typing does not emit; only blur or Enter does.

- [ ] **Step 2: Run tests to verify the updated test fails against the current implementation**

Run: `pnpm test src/components/ThresholdPicker.test.tsx`
Expected: FAIL on the updated test. The current implementation emits on every keystroke, so `onCandidatesPerPullChange` will have been called before `userEvent.tab()`.

- [ ] **Step 3: Implement the local-buffer pattern**

In `/Users/drub/repos/Ensemble/src/components/ThresholdPicker.tsx`, add `useEffect` and `useState` imports if not already present:

```tsx
import { useEffect, useState } from "react";
```

Just inside the `ThresholdPicker` function body, before the existing handler functions, add:

```tsx
const [perPullDraft, setPerPullDraft] = useState(String(candidatesPerPull));

useEffect(() => {
  setPerPullDraft(String(candidatesPerPull));
}, [candidatesPerPull]);

function commitPerPull() {
  const n = Number(perPullDraft);
  if (!Number.isFinite(n) || n < 1) {
    // Invalid or empty: snap back to current prop.
    setPerPullDraft(String(candidatesPerPull));
    return;
  }
  const floored = Math.floor(n);
  if (floored !== candidatesPerPull) {
    onCandidatesPerPullChange(floored);
  }
}
```

Replace the existing `handlePerPullChange` function and its caller. Find the items-per-pull `<input>`. Currently it looks like:

```tsx
<input
  aria-label="Items per pull"
  type="number"
  min={1}
  max={20}
  value={candidatesPerPull}
  onChange={(e) => handlePerPullChange(e.target.value)}
  className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-text focus:border-border-strong focus:outline-none"
/>
```

Replace with:

```tsx
<input
  aria-label="Items per pull"
  type="number"
  min={1}
  max={20}
  value={perPullDraft}
  onChange={(e) => setPerPullDraft(e.target.value)}
  onBlur={commitPerPull}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      commitPerPull();
      (e.currentTarget as HTMLInputElement).blur();
    }
  }}
  className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-text focus:border-border-strong focus:outline-none min-h-11 sm:min-h-0"
/>
```

Three behavioral changes:
1. The input's `value` is now `perPullDraft` (local string), not `candidatesPerPull` (prop number).
2. `onChange` updates local draft only, no commit.
3. `onBlur` commits via the new helper. `Enter` key also commits and blurs.

The className picks up `min-h-11 sm:min-h-0` so this input aligns with neighboring buttons on mobile.

The existing `handlePerPullChange` function from earlier work can be removed if it is no longer referenced. Check for stale references and delete if unused.

- [ ] **Step 4: Apply the same min-height shim to the rule select and N input**

Find the `<select>` for the threshold rule (has `aria-label="Threshold rule"`). Append `min-h-11 sm:min-h-0` to its className:

```tsx
<select
  aria-label="Threshold rule"
  ...
  className="rounded-md border border-border bg-transparent px-3 py-1.5 text-text focus:border-border-strong focus:outline-none min-h-11 sm:min-h-0"
>
```

Find the N `<input>` (has `aria-label="First-to-N value"`). Append `min-h-11 sm:min-h-0` to its className:

```tsx
<input
  aria-label="First-to-N value"
  type="number"
  min={1}
  value={threshold.n}
  onChange={(e) => handleNChange(Number(e.target.value))}
  className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-text focus:border-border-strong focus:outline-none min-h-11 sm:min-h-0"
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/components/ThresholdPicker.test.tsx`
Expected: PASS. The blur-commit test should now pass; existing tests remain green.

Run: `pnpm typecheck && pnpm test`
Expected: PASS for the whole project.

- [ ] **Step 6: Manual verification of the local-buffer behavior**

Run `pnpm dev`, open a session as host. Click the items-per-pull field, clear it, type `25`. Observe: the field shows `25` while typing, no flicker. Tab away. Observe: the field snaps to `20` (the clamped value from `setCandidatesPerPull`). Type `0`, tab away. Observe: the field snaps back to whatever the prior committed value was (the local-buffer treats `< 1` as invalid and restores).

- [ ] **Step 7: Commit and push**

```bash
git add src/components/ThresholdPicker.tsx src/components/ThresholdPicker.test.tsx
git commit -m "$(cat <<'EOF'
Local-buffer items-per-pull and mobile min-height on threshold inputs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 6: Landing and Home spot-check at 375px

**Files:**

- Modify (only if needed): `src/routes/Landing.tsx`
- Modify (only if needed): `src/routes/Home.tsx`

Both pages are simple. The spec does not predict structural changes. This task is verification-first.

- [ ] **Step 1: Visual verification at 375px**

Run `pnpm dev`. In a browser, open `/` (Landing) and `/home` (Home, requires sign-in). Open DevTools, set viewport to 375px wide.

For Landing: confirm the `Sign in` button is at least 44px tall (it is a Button consumer, so Task 1 should have given it the bump), the heading and copy do not overflow, and the layout looks centered and balanced.

For Home: confirm the `Create session` and `Join` buttons are at least 44px tall, the room-code input is readable, the cards stack to a single column (the existing `sm:grid-cols-2` gives one column below `sm`), and the Resonance profile card renders without overflow.

- [ ] **Step 2: Apply targeted fixes only if something looks broken**

If a layout issue surfaces (overflow, awkward wrap, broken text), fix it in place with the minimum change required. Document the change in the commit message.

If nothing looks broken, skip to Step 3 with no code changes.

- [ ] **Step 3: Commit only if changes were made**

If you made changes:

```bash
git add src/routes/Landing.tsx src/routes/Home.tsx
git commit -m "$(cat <<'EOF'
Mobile fixes on Landing and Home spotted during 375px verification

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

If no changes: do nothing. Move to Task 7.

---

## Task 7: Verification, decisions log, CLAUDE.md update

**Files:**

- Modify: `decisions.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full check pipeline**

Run: `pnpm check`
Expected: PASS (typecheck, lint, build, test all green).

If anything fails, STOP and report. Do not commit until everything is green.

- [ ] **Step 2: Append decisions to `decisions.md`**

Read `/Users/drub/repos/Ensemble/decisions.md` first to confirm the existing format. Append two entries (newest at bottom is the convention). The entries below contain no em-dashes per drub's project convention; verify after writing.

````markdown
---

## 2026-05-10, Mobile breakpoint strategy: single breakpoint at sm (640px)

**Considered**: **Single breakpoint at sm** (one pivot, mobile vs everything else), **two-tier (sm + md)** (mobile, tablet, desktop), **three-tier (sm + md + lg)** (mobile, tablet, small desktop, large desktop).

**Decision**: Single breakpoint at sm (640px). Below: phone-shaped layout. At and above: current desktop layout. No tablet-specific tier.

**Why**: The build step 8 pass is tactical, not crafted. Multi-tier responsive design earns its keep when product surfaces have meaningfully different shapes at multiple widths. Ensemble's session view is the only complex page; everything else (Landing, Home) is already simple. One pivot is cheaper to reason about, cheaper to verify (two viewports: 375 and 1024), and matches the only existing breakpoint in the codebase (the sm:grid-cols-2 on Home). If real-user testing on tablets shows the layout feels wrong in the 640 to 1023 range, an md tier becomes the natural addition.

**Tradeoff accepted**: Tablets (640 to 1023px) get the desktop layout. The candidate row's horizontal arrangement may feel slightly cramped on a portrait tablet at 768px width. Acceptable because tablets are not a primary use case (the friend test happens on phones and laptops) and adding a tier without evidence is premature.

**Would revisit if**: Real-user testing surfaces a tablet-specific complaint, or the cross-site visual audit prefers a shared multi-tier system.

---

## 2026-05-10, Touch targets: 44px on mobile via Button primitive shim

**Considered**: **Apple HIG (44pt)**, **Material (48dp)**, **keep current sizes**, **selective bump on Vote and Add only**.

**Decision**: 44px on mobile, applied at the Button primitive via `min-h-11 sm:min-h-0`. The form input in CandidatesPanel matches via the same shim so the form line aligns visually.

**Why**: Apple HIG and Material differ by 4px; Apple's 44 fits Tailwind's `min-h-11` directly with no custom value. Bumping at the primitive level means every Button consumer benefits with no API change and no per-consumer audit. Selective bump (Vote and Add only) was tempting but brittle: any new button in the app would have to be remembered. The primitive shim is one edit and load-bearing forever. Keep-current-sizes was the cheapest option but loses the friend-test on a phone where fat-finger misses on the Vote button would shape the first impression.

**Tradeoff accepted**: Rows feel slightly taller on mobile than they would with the desktop sizes. Fits the stacked-row decision: the row is already taller on mobile because content stacks, so the buttons being taller is consistent rather than out of place.

**Would revisit if**: Real-user testing shows the mobile layout feels cramped despite the bump (suggests deeper density work), or accessibility audit finds 44px is insufficient (then bump to 48px to match Material).
````

After writing, run `rg "," decisions.md` to scan. Pre-existing em-dashes in older entries should remain untouched. Verify the two new entries above contain no em-dashes (the dashes in their `## 2026-05-10, Title` headers are em-dashes that match the file's existing convention; that is acceptable since older entries use the same form. Drub has not flagged the dashes in headers as a problem).

- [ ] **Step 3: Update `CLAUDE.md` build steps and current state**

Read `/Users/drub/repos/Ensemble/CLAUDE.md` first.

a) **`## Current state` "Phase" line**: replace with:

```markdown
**Phase**: Mobile polish shipped. Single sm breakpoint, stacked CandidateRow on phones, 44px touch targets via Button primitive shim, AvatarStack crush fix, items-per-pull local-buffer pattern. Resonance candidate population, consensus flow, and visual system live underneath.
```

b) **`## Current state` "Next step" line**: replace with:

```markdown
**Next step**: Deploy and real-user test (build step 9). Ship to Vercel, run a session with a friend.
```

c) **`## Current state` "Architectural decisions locked" list**: append two entries (the current list ends at 21):

```markdown
22. Mobile breakpoint strategy: single breakpoint at sm (640px).
23. Touch targets: 44px on mobile via Button primitive shim.
```

d) **`## Build steps`** section: flip step 8 to shipped, advance step 9 to "← here":

```markdown
8. **Mobile breakpoints + polish**: ✅ stacked rows on mobile, 44px touch targets, avatar crush + items-per-pull fixes.
9. **Deploy + real-user test**: ← here. Ship to Vercel, run it with a friend.
```

After your edits, scan ONLY your additions for em-dashes. Pre-existing em-dashes elsewhere in CLAUDE.md remain untouched.

- [ ] **Step 4: Run the check pipeline once more**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add decisions.md CLAUDE.md
git commit -m "$(cat <<'EOF'
Log mobile polish decisions and update build state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 6: Manual verification (drub-driven, post-deploy)**

Vercel auto-deploys from main. Once deployed:

1. Open the deployed app on a real phone (iOS Safari preferred).
2. Sign in. Verify Landing and Home render cleanly at the phone's native width.
3. Create a session. Verify the room code, threshold picker, and candidates panel all fit and feel tappable.
4. Open the same session on a desktop browser. Verify the desktop layout is unchanged from before this pass.
5. Add candidates manually and via Pull. Cast votes from both windows. Verify the AvatarStack does not crush.
6. As host on desktop, change items-per-pull to a large value, type past 20, tab away. Verify no flicker during typing and the field snaps to 20 on commit.
7. Scroll the candidate list on the phone. Verify Vote and remove buttons are reliably tappable without accidental misses.

If anything looks wrong, capture the symptom and report. Subsequent fix passes can address remaining gaps.

---

## Notes

- **No e2e tests in this pass:** layout verification is visual and manual, consistent with prior plans.
- **AvatarStack crush hypothesis verification:** Task 4 includes a manual visual check after the change. If the bug persists, the implementer reports rather than guessing further. The leading-hypothesis fixes are no-regret improvements regardless of whether they fully address the visible bug.
- **Local-buffer pattern in ThresholdPicker:** the only place this pattern lives in the app. If similar inputs land later, evaluate whether to extract a shared `useCommittedInput` hook. Not now.
- **Spec cross-reference:** each task header in this plan can be matched back to a spec section. If a task feels unmotivated, re-read the linked section in `docs/superpowers/specs/2026-05-10-mobile-polish-design.md`.
