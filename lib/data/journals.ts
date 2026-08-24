import journalMetricsJson from "../../data/journal_metrics.json" with { type: "json" };

export interface JournalMetric {
  journal: string;
  impact_factor: number | null;
  impact_factor_year: number | null;
  source_url: string;
  verified_on: string;
  note?: string;
}

export const journalMetrics = journalMetricsJson as JournalMetric[];

const journalMetricsByName = new Map(
  journalMetrics.map((metric) => [metric.journal, metric]),
);

if (journalMetricsByName.size !== journalMetrics.length) {
  throw new Error("journal_metrics.json contains duplicate journal titles.");
}

export function journalMetricFor(
  journal: string | null | undefined,
): JournalMetric | null {
  return journal ? (journalMetricsByName.get(journal) ?? null) : null;
}
