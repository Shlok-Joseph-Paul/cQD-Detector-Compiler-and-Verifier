import { randomUUID } from "node:crypto";
import {
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

function nodeErrorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return nodeErrorCode(error) !== "ESRCH";
  }
}

async function removeAbandonedLock(
  lockFile: string,
  staleAfterMs: number,
): Promise<boolean> {
  try {
    const raw = await readFile(lockFile, "utf8");
    const owner = JSON.parse(raw) as { pid?: unknown };
    if (
      typeof owner.pid === "number" &&
      Number.isInteger(owner.pid) &&
      owner.pid > 0
    ) {
      if (processIsAlive(owner.pid)) return false;
      await unlink(lockFile);
      return true;
    }
  } catch (error) {
    if (nodeErrorCode(error) === "ENOENT") return true;
  }

  try {
    const details = await stat(lockFile);
    if (Date.now() - details.mtimeMs <= staleAfterMs) return false;
    await unlink(lockFile);
    return true;
  } catch (error) {
    return nodeErrorCode(error) === "ENOENT";
  }
}

/**
 * Serializes read-modify-write operations that touch discovery review state.
 * The owner PID makes locks recoverable after an interrupted local automation.
 */
export async function withDiscoveryWriteLock<T>(
  root: string,
  action: () => Promise<T>,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    staleAfterMs?: number;
  } = {},
): Promise<T> {
  const lockFile = path.join(root, "data/discovery/.write.lock");
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const staleAfterMs = options.staleAfterMs ?? 4 * 60 * 60 * 1_000;
  const token = randomUUID();
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await open(lockFile, "wx");
      try {
        await handle.writeFile(
          `${JSON.stringify({ token, pid: process.pid, createdAt: new Date().toISOString() })}\n`,
          "utf8",
        );
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if (nodeErrorCode(error) !== "EEXIST") throw error;
      if (await removeAbandonedLock(lockFile, staleAfterMs)) continue;
      if (Date.now() - startedAt >= timeoutMs)
        throw new Error(
          `Timed out waiting for the discovery write lock at ${lockFile}`,
        );
      await delay(pollIntervalMs);
    }
  }

  try {
    return await action();
  } finally {
    try {
      const owner = JSON.parse(await readFile(lockFile, "utf8")) as {
        token?: unknown;
      };
      if (owner.token === token) await unlink(lockFile);
    } catch (error) {
      if (nodeErrorCode(error) !== "ENOENT") throw error;
    }
  }
}

/** Writes beside the target and renames, so readers never observe partial JSON. */
export async function writeTextAtomically(
  file: string,
  contents: string,
): Promise<void> {
  const temporaryFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, contents, { encoding: "utf8", flag: "wx" });
    await rename(temporaryFile, file);
  } finally {
    try {
      await unlink(temporaryFile);
    } catch (error) {
      if (nodeErrorCode(error) !== "ENOENT") throw error;
    }
  }
}
