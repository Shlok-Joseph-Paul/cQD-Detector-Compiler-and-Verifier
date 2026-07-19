#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { generateAtlasFile } from "../lib/data/node.ts";
import {
  DataValidationError,
  formatValidationIssues,
} from "../lib/data/validation.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const dataDirectory = fileURLToPath(new URL("../data/", import.meta.url));
const outputFile = fileURLToPath(
  new URL("../data/generated/atlas.json", import.meta.url),
);

const argumentsSet = new Set(process.argv.slice(2));
const knownArguments = new Set(["--check", "--validate-only"]);
const unknownArguments = [...argumentsSet].filter(
  (argument) => !knownArguments.has(argument),
);

if (unknownArguments.length > 0 || argumentsSet.size > 1) {
  console.error(
    `Usage: node --experimental-strip-types scripts/validate-data.ts [--check|--validate-only]`,
  );
  process.exitCode = 2;
} else {
  const mode = argumentsSet.has("--check")
    ? "check"
    : argumentsSet.has("--validate-only")
      ? "validate"
      : "write";

  try {
    const atlas = await generateAtlasFile({ dataDirectory, outputFile, mode });
    const action =
      mode === "write"
        ? "validated and generated"
        : mode === "check"
          ? "validated; generated file is current"
          : "validated";
    console.log(
      `Atlas data ${action}: ${atlas.papers.length} paper(s), ${atlas.devices.length} device(s), ${atlas.measurements.length} measurement(s).`,
    );
    console.log(`Project: ${projectRoot}`);
  } catch (error) {
    if (error instanceof DataValidationError) {
      console.error(formatValidationIssues(error.issues));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}
