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
