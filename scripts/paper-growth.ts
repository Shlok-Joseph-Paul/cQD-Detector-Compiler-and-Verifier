import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCsv } from "../lib/data/csv.ts";

// Historical totals come from the actual source snapshots, not publication
// years or measurement dates. Rebuild on imports; production needs no Git.
export async function updatePaperGrowth(
  projectRoot: string,
  paperCount: number,
  updatedAt: string,
  mode: "write" | "check" | "validate",
) {
  if (mode === "validate") return;
  const file = join(projectRoot, "data/generated/paper-growth.json");
  if (mode === "check") {
    const saved = JSON.parse(await readFile(file, "utf8"));
    if (
      saved.points.at(-1)?.papers !== paperCount ||
      saved.as_of < updatedAt.slice(0, 10)
    ) {
      throw new Error(
        "Paper growth is out of date. Run pnpm run validate-data.",
      );
    }
    return;
  }
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: projectRoot, encoding: "utf8" }).trim();
  const commits = git(
    "log",
    "--first-parent",
    "--reverse",
    "--format=%H %cs",
    "--",
    "data/papers.csv",
  ).split("\n");
  const snapshots = new Map<string, { commit: string; date: string }>();
  for (const line of commits) {
    const [commit, date] = line.split(" ");
    snapshots.set(date.slice(0, 7), { commit, date });
  }
  const months = [...snapshots.keys()].sort();
  const lastSnapshot = snapshots.get(months.at(-1)!)!;
  const asOf = [updatedAt.slice(0, 10), lastSnapshot.date].sort().at(-1)!;
  const currentMonth = asOf.slice(0, 7);
  const points = [];
  let total = 0;
  const cursor = new Date(`${months[0]}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= currentMonth) {
    const month = cursor.toISOString().slice(0, 7);
    const snapshot = snapshots.get(month);
    if (snapshot) {
      const csv = parseCsv(git("show", `${snapshot.commit}:data/papers.csv`));
      const kind = csv.headers.indexOf("publication_type");
      total = csv.rows.filter(
        (row) => row.fields[kind] !== "demonstration",
      ).length;
    }
    points.push({
      month,
      papers: month === currentMonth ? paperCount : total,
      source_commit: month === currentMonth ? null : (snapshot?.commit ?? null),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  await writeFile(
    file,
    `${JSON.stringify({ as_of: asOf, points }, null, 2)}\n`,
  );
}
