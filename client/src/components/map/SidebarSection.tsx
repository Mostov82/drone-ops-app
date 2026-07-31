// DO-035 (item 1) — hand-rolled collapsible sidebar section.
//
// By design, a hand-rolled accordion is ~30 lines, so no new UI library is
// introduced here. Uses a plain <button> with
// aria-expanded/aria-controls so the section is keyboard- and screen-reader
// reachable without any dependency.
//
// Collapsing is presentation only: it never removes a control from the page, and
// the honesty surfaces (unverified / approximate / data-quality) live inside the
// sections unchanged — reorganized, never softened (standing product stance).
import { useId } from "react";

export default function SidebarSection({
  title,
  open,
  onToggle,
  /** Optional short right-aligned summary shown in the header (e.g. a count). */
  summary,
  children,
  testId,
}: {
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  summary?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  const contentId = useId();
  return (
    <section
      // NOT `overflow-hidden`. With the sidebar bounded to the viewport height,
      // clipping here silently truncated the verdict card — the data-quality
      // caveat list was cut off with no way to scroll to it. A clipped honesty
      // surface is a hidden honesty surface, so the section must never clip; the
      // sidebar itself is the scroll container. (Caught in browser, DO-035.)
      className="shrink-0 rounded-lg border border-border bg-background"
      data-testid={testId}
    >
      <h2>
        <button
          type="button"
          onClick={() => onToggle(!open)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm font-semibold hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {/* Chevron. Open points down (rotate-90) — direction-neutral, correct in
              both scripts. Collapsed points along the reading direction, so it must
              flip to point LEFT in RTL (verified in the Hebrew layout). */}
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 ${
              open ? "rotate-90" : "rtl:rotate-180"
            }`}
          >
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="min-w-0 flex-1 break-words" dir="auto">
            {title}
          </span>
          {summary !== undefined && (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">{summary}</span>
          )}
        </button>
      </h2>
      {open && (
        <div id={contentId} className="border-t border-border px-3 py-3">
          {children}
        </div>
      )}
    </section>
  );
}
