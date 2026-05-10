# Mobile polish design

**Date:** 2026-05-10
**Status:** Drafted, awaiting drub review
**Scope:** Build step 8. Tactical pass: make Landing, Home, and Session work correctly on a phone. Single Tailwind breakpoint at `sm` (640px). Stacked CandidateRow on narrow widths. 44px touch targets on mobile via the Button primitive. Fix the two queued bugs (avatar crush, items-per-pull clamping). No layout restructure beyond the row stack, no parked items unparked.

## Why now

Build step 9 is "deploy + real-user test." The friend test is the moment Ensemble first meets non-drub users, and a meaningful share of those friends will join from a phone. The current codebase has effectively zero responsive work (one `sm:grid-cols-2` on Home, nothing else), so today's mobile experience is "desktop layout shrunk down" with at least one visible bug (avatar crush on multi-vote rows). Polishing before the friend test means real-user feedback can focus on product feel rather than "I couldn't tap the Vote button on my phone."

The work also blocks the visual cross-site audit: harmonizing tokens across Resonance, Constellation, and Ensemble can't happen against a target that breaks on its own at 375px.

## Locked design decisions

These were settled in brainstorming and are not in scope to revisit during implementation.

1. **Tactical pass, not crafted redesign.** Same desktop layout, just doesn't break on phones. Fix the queued bugs. No mobile-first density variants, no session-arrival animation, no parked items unparked.
2. **Single breakpoint at Tailwind's `sm` (640px).** Below 640px = phone-shaped layout. At and above = current desktop layout. No tablet-specific tier.
3. **CandidateRow stacks below `sm`.** Title and meta on row 1; pullers caption on row 2 (when present); action cluster (avatars left, Vote and remove right) on row 3.
4. **Touch targets bumped to 44px on mobile.** Implemented in the `Button` primitive once. The form input in `CandidatesPanel` matches the new height so the form line stays visually aligned.
5. **Single primitive for the bump.** No new `mobile-md` Button size variant. Existing `sm` and `md` sizes get a `min-h-11 sm:min-h-0` shim so consumers don't need to know about it.

## Architecture

This isn't a feature with a state machine. It's a layout sweep across three pages and a few primitives. The architecture is the policy and the seams.

### Policy

- **Mobile-first base classes, sm+ overrides.** Tailwind's standard pattern. Every responsive rule reads as "default is mobile; sm: bumps for desktop." Matches the existing `sm:grid-cols-2` on Home.
- **Breakpoint stays `sm` everywhere.** No mixing in `md:` or `lg:`. One pivot. Easier to reason about; easier to test (just two widths: 375 and 1024).
- **Touch-target enforcement at the primitive level.** `Button` and the candidates-form input absorb the rule. Application code does not sprinkle `min-h-11` at call sites.
- **AvatarStack stays a primitive.** The "crush" bug fix lives inside `AvatarStack`, not in `CandidateRow`'s use of it. The component should look right at any reasonable width with any reasonable input.

### Seams that matter

- `src/components/ui/Button.tsx`: gains the mobile min-height shim. Verifies that consumers (Vote, remove, Add, Reconsider, Pull from my Resonance) all benefit without code changes.
- `src/components/SessionUI.tsx`: `CandidateRow` flips between horizontal (sm:flex-row) and vertical (default flex-col) at the breakpoint. The form input gets the matching min-height.
- `src/components/ui/AvatarStack.tsx`: gets the bug fix. See the section below.
- `src/components/ThresholdPicker.tsx`: spot check only. Already wraps via `flex flex-wrap`.
- `src/routes/Landing.tsx` and `src/routes/Home.tsx`: spot check at 375px during verification. No changes anticipated.

## UX

### CandidateRow on mobile

Below the `sm` breakpoint, the row stacks vertically:

```
[Dune Part Two]
(movie, 2024)
added by Alice and Bob
[oo o +2]                    [Vote] [remove]
```

Title and meta on top, pullers caption on the second line (when non-null), and a third row with the avatar stack pushed left and the action buttons pushed right. The action row uses `justify-between` so avatars and buttons sit at opposite ends regardless of count.

Above `sm`, the existing horizontal layout stays:

```
[Dune Part Two (movie, 2024)]                [oo o +2] [Vote] [remove]
added by Alice and Bob (caption sits under title within the left column)
```

The break point isn't fancy: `flex-col gap-2 sm:flex-row sm:items-center sm:gap-3` on the `<li>`. The action cluster gets `flex w-full justify-between sm:w-auto sm:justify-end` so it spans the row on mobile and shrinks to its content on desktop.

### Touch targets

`Button` primitive change:

```tsx
const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs min-h-11 sm:min-h-0",
  md: "px-4 py-2 text-sm min-h-11 sm:min-h-0",
};
```

The `min-h-11` (44px) applies below `sm`; `sm:min-h-0` removes it at desktop, restoring the natural height from `py-1.5`/`py-2`. No API change. Every consumer of every Button gets phone-tappable on mobile and desktop-dense on desktop.

The form input (manual title entry in `CandidatesPanel`) gets the same shim:

```tsx
className="flex-1 rounded-md border ... min-h-11 sm:min-h-0 ..."
```

so the input and the Add button visually align on the same line on mobile.

### Avatar crush bug

Investigation results, leading hypothesis (verified during implementation, not now):

The `AvatarStack` highlight wrapper currently applies `rounded-full` to a flex container that holds multiple avatars plus an optional count number. A non-square container with `rounded-full` deforms into a pill, and combined with the saffron ring the visual reads as a "crushed" stack rather than a row of circles inside a ring.

