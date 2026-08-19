import type { AtlasRecord } from "./types.ts";

export function isReviewedRecord(record: AtlasRecord): boolean {
  return record.measurement.curatorStatus === "reviewed";
}

export function reviewedRecords(
  records: readonly AtlasRecord[],
): AtlasRecord[] {
  return records.filter(isReviewedRecord);
}
