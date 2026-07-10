// DO-013 — reconciliation report rendering (markdown, ships beside each
// dataset for Jonathan's visual verification against the ב'-08 / ב'-03 sheets).

import type { ReconIssue } from "./builders/aip-zones.js";

export function renderIssueTable(issues: ReconIssue[]): string {
  if (issues.length === 0) return "_No issues — zero unexplained gaps._\n";
  const lines = ["| Code | Kind | Detail |", "|---|---|---|"];
  for (const issue of issues) {
    lines.push(`| ${issue.code} | ${issue.kind} | ${issue.detail.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function issueCounts(issues: ReconIssue[]): string {
  const byKind = new Map<string, number>();
  for (const issue of issues) byKind.set(issue.kind, (byKind.get(issue.kind) ?? 0) + 1);
  return (
    [...byKind.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kind, count]) => `${kind}: ${count}`)
      .join(" · ") || "none"
  );
}
