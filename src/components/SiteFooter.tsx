import { ConvergenceGlyph } from "./ConvergenceGlyph";
import { EcosystemSwitcher } from "./EcosystemSwitcher";

const GITHUB_URL = "https://github.com/Drubnerw98/Ensemble";

/**
 * Page footer. Mirrors the shape used by Resonance and Constellation so
 * the three sibling apps bracket their content with the same chrome.
 *
 * Layout: brand wordmark on the left, EcosystemSwitcher centered, GitHub
 * + attribution on the right. Stacks vertically on narrow viewports.
 *
 * Lives in normal page flow at the bottom of each route's main element.
 * Each route is responsible for placing it; not auto-rendered globally
 * since session views are app-shell shaped and the homepage is more
 * marketing-page shaped, so positioning differs subtly.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-3xl border-t border-border pt-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-2.5">
          <span className="text-accent">
            <ConvergenceGlyph size={14} />
          </span>
          <span className="font-mono text-sm tracking-tight text-text">
            Ensemble
          </span>
        </div>
        <EcosystemSwitcher current="ensemble" size="md" />
        <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.22em] uppercase">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted transition-colors hover:text-text"
          >
            GitHub
          </a>
          <span className="text-border-strong">built with Claude</span>
        </div>
      </div>
    </footer>
  );
}
