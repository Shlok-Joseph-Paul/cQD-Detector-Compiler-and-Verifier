import approvals from "../../data/curator-green-approvals.json" with { type: "json" };
import type { Measurement } from "./types.ts";

/** Explicit source-specific approval; never invent missing frequency evidence. */
export function hasCuratorGreenApproval(measurement: Measurement): boolean {
  return approvals.some(
    (approval) =>
      approval.measurement_id === measurement.measurement_id &&
      measurement.curator_notes?.includes(approval.reason) &&
      Object.entries(approval.expected).every(
        ([key, expected]) =>
          JSON.stringify(measurement[key as keyof Measurement] ?? null) ===
          JSON.stringify(expected),
      ),
  );
}
