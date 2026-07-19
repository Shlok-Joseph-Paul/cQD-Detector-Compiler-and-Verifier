import generatedAtlas from "../../data/generated/atlas.json";
import type { AtlasData } from "./types.ts";

// `pnpm run check-data` validates the source CSVs and proves this generated file
// is current before every production build. Avoid repeating clock-sensitive
// curation checks during Worker module initialization, where deployment
// sandboxes may intentionally expose an epoch clock.

export const atlasData = generatedAtlas as AtlasData;
export const atlasRecords = atlasData.records;
