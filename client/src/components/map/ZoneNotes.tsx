// DO-035 (item 2) — per-zone "special text" and coordination contact, rendered
// inside each triggering zone's row of the location-check panel.
//
// What this component may and may not do (intent doc, IN item 2):
//   * It renders `Zone.notes` VERBATIM, split on the note's own `|` fragments.
//     The prose carries typeHe, definition notes, provenance and source oddities.
//   * Phone numbers that are literally present in that text become `tel:` links.
//     Highlighting an existing number is presentation; producing one would be
//     data invention.
//   * When the imported note carries no phone number, it says so plainly. There
//     is NO fallback authority, NO "try the CAAI switchboard", no inferred
//     contact. Absent means absent.
//
// Structured per-zone contact extraction from א'-17 is DO-036. This component
// shows what today's import actually contains.
import { useTranslation } from "react-i18next";
import { detectPhoneNumbers, splitSegmentParts, splitZoneNotes } from "@/lib/zone-notes";

function SegmentText({ text }: { text: string }) {
  const parts = splitSegmentParts(text);
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "phone" ? (
          <a
            key={i}
            href={`tel:${part.tel}`}
            dir="ltr"
            className="font-mono font-medium text-primary underline underline-offset-2"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export default function ZoneNotes({ notes }: { notes: string | null | undefined }) {
  const { t } = useTranslation();
  const segments = splitZoneNotes(notes);
  const phones = detectPhoneNumbers(notes);

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-border/70 pt-2">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("map.check.notes.title")}
        </div>
        {segments.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1">
            {segments.map((segment, i) => (
              <li
                key={i}
                // `dir="auto"` so mixed Hebrew/Latin AIP prose lays out correctly in
                // both UI languages; `break-words` so long provenance strings and
                // DMS runs wrap instead of overflowing the sidebar (item 4).
                dir="auto"
                className="text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground/90"
              >
                <SegmentText text={segment.text} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t("map.check.notes.none")}</p>
        )}
      </div>

      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("map.check.contact.title")}
        </div>
        {phones.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {phones.map((phone) => (
              <li key={phone.tel} className="text-xs">
                <a
                  href={`tel:${phone.tel}`}
                  dir="ltr"
                  className="font-mono font-medium text-primary underline underline-offset-2"
                >
                  {phone.raw}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          // Honest absence — never softened into a guess (standing stance).
          <p className="mt-1 text-xs text-muted-foreground" dir="auto">
            {t("map.check.contact.none")}
          </p>
        )}
      </div>
    </div>
  );
}
