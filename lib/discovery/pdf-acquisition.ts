import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export interface AcquiredPdf {
  path: string;
  sha256: string;
  byteLength: number;
  contentType: string;
  finalUrl: string;
  cacheHit: boolean;
}

function assertPublicHttpUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Open-access PDF URL must use HTTP(S)");
  if (url.username || url.password)
    throw new Error("Authenticated PDF URLs are not allowed");
  return url;
}

export async function acquireOpenAccessPdf(
  sourceUrl: string,
  cacheDirectory: string,
  options: { fetchImpl?: typeof fetch; dryRun?: boolean } = {},
): Promise<AcquiredPdf> {
  const url = assertPublicHttpUrl(sourceUrl);
  const urlHash = createHash("sha256").update(url.toString()).digest("hex");
  const pointerFile = path.join(cacheDirectory, `${urlHash}.json`);
  try {
    const pointer = JSON.parse(await readFile(pointerFile, "utf8")) as {
      path: string;
      sha256: string;
      byteLength: number;
      contentType: string;
      finalUrl: string;
    };
    const info = await stat(pointer.path);
    if (info.isFile() && info.size === pointer.byteLength)
      return { ...pointer, cacheHit: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // Invalid cache metadata is ignored and replaced by a verified response.
    }
  }

  const response = await (options.fetchImpl ?? fetch)(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "CQD-Photodiode-Atlas/1.0 open-access proposal acquisition",
    },
  });
  if (!response.ok)
    throw new Error(`Open-access PDF request failed (${response.status})`);
  const finalUrl = assertPublicHttpUrl(
    response.url || url.toString(),
  ).toString();
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES)
    throw new Error("Open-access PDF exceeds the 50 MB safety limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES)
    throw new Error("Open-access PDF exceeds the 50 MB safety limit");
  const contentType =
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ||
    "application/octet-stream";
  const magic = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (contentType !== "application/pdf" && magic !== "%PDF-")
    throw new Error(
      `Open-access location did not return a PDF (${contentType})`,
    );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const pdfDirectory = path.join(cacheDirectory, "pdfs");
  const pdfPath = path.join(pdfDirectory, `${sha256}.pdf`);
  if (!options.dryRun) {
    await mkdir(pdfDirectory, { recursive: true });
    await writeFile(pdfPath, bytes);
    await writeFile(
      pointerFile,
      `${JSON.stringify({ path: pdfPath, sha256, byteLength: bytes.byteLength, contentType, finalUrl }, null, 2)}\n`,
      "utf8",
    );
  }
  return {
    path: pdfPath,
    sha256,
    byteLength: bytes.byteLength,
    contentType,
    finalUrl,
    cacheHit: false,
  };
}
