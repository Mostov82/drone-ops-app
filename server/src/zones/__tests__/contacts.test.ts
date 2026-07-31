// DO-036 session 2 — coordination-contact extraction fixtures.
// Fixture texts reproduce the א'-17 dump's REAL typographic shapes (fused
// tokens, digits-first codes, bidi-displaced punctuation, split phones) so the
// tests pin the documented normalization, the exact-code association
// discipline (trigger 3) and the notes-append format DO-035 renders.

import { describe, expect, it } from "vitest";
import type { A17Dump } from "../a17.js";
import {
  appendContactNotes,
  extractCoordinationContacts,
  normalizeTokens,
  type ContactAttachment,
} from "../contacts.js";
import type { ZoneFeatureCollection } from "../dataset.js";

function dump(text: string): A17Dump {
  return {
    source: { pdf: "fixture.pdf", pageCount: 1 },
    pages: [{ page: 1, text, tables: [] }],
  };
}

const FIRST_APPENDIX = 99; // fixtures are all main-text prose

describe("normalizeTokens", () => {
  it("splits fused Hebrew↔digit tokens and keeps phones verbatim", () => {
    expect(normalizeTokens(["בטלפון050-1234567"])).toEqual(["בטלפון", "050-1234567"]);
  });

  it("rejoins a phone split across lines", () => {
    expect(normalizeTokens(["054-", "2021535"])).toEqual(["054-2021535"]);
  });

  it("repairs the visually-reversed phone form", () => {
    expect(normalizeTokens(["9599800", "-", "09"])).toEqual(["09-9599800"]);
  });

  it("rejoins digits-first zone codes", () => {
    expect(normalizeTokens(["03", "LLP,"])).toEqual(["LLP03,"]);
  });

  it("spaces fused dual phones so both stay detectable numbers", () => {
    expect(normalizeTokens(["073-1234567/052-7654321"])).toEqual([
      "073-1234567",
      "/",
      "052-7654321",
    ]);
  });

  it("keeps alternate-last-digit forms as published", () => {
    expect(normalizeTokens(["08-9902926/8"])).toEqual(["08-9902926/8"]);
  });

  it("drops a bidi-displaced paren inserted mid-word", () => {
    expect(normalizeTokens(["(בועז", "צרפ)תי"])).toEqual(["בועז", "צרפתי"]);
  });
});

