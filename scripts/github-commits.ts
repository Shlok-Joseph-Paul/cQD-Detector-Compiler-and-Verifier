import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { countCommitsByMonth } from "../lib/data/commit-growth.ts";

// Use GitHub main itself, never the separate Sites publication history.
const repository =
  "https://github.com/Shlok-Joseph-Paul/cQD-Detector-Compiler-and-Verifier";
const branch = "main";
const directory = await mkdtemp(join(tmpdir(), "atlas-github-history-"));
const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
try {
  git("init", "--bare", "--quiet");
  git(
    "fetch",
    "--quiet",
    "--no-tags",
    `${repository}.git`,
    `refs/heads/${branch}`,
  );
  const sourceCommit = git("rev-parse", "FETCH_HEAD");
  const points = countCommitsByMonth(
    git("log", "--format=%H %cI", sourceCommit),
  );
  const snapshot = {
    repository,
    branch,
    source_commit: sourceCommit,
    as_of: new Date().toISOString(),
    date_basis:
      "UTC committer date; all commits reachable from main, including merges",
    total_commits: points.reduce((sum, point) => sum + point.commits, 0),
    points,
  };
  const target = fileURLToPath(
    new URL("../data/generated/github-commits.json", import.meta.url),
  );
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(JSON.stringify(snapshot, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