Fix: replace `rounded-full` on the wrapper with `rounded-2xl` (or move the ring to wrap only the inner avatar group, not the whole flex including the count). Verify in browser.

Secondary hypothesis (also addressed in the same pass): each `<img>` avatar lacks `object-fit`. Browsers default to `fill`, which stretches non-square images. Adding `object-cover` to the img class chain prevents stretching for any non-square Clerk avatars.

If either hypothesis turns out wrong on inspection, the implementer reports back rather than guessing further.

### Items-per-pull clamping

Currently the controlled input `value={candidatesPerPull}` round-trips through Liveblocks storage on every keystroke. Typing `0` or `25` shows that value in the field until the storage clamp ships back the corrected value. Visible flicker for the host typing.

Fix: convert to controlled-with-local-buffer pattern in `ThresholdPicker`. Local `useState` mirrors the prop on mount and on prop changes (when prop differs from local). Edits update local state; commit to parent fires on blur or Enter. Result: typing feels like a normal text field, no flicker, and the parent only hears finalized values.

This is a small contained change inside `ThresholdPicker`, no consequences elsewhere.

### Landing and Home spot-check

Both pages are simple already. Landing is a sign-in pitch with a single CTA. Home has a `sm:grid-cols-2` already and otherwise lays out content with `max-w-3xl` which fits any phone width minus the sides.

The verification step is: open both pages at 375px width, confirm nothing overflows or wraps awkwardly. If something does, fix in place; this spec doesn't predict structural changes.

### Empty states

The existing empty state copy (`"No candidates yet. Add the first one or pull from your Resonance."`) renders fine on phones today. No new copy or structural changes. The threshold "N greater than present count" warning already wraps via `flex flex-wrap`. No work here beyond verification.

### Other surfaces

- **RoomCodeCard**: room code + "Copy code" + "Copy link" already wraps via `flex flex-wrap`. Touch targets get bumped via the Button primitive change. No structural change.
- **Presence card** (`In the room`): MemberChip pills are inside `flex flex-wrap`. Already wraps. No structural change.
- **HeroCard**: motion-wrapped Card with title + voter avatars + Reconsider button. Title is `text-2xl` which is large but not overflowing on a 375px width when truncated. Reconsider button gets the touch-target bump. Verify; expect no structural change.
- **ThresholdPicker**: rule select + N input + items-per-pull input + warning text. Already in `flex flex-wrap` rows. The Button primitive change doesn't help these inputs because they are `<input>` and `<select>`, not Button. Apply the same `min-h-11 sm:min-h-0` shim directly to the select and number inputs as part of this pass so the row aligns visually with any neighboring buttons on mobile.

## Edge cases

- **Long candidate title**: existing `min-w-0 truncate` behavior preserved. On mobile stack, title takes the full width and truncates if very long.
- **Many voters (5+)**: AvatarStack already shows max 3 + count; the count number stays readable on mobile after the bug fix.
- **Single member room**: presence card shows one chip. Fine.
- **No Resonance profile (Pull button disabled)**: existing tooltip + disabled state. Spot-check that the disabled affordance reads clearly on a phone where hover tooltips don't exist; if not, surface the message inline (already true via the helper text in `PullControl`).
- **Multi-line pullers caption**: with 4+ pullers the caption is "added by Alice and 3 others" so it stays one line. With 2 pullers it's "added by Alice and Bob" which can wrap on very narrow widths; acceptable.
- **Tablet (640px to 1023px)**: gets the desktop layout per the single-breakpoint policy. If real-user testing shows tablets feel awkward, a future `md:` tier can be added.

## Testing

This pass is primarily verified manually on a real device, not by adding new automated tests. Existing 81 tests must continue to pass.

If the AvatarStack bug fix is non-trivial (e.g., changes the prop API or visual structure), add a regression test in `AvatarStack.test.tsx` that verifies the highlight wrapper does not apply `rounded-full` to multi-avatar layouts. Otherwise, no new tests.

The form input + button alignment can't be unit-tested cleanly (it's a visual property). Manual verification.

## Decisions to log to `decisions.md`

After spec approval, append two entries:

1. **Mobile breakpoint strategy: single breakpoint at `sm` (640px).** Considered single, two-tier (sm + md), three-tier (sm + md + lg). Chose single because tactical pass scope doesn't earn the complexity of multi-tier, and the codebase already has only one breakpoint elsewhere.
2. **Touch targets: 44px on mobile via Button primitive shim.** Considered Apple HIG (44pt), Material (48dp), keep-current. Chose 44px via primitive-level `min-h-11 sm:min-h-0` so every consumer benefits without API change.

The CandidateRow stack and the two bug fixes are implementation choices, not architecturally interesting calls. They don't need decision-log entries.

## Out of scope

- **Two-column desktop layout**: stays parked in `docs/followups.md`.
- **Density variants beyond touch-target bumps**: mobile-first denser content patterns are deferred until real-user feedback shows they're load-bearing.
- **Session-arrival animation**: stays parked.
- **Light theme**: stays parked.
- **Cross-site visual audit**: stays parked until all three apps reach 95% complete.
- **Tablet-specific tier (sm to md range)**: deferred. If friend testing shows tablets feel wrong, revisit.
- **Accessibility audit beyond touch targets**: out of scope; tracked separately.
- **Performance work**: not in this pass; the app is small enough that nothing has shown up as slow.
