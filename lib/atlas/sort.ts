import type { AtlasRecord, AtlasSortState } from "./types";

function sortValue(
  record: AtlasRecord,
  key: AtlasSortState["key"],
): string | number | null {
  switch (key) {
    case "material":
      return record.device.materialFamily;
    case "wavelength":
      return record.measurement.wavelengthNm;
    case "detectivity":
      return record.measurement.detectivityJones;
    case "year":
      return record.paper.publicationYear;
  }
}

export function sortAtlasRecords(
  records: readonly AtlasRecord[],
  sort: AtlasSortState,
): AtlasRecord[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const leftValue = sortValue(left.record, sort.key);
      const rightValue = sortValue(right.record, sort.key);

      if (leftValue === null && rightValue === null)
        return left.index - right.index;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;

      const comparison =
        typeof leftValue === "string" && typeof rightValue === "string"
          ? leftValue.localeCompare(rightValue, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          : Number(leftValue) - Number(rightValue);

      return comparison === 0
        ? left.index - right.index
        : comparison * (sort.direction === "asc" ? 1 : -1);
    })
    .map(({ record }) => record);
}
