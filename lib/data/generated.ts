import generatedAtlas from "../../data/generated/atlas.json";
import type { AtlasData } from "./types.ts";
import { assertValidAtlasEntities } from "./validation.ts";

// The JSON is generated before build; retain a runtime guard against hand edits.
assertValidAtlasEntities(generatedAtlas);

export const atlasData = generatedAtlas as AtlasData;
export const atlasRecords = atlasData.records;
