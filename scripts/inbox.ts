#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  initializeInbox,
  installLaunchAgent,
  readInboxLedger,
  retryInboxJob,
  runInboxOnce,
  uninstallLaunchAgent,
} from "../lib/inbox/index.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = process.argv.slice(2);
const command = args.find((argument) => !argument.startsWith("--")) ?? "status";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function positiveInteger(name: string, fallback: number): number {
  const raw = option(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`--${name} must be a positive integer`);
  return value;
}

const inboxRoot = path.resolve(
  option("inbox") ?? path.join(os.homedir(), "Documents", "CQD Paper Inbox"),
);
const settleSeconds = positiveInteger("settle-seconds", 60);
const concurrency = positiveInteger("concurrency", 2);
const pythonExecutable = option("python");

async function main(): Promise<void> {
  if (command === "init") {
    const paths = await initializeInbox(inboxRoot);
    console.log(
      JSON.stringify({ inbox: paths.root, incoming: paths.incoming }, null, 2),
    );
    return;
  }
  if (command === "once") {
    const result = await runInboxOnce({
      repositoryRoot,
      inboxRoot,
      settleMs: settleSeconds * 1_000,
      concurrency,
      pythonExecutable,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === "status") {
    const paths = await initializeInbox(inboxRoot);
    const ledger = await readInboxLedger(paths);
    console.log(
      JSON.stringify(
        {
          inbox: paths.root,
          jobs: ledger.jobs.map((job) => ({
            jobId: job.jobId,
            source: job.sourceKey,
            status: job.status,
            stage: job.stage,
            attempts: job.attempts,
            needsOcr: job.needsOcr,
            proposalFile: job.proposalFile,
            error: job.error,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "retry") {
    const jobId = option("job");
    if (!jobId) throw new Error("retry requires --job=<job-id>");
    await retryInboxJob(inboxRoot, jobId);
    console.log(JSON.stringify({ retried: jobId, inbox: inboxRoot }, null, 2));
    return;
  }
  if (command === "install") {
    const plist = await installLaunchAgent({
      repositoryRoot,
      inboxRoot,
      intervalSeconds: positiveInteger("interval-seconds", 60),
      settleSeconds,
      concurrency,
      pythonExecutable,
    });
    console.log(
      JSON.stringify({ installed: plist, inbox: inboxRoot }, null, 2),
    );
    return;
  }
  if (command === "uninstall") {
    const plist = await uninstallLaunchAgent();
    console.log(JSON.stringify({ uninstalled: plist }, null, 2));
    return;
  }
  throw new Error(
    "Unknown command. Use init, once, status, retry, install, or uninstall.",
  );
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
