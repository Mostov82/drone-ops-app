// DO-005 — Forgotten-PIN recovery. Clears the stored PIN hash so the app runs
// first-time PIN setup on next launch. This is a lockout-recovery tool for a
// local, single-user machine — the data was never encrypted with the PIN.
//
// Usage (from repo root, with the app stopped):  npm run auth:reset-pin -w server
import { prisma } from "../src/db.js";
import { PIN_HASH_SETTING_KEY } from "../src/auth/service.js";

const { count } = await prisma.setting.deleteMany({ where: { key: PIN_HASH_SETTING_KEY } });
console.log(
  count > 0
    ? "PIN cleared. The app will ask for a new PIN on next launch."
    : "No PIN was set — nothing to clear.",
);
await prisma.$disconnect();