describe("extractCoordinationContacts — exact-code association", () => {
  it("attaches an entry-block sentence to exactly its zone (fused phone form)", () => {
    const d = dump(
      "ג.\n \n03\nLLP\n ,ה אזור\nה\nאסור \"מכון דוד\"\n : מגובה פני הקרקע ועד גובה3000\n \n רגל\nמעל פני הים ,לתיאום טיסה במרחב זה יש ליצור קשר עם \n מב\"ט אבטחה\n מכון דוד בטלפון050-3384198\n. \nד.\n \n04\nLLP\n ,ה אזור אחר ללא תיאום. \n",
    );
    const result = extractCoordinationContacts(d, FIRST_APPENDIX);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].code).toBe("LLP03");
    expect(result.attachments[0].regional).toBe(false);
    expect(result.attachments[0].sentence).toContain("לתיאום טיסה במרחב זה יש ליצור קשר");
    expect(result.attachments[0].sentence).toContain("בטלפון 050-3384198");
    expect(result.attachments[0].sentence.endsWith(".")).toBe(true);
    expect(result.stats.phonesSeen).toBe(1);
    expect(result.stats.phonesAttached).toBe(1);
  });

  it("attaches an explicit published code list to every listed zone, tagged regional", () => {
    const d = dump(
      "ב.\n \n בקשה לתכנית טיסה באזוריםLLR90/801/83\n \n דורשת הגשת\n בקשה לחה\"א לפחות7 ימי עבודה מראש. \n",
    );
    const result = extractCoordinationContacts(d, FIRST_APPENDIX);
    expect(result.attachments.map((a) => a.code)).toEqual(["LLR90", "LLR801", "LLR83"]);
    expect(result.attachments.every((a) => a.regional)).toBe(true);
    const sentences = new Set(result.attachments.map((a) => a.sentence));
    expect(sentences.size).toBe(1);
    expect([...sentences][0]).toContain("LLR90/801/83");
  });

  it("attaches a class-level sentence ONLY to the code it names inline, and flags the class coverage", () => {
    const d = dump(
      " גורם המעוניין להגיש בקשה לטיסה בתוך מרחבים אלו מחויב ליצור קשר\n( עם שירות בתי הסוהר\nמטה ארצי- \n074-7833333\n ) ולקבל\n אישור בכתב לגבי ביצוע הפעילות (לאזורLLU21\n \n לטלפון03-5038875\n.)  \n",
    );
    const result = extractCoordinationContacts(d, FIRST_APPENDIX);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({ code: "LLU21", regional: true });
    expect(result.attachments[0].sentence).toContain("074-7833333");
    expect(result.attachments[0].sentence).toContain("03-5038875");
    expect(result.issues.some((x) => x.kind === "note" && x.code === "LLU21")).toBe(true);
  });

  it("excludes a class-level sentence that names NO codes — ambiguous, never distributed", () => {
    const d = dump(
      " גורם המעוניין להגיש בקשה לטיסה בתוך מרחבים אלו מחויב ליצור קשר עם מתא\"מ פיקוד דרום בטלפון08-9902926/8\n \n ,אזור באר שבע ודרומה\n. \n",
    );
    const result = extractCoordinationContacts(d, FIRST_APPENDIX);
    expect(result.attachments).toHaveLength(0);
    expect(result.stats.ambiguousExcluded).toBe(1);
    const issue = result.issues.find((x) => x.kind === "contact-ambiguous");
    expect(issue).toBeDefined();
    expect(issue!.detail).toContain("08-9902926/8");
    // the phone is accounted for via the issue, not lost
    expect(result.stats.phonesSeen).toBe(1);
    expect(result.stats.phonesAttached).toBe(0);
    expect(result.stats.residualContacts).toBe(0);
  });

  it("reports contacts with no covering anchor as contact-unextracted with their entry code", () => {
    const d = dump(
      "יג.\n \n13\nLLP\n ,ה אזור\nה אסור \"ירושלים\" בכל גובה. \n יש להגיש בקשה מיוחדת בכתב למרכז המבצעים בטלפון \n9599800\n-\n09\n. \nיד.\n \n14\nLLP\n , האזור האסור הבא. \n",
    );
    const result = extractCoordinationContacts(d, FIRST_APPENDIX);
    expect(result.attachments).toHaveLength(0);
    const issue = result.issues.find((x) => x.kind === "contact-unextracted");
    expect(issue).toBeDefined();
    expect(issue!.code).toBe("LLP13");
    expect(issue!.detail).toContain("09-9599800");
    expect(result.stats.residualContacts).toBe(1);
  });

  it("extracts email-only sentences", () => {
    const d = dump(
      "55\n)\n \nLLU55\n.\", האזור האסור \"דור \n לתיאום טיסה במרחב זה יש ליצור\n :קשר עם נציג חברת \"שברון\" במיילitzik.Sardinas@chevron.com\n ,\ntal.lapidot@chevron.com\n. \n56\n)\n \nLLU56\n\" , האזור האסור מתחם.\"אשמורת \n",
    );
    const result = extractCoordinationContacts(d, FIRST_APPENDIX);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].code).toBe("LLU55");
    expect(result.attachments[0].sentence).toContain("itzik.Sardinas@chevron.com");
    expect(result.attachments[0].sentence).toContain("tal.lapidot@chevron.com");
    expect(result.stats.emailsSeen).toBe(2);
    expect(result.stats.emailsAttached).toBe(2);
  });

  it("never attaches via mid-prose code references", () => {
    // LLD35 is referenced inside LLD46's entry — the sentence must attach to
    // LLD46 (its serial-marked entry), never to the referenced LLD35.
    const d = dump(
      "טו.\n \nLLD46\n , האזור המסוכן מגובה פני הקרקע ועד גובה900\n רגל מעל פני הים , טיסה בסגירה זו לא תחרוג לסגירת\nLLD35\n .\n לתיאום טיסה במרחב זה יש ליצור קשר עם :נציג החברה בטלפון\n052-8669537\n. \n",
    );
    const result = extractCoordinationContacts(d, FIRST_APPENDIX);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].code).toBe("LLD46");
  });

  it("is deterministic — identical inputs give identical output", () => {
    const text =
      "ג.\n \n03\nLLP\n ,לתיאום טיסה במרחב זה יש ליצור קשר בטלפון050-3384198\n. \n";
    const a = extractCoordinationContacts(dump(text), FIRST_APPENDIX);
    const b = extractCoordinationContacts(dump(text), FIRST_APPENDIX);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("ignores appendix pages entirely", () => {
    const d: A17Dump = {
      source: { pdf: "fixture.pdf", pageCount: 1 },
      pages: [
        {
          page: 5,
          text: "ג.\n \nLLP03\n ,לתיאום טיסה במרחב זה יש ליצור קשר בטלפון050-3384198\n. \n",
          tables: [],
        },
      ],
    };
    const result = extractCoordinationContacts(d, 5);
    expect(result.attachments).toHaveLength(0);
    expect(result.stats.phonesSeen).toBe(0);
  });
});

