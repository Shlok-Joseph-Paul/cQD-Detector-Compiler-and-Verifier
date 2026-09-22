import { atlasRecordsToCsv } from "@/lib/atlas/csv";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data/generated";
import { DATASET_VERSION } from "@/lib/data/releases";

// The dataset changes only on deployment. Generate the export on first download,
// keeping the data and CSV conversion out of informational-page browser bundles.
let csv: string | undefined;

export function GET() {
  csv ??= atlasRecordsToCsv(atlasData.records.map(normalizeJoinedMeasurement));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="cqd-photodiode-atlas-v${DATASET_VERSION}.csv"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
