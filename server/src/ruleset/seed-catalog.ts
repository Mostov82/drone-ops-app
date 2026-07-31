// Regulations Ruleset seed catalog — GB-02 Gate 1 resolution, 2026-07-10
// This module is the ONLY sanctioned place where
// regulatory values exist outside the database (conventions §4): it provisions
// them INTO the database. All values seed unverified (lastVerifiedAt null);
// verification is GB-02 Gate 2 / GB-06 Gate 3.
//
// registration_weight_threshold_g seeds with NO value by explicit Gate 1
// decision — no number exists in any project source. Filling it is Gate 2
// primary-source research, never code.
import type { PrismaClient } from "@prisma/client";

export type RuleSeed = {
  key: string;
  category: string;
  label: string;
  valueType: "NUMBER" | "BOOLEAN" | "TEXT";
  numberValue?: number;
  boolValue?: boolean;
  textValue?: string;
  unit?: string;
  description?: string;
};

export const RULESET_SEED: RuleSeed[] = [
  {
    key: "max_altitude_agl_m",
    category: "ALTITUDE",
    label: "Maximum altitude above ground level",
    valueType: "NUMBER",
    numberValue: 50,
    unit: "m",
    description: "Recreational baseline ceiling above ground level.",
  },
  {
    key: "min_distance_people_structures_m",
    category: "DISTANCE",
    label: "Minimum distance from people and structures",
    valueType: "NUMBER",
    numberValue: 250,
    unit: "m",
    description: "Horizontal buffer from uninvolved people and occupied structures.",
  },
  {
    key: "airport_buffer_km",
    category: "DISTANCE",
    label: "Airport / airfield buffer",
    valueType: "NUMBER",
    numberValue: 2,
    unit: "km",
    description: "No-fly buffer around airports and airfields.",
  },
  {
    // DO-015 escalation 1 resolution, DECISION 2026-07-13 (DO-015
    // Amendment 1): the CVFR lane corridor width is editable Ruleset data
    // sourced from the governing ב'-03 text — never a constant in code.
    // Seeds unverified like everything. (Citation date corrected in
    // supervisor verification 2026-07-13.)
    key: "cvfr_lane_halfwidth_km",
    category: "DISTANCE",
    label: "CVFR lane corridor half-width",
    valueType: "NUMBER",
    numberValue: 1,
    unit: "km",
    description:
      'Half-width of a CVFR low-transport-route corridor, measured from the published centerline. Source (governing text): AIP פמ"ת ב\'-03 §2.ב (page ב-03-2, עדכון 2/25 · 02 Oct 2025): "רוחב הנתיבים הינו 2 ק"מ (1 ק"מ מכל צד של מרכז הנתיב) אלא אם מצוין אחרת" — route width 2 km, 1 km each side of the centerline, unless stated otherwise. Per-lane exceptions ("unless stated otherwise") are NOT modeled; verify against the ב\'-03 chart sheets (GB-06 Gate 3). Added per DECISION 2026-07-13 (DO-015 escalation 1 resolution / Amendment 1).',
  },
  {
    key: "vlos_required",
    category: "OPERATIONAL",
    label: "Visual line of sight required",
    valueType: "BOOLEAN",
    boolValue: true,
    description: "The drone must remain within the operator's unaided visual line of sight.",
  },
  {
    key: "daylight_only",
    category: "OPERATIONAL",
    label: "Daylight operations only",
    valueType: "BOOLEAN",
    boolValue: true,
    description: "Flights are permitted during daylight hours only.",
  },
  {
    key: "min_registration_age_years",
    category: "LICENSING",
    label: "Minimum registration age",
    valueType: "NUMBER",
    numberValue: 16,
    unit: "years",
    description: "Minimum operator age for registration.",
  },
  {
    key: "moc_frequency_license_required",
    category: "LICENSING",
    label: "MoC frequency license required",
    valueType: "BOOLEAN",
    boolValue: true,
    description:
      "A Ministry of Communications frequency license is required in addition to the CAAI license (PRD FR-A1, amended 2026-07-07).",
  },
  {
    key: "permit_fee_recreational_nis",
    category: "PERMITS",
    label: "Recreational permit fee",
    valueType: "NUMBER",
    numberValue: 30,
    unit: "NIS",
    description: "Fee for a recreational flight permit.",
  },
  {
    key: "permit_turnaround_hours_min",
    category: "PERMITS",
    label: "Permit turnaround (minimum)",
    valueType: "NUMBER",
    numberValue: 48,
    unit: "h",
    description: "Typical minimum processing time for a flight permit.",
  },
  {
    key: "permit_turnaround_hours_max",
    category: "PERMITS",
    label: "Permit turnaround (maximum)",
    valueType: "NUMBER",
    numberValue: 72,
    unit: "h",
    description: "Typical maximum processing time for a flight permit.",
  },
  {
    key: "registration_weight_threshold_g",
    category: "WEIGHT",
    label: "Registration weight threshold",
    valueType: "NUMBER",
    unit: "g",
    description:
      "Drones at or above this weight require registration. Unset pending primary-source verification (GB-02 Gate 2).",
  },
];

/**
 * Idempotent: upsert by unique key with an empty update, so re-seeding never
 * duplicates rules and never clobbers values later edited through the app.
 */
export async function seedRuleset(prisma: PrismaClient): Promise<void> {
  // Clean up old cvfr_lane_half_width_m if it exists to prevent duplicates.
  await prisma.regulationRule.deleteMany({ where: { key: "cvfr_lane_half_width_m" } });

  for (const rule of RULESET_SEED) {
    await prisma.regulationRule.upsert({
      where: { key: rule.key },
      update: {},
      create: {
        key: rule.key,
        category: rule.category,
        label: rule.label,
        valueType: rule.valueType,
        numberValue: rule.numberValue ?? null,
        boolValue: rule.boolValue ?? null,
        textValue: rule.textValue ?? null,
        unit: rule.unit ?? null,
        description: rule.description ?? null,
        lastVerifiedAt: null,
      },
    });
  }
}