describe("appendContactNotes — notes-append format for DO-035's renderer", () => {
  const collection = (): ZoneFeatureCollection => ({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          code: "LLP03",
          nameHe: "מכון דוד",
          nameEn: null,
          zoneTypeCode: "AIP_PROHIBITED",
          floorAmslFt: 0,
          ceilingAmslFt: 3000,
          aglCeilingFt: null,
          notes: "gdb editor stamp: X 2020",
        },
        geometry: null,
      },
      {
        type: "Feature",
        properties: {
          code: "LLR90",
          nameHe: null,
          nameEn: null,
          zoneTypeCode: "AIP_RESTRICTED",
          floorAmslFt: null,
          ceilingAmslFt: null,
          aglCeilingFt: null,
          notes: null,
        },
        geometry: null,
      },
    ],
  });

  it("appends a delimited תיאום segment after existing notes", () => {
    const c = collection();
    const atts: ContactAttachment[] = [
      { code: "LLP03", regional: false, sentence: "לתיאום טיסה יש ליצור קשר בטלפון 050-3384198." },
    ];
    const res = appendContactNotes(c, atts);
    expect(res.attached).toBe(1);
    expect(res.zonesCovered).toBe(1);
    expect(c.features[0].properties.notes).toBe(
      "gdb editor stamp: X 2020 | תיאום: לתיאום טיסה יש ליצור קשר בטלפון 050-3384198.",
    );
  });

  it("starts the notes with the segment when notes were null, and tags regional sentences", () => {
    const c = collection();
    const atts: ContactAttachment[] = [
      { code: "LLR90", regional: true, sentence: "בקשה לתכנית טיסה באזורים LLR90/801 דורשת בקשה מראש." },
    ];
    appendContactNotes(c, atts);
    expect(c.features[1].properties.notes).toBe(
      "תיאום (אזורי): בקשה לתכנית טיסה באזורים LLR90/801 דורשת בקשה מראש.",
    );
  });

  it("reports an attachment whose zone is absent from the dataset — never silently dropped", () => {
    const c = collection();
    const atts: ContactAttachment[] = [
      { code: "LLD99", regional: false, sentence: "לתיאום טיסה בטלפון 050-0000000." },
    ];
    const res = appendContactNotes(c, atts);
    expect(res.attached).toBe(0);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0]).toMatchObject({ code: "LLD99", kind: "contact-no-zone" });
  });
});
