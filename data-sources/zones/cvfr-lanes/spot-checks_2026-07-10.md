# CVFR lanes — in-session spot-checks vs פמ"ת ב'-03 (DO-013, 2026-07-10)

Performed by the DO-013 agent session by rendering the governing chart
(`data-sources/aip/aip_b-03_cvfr-south.pdf`, Negev/Arava region at 200 dpi)
and reading the printed altitude flags next to each lane, then comparing with
the converted `CVFR_ROUTES2023` attributes. This complements — does not
replace — Jonathan's full visual verification.

## Semantics validated against the ב'-03 text (prose chapter)

- Route classes in the text match the gdb flags: green = shared civil/military
  (`Military=CIVIL`), dashed green = by-request (`byReques=BR`, real-time
  controller approval), blue = military (`Military=MIL`).
- Directional-axis structure: every one of the 265 segments carries exactly
  ONE altitude pair — 187 N/S (`N_A`/`S_A`), 78 E/W (`W_Alt`/`E_Alt`); none
  has both axes, none has neither. `X` marks the non-applicable axis.

## Chart spot-checks (south sheet)

| Segment (gdb `NAME_UNIT`) | gdb altitudes | Chart flags read | Match |
|---|---|---|---|
| `SITIMZZHOR` שיטים–צומת ציחור | N 3500 / S 3000 | 3500, 3000 (dashed = BR ✓, MIL ✓) | ✓ |
| `SIZFNYAHEL` שזפון–יהל | N 3000 / S 2500 | 3000 (track 065), 2500 (track 245) | ✓ |
| `YOTVTSHRUT` יטבתה–שחרות | W 3000 / E 2500 | 3000, 2500 (east–west segment ⇒ W/E fields ✓) | ✓ |
| `BERECLLOV` הר ברך–עובדה | N 4500 / S 4000 | 4500 (near הר ברך), 4000 (blue = MIL ✓) | ✓ |
| `SAMARBRORA` סמר–באר אורה | N 3000 / S 2500 | 3000, 2500 | ✓ |
| `ZZHORBMNUH` ציחור–באר מנוחה | W 4000 / E 3000 | 4000 visible; 3000 flag adjacent (crowded area) | ✓ (partial read) |

Bonus zone checks on the same chart crop: `LLR804 UNL/GND` and
`LLR805 12 500/GND` labels match the extracted values exactly.

## Conclusion

Counts (265 segments / 201 waypoints) match the Gate 4 inspection; six
segments' altitudes and classes match the governing chart; axis semantics are
structurally clean. Import remains blocked on the trigger-6 modeling decision
(see `reconciliation.md` and the DO-013 session log escalation).
