/** Count unique commits by UTC committer month, including merge commits. */
export function countCommitsByMonth(log: string) {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const line of log.trim().split("\n").filter(Boolean)) {
    const [sha, timestamp] = line.split(" ");
    const date = new Date(timestamp);
    if (!/^[a-f0-9]{40}$/.test(sha) || !Number.isFinite(date.getTime())) {
      throw new Error("Invalid Git commit history entry.");
    }
    if (seen.has(sha)) continue;
    seen.add(sha);
    const month = date.toISOString().slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, commits]) => ({ month, commits }));
}
