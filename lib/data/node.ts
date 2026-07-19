import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildAtlasFromCsvTexts, serializeAtlasData } from "./atlas.ts";
import type { AtlasData, CsvTexts } from "./types.ts";

export class GeneratedDataOutOfDateError extends Error {
  constructor(outputFile: string) {
    super(
      `${outputFile} is missing or out of date. Run the data-generation command and commit the result.`,
    );
    this.name = "GeneratedDataOutOfDateError";
  }
}

export async function readAtlasCsvFiles(
  dataDirectory: string,
): Promise<CsvTexts> {
  const [papers, devices, measurements] = await Promise.all([
    readFile(join(dataDirectory, "papers.csv"), "utf8"),
    readFile(join(dataDirectory, "devices.csv"), "utf8"),
    readFile(join(dataDirectory, "measurements.csv"), "utf8"),
  ]);
  return { papers, devices, measurements };
}

export interface GenerateAtlasOptions {
  dataDirectory: string;
  outputFile: string;
  mode?: "write" | "check" | "validate";
}

export async function generateAtlasFile({
  dataDirectory,
  outputFile,
  mode = "write",
}: GenerateAtlasOptions): Promise<AtlasData> {
  const texts = await readAtlasCsvFiles(dataDirectory);
  const atlas = buildAtlasFromCsvTexts(texts);
  const serialized = serializeAtlasData(atlas);

  if (mode === "check") {
    let existing: string | null = null;
    try {
      existing = await readFile(outputFile, "utf8");
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : null;
      if (code !== "ENOENT") throw error;
    }
    if (existing !== serialized)
      throw new GeneratedDataOutOfDateError(outputFile);
  } else if (mode === "write") {
    await mkdir(dirname(outputFile), { recursive: true });
    await writeFile(outputFile, serialized, "utf8");
  }

  return atlas;
}
