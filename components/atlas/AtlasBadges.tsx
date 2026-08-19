import { formatAmberReason } from "@/lib/atlas/format";
import type { AtlasMeasurement } from "@/lib/atlas/types";

export function FlagBadge({ flag }: Pick<AtlasMeasurement, "flag">) {
  return (
    <span className={`atlas-badge atlas-badge--${flag}`}>
      <span className="atlas-badge__dot" aria-hidden="true" />
      {flag === "green" ? "Green" : "Amber"}
    </span>
  );
}

export function ShotNoiseBadge({
  noiseMethod,
}: Pick<AtlasMeasurement, "noiseMethod">) {
  if (noiseMethod !== "shot_noise_approximation") return null;
  return (
    <span
      className="atlas-badge atlas-badge--shot-noise"
      title="Detectivity was calculated using a shot-noise approximation rather than measured total noise."
    >
      Shot-noise estimate
    </span>
  );
}

export function FrequencyMatchBadge({
  measurement,
}: {
  measurement: AtlasMeasurement;
}) {
  if (measurement.frequencyMatchStatus === "not_applicable") return null;

  const content = {
    matched: {
      label: "Frequency-matched D*",
      title:
        "The reported responsivity/EQE frequency matches the frequency used for D*.",
    },
    not_matched: {
      label: "Frequency-mismatched D*",
      title:
        "At least one reported responsivity/EQE frequency differs from the noise frequency used for D*. This mismatch requires an amber caution.",
    },
    not_established: {
      label: "Frequency match not established",
      title:
        "The source does not provide enough frequency information to compare responsivity/EQE with D*. Missing evidence alone does not change the green/amber classification.",
    },
  }[measurement.frequencyMatchStatus];

  return (
    <span
      className={`atlas-badge atlas-badge--frequency-${measurement.frequencyMatchStatus.replaceAll("_", "-")}`}
      title={content.title}
    >
      {content.label}
    </span>
  );
}

export function ProvisionalBadge({
  curatorStatus,
}: Pick<AtlasMeasurement, "curatorStatus">) {
  if (curatorStatus !== "pending_review") return null;
  return (
    <span
      className="atlas-badge atlas-badge--provisional"
      title="This record is visible for transparency but still requires human confirmation."
    >
      Needs human review
    </span>
  );
}

export function ProvisionalNotice({
  measurement,
  compact = false,
}: {
  measurement: AtlasMeasurement;
  compact?: boolean;
}) {
  if (measurement.curatorStatus !== "pending_review") return null;
  return (
    <div
      className={`provisional-notice${
        compact ? " provisional-notice--compact" : ""
      }`}
    >
      <strong>Provisional record — human review needed</strong>
      <p>{measurement.curatorNotes}</p>
      <small>
        Visible for transparency; excluded from plots, rankings, and aggregate
        performance summaries until resolved.
      </small>
    </div>
  );
}

export function AmberReasons({
  measurement,
  compact = false,
}: {
  measurement: AtlasMeasurement;
  compact?: boolean;
}) {
  if (measurement.flag !== "amber") return null;
  const reasons = measurement.amberReasons.length
    ? measurement.amberReasons
    : ["Amber reason is not documented; please report this data issue."];

  return (
    <div className={`amber-reasons${compact ? " amber-reasons--compact" : ""}`}>
      <strong>Interpret with caution</strong>
      <ul>
        {reasons.map((reason) => (
          <li key={reason}>{formatAmberReason(reason)}</li>
        ))}
      </ul>
      {measurement.amberExplanation ? (
        <p className="amber-reasons__curator-explanation">
          <span>Curator explanation: </span>
          {measurement.amberExplanation}
        </p>
      ) : null}
    </div>
  );
}
