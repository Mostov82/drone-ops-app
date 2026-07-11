# Reconciliation — aip-a17-inpa-closures — 2026-07-11

**Sources:** א'-17 appendix ה' tables (pages 30–49) — **governs** — ⊕ INPA `RATAG_kmz.zip` (inner `RATAG_kmz_07092020/RATAG_kmz_07092020.kmz`, stamped 07-09-2020) for geometry, paired by exact code.

## Counts

- appendix ה' entries (governing list): **544** (raw rows 544, duplicates merged/dropped 0)
- KMZ placemarks: **542** (duplicate codes dropped: 0)
- **paired & imported: 542**
- appendix-only — NO geometry, NOT imported: **2** (post-2020 additions; need a newer INPA layer or manual geometry)
- KMZ-only — no governing appendix row, NOT imported: **0**
- AGL-ceiling cross-check: **1** mismatches (appendix kept) · **0** KMZ-only values (noted, not adopted)
- site-name cross-check mismatches (code-paired regardless): **20**
- entries with no AGL ceiling published: **0** · with no name: **0**

## Issue summary

altitude-mismatch: 1 · name-mismatch: 20 · no-geometry: 2

## Issues (text governs — nothing averaged, fuzzy-matched, or guessed)

| Code | Kind | Detail |
|---|---|---|
| LLP1027 | name-mismatch | appendix "אזור נחל מערות" vs KMZ Place "נווה ים" — appendix name used; code-paired, verify visually |
| LLP1052 | name-mismatch | appendix "ת . האכלה עין השופט" vs KMZ Place "ת.האכלה עין השופט" — appendix name used; code-paired, verify visually |
| LLP1084 | name-mismatch | appendix "ואדי אל ב קר" vs KMZ Place "ואדי אל בגר" — appendix name used; code-paired, verify visually |
| LLP1101 | name-mismatch | appendix "אמת המים - ג ' סר אזרקא" vs KMZ Place "אמת המים - ג'סר אזרקא" — appendix name used; code-paired, verify visually |
| LLP1133 | name-mismatch | appendix "חוף וים ג ' סר א - זרקא" vs KMZ Place "חוף וים ג'סר א-זרקא" — appendix name used; code-paired, verify visually |
| LLP1154 | altitude-mismatch | appendix ה' AGL ceiling 1000 ft vs KMZ maxAlt 500 — appendix kept |
| LLP2024 | name-mismatch | appendix "ראש נחל מהר " ל" vs KMZ Place "ראש נחל מהר"ל" — appendix name used; code-paired, verify visually |
| LLP2056 | name-mismatch | appendix "עין ג ' ינדה" vs KMZ Place "עין ג'ינדה" — appendix name used; code-paired, verify visually |
| LLP2098 | name-mismatch | appendix "נחל מהר " ל" vs KMZ Place "נחל מהר"ל" — appendix name used; code-paired, verify visually |
| LLP2132 | name-mismatch | appendix "נבי ע ' ית" vs KMZ Place "נבי ע'ית" — appendix name used; code-paired, verify visually |
| LLP2155 | name-mismatch | appendix "לימן - גבעת הצבע ונים" vs KMZ Place "לימן - גבעת הצבע" — appendix name used; code-paired, verify visually |
| LLP2168 | name-mismatch | appendix "יער מסעדה והג ' ובה הגדולה" vs KMZ Place "יער מסעדה והג'ובה הגדולה" — appendix name used; code-paired, verify visually |
| LLP2181 | name-mismatch | appendix "טוף כרם מהר " ל" vs KMZ Place "טוף כרם מהר"ל" — appendix name used; code-paired, verify visually |
| LLP2212 | name-mismatch | appendix "חאן ומצודת דרכי ם" vs KMZ Place "חאן ומצודת דרכי" — appendix name used; code-paired, verify visually |
| LLP2213 | name-mismatch | appendix "ח ' רבת צ ' רקס" vs KMZ Place "ח'רבת צ'רקס" — appendix name used; code-paired, verify visually |
| LLP2214 | name-mismatch | appendix "ח ' רבת סעדים ועין סעדים" vs KMZ Place "ח'רבת סעדים ועין סעדים" — appendix name used; code-paired, verify visually |
| LLP2235 | name-mismatch | appendix "הר הכרמל נחל כלח גל ונחל מערות" vs KMZ Place "הר הכרמל כלח גל ונחל מערות" — appendix name used; code-paired, verify visually |
| LLP2236 | name-mismatch | appendix "הר הכרמל - נחל חרובים ומהר " ל" vs KMZ Place "הר הכרמל - נחל חרובים ומהרל" — appendix name used; code-paired, verify visually |
| LLP2239 | name-mismatch | appendix "הר דוב " ב" vs KMZ Place "הר דוב"ב" — appendix name used; code-paired, verify visually |
| LLP2243 | name-mismatch | appendix "הר ג ' דיר" vs KMZ Place "הר ג'דיר" — appendix name used; code-paired, verify visually |
| LLP2284 | name-mismatch | appendix "ברכת דוב " ב" vs KMZ Place "ברכת דוב"ב" — appendix name used; code-paired, verify visually |
| LLP2333 | no-geometry | in appendix ה' ("שמורת טבע חי בר") but absent from the KMZ (RATAG_kmz_07092020) — NOT imported; needs a newer INPA layer or manual geometry |
| LLP2334 | no-geometry | in appendix ה' ("שמורת טבע עין גדי") but absent from the KMZ (RATAG_kmz_07092020) — NOT imported; needs a newer INPA layer or manual geometry |

_Everything ships `verified=false` until Jonathan's visual check (GB-06 Gate 3). The KMZ's 2020 vintage makes the ב'-08 / official-map cross-look especially relevant for this layer._
