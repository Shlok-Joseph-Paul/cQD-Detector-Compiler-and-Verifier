import Link from "next/link";
import type { ReactNode } from "react";

import {
  formatAuthors,
  formatNoiseMethod,
  formatNoiseInstruments,
  formatNumber,
  formatScientific,
  formatWithUnit,
  humanizeCode,
  NOT_REPORTED,
  publicationLinks,
} from "@/lib/atlas/format";
import type { AtlasRecord } from "@/lib/atlas/types";

import { AmberReasons, FlagBadge, ShotNoiseBadge } from "./AtlasBadges";
import { MaterialLabel } from "./MaterialLabel";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="measurement-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function optionalText(value: string | null): string {
  return value?.trim() || NOT_REPORTED;
}

function SemanticHeading({
  level,
  className,
  children,
}: {
  level: 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  if (level === 1) return <h1 className={className}>{children}</h1>;
  if (level === 2) return <h2 className={className}>{children}</h2>;
  if (level === 3) return <h3 className={className}>{children}</h3>;
  return <h4 className={className}>{children}</h4>;
}

export interface MeasurementDetailsProps {
  record: AtlasRecord;
  variant?: "summary" | "full";
  headingLevel?: 1 | 2 | 3;
  showDetailLink?: boolean;
  onClose?: () => void;
}

export function MeasurementDetails({
  record,
  variant = "full",
  headingLevel,
  showDetailLink = false,
  onClose,
}: MeasurementDetailsProps) {
  const { measurement, device, paper } = record;
  const { doiUrl, sourceUrl } = publicationLinks(
    paper.doi,
    paper.publicationUrl,
  );
  const measurementUrl = `/measurements/${encodeURIComponent(measurement.measurementId)}`;
  const resolvedHeadingLevel = headingLevel ?? (variant === "full" ? 1 : 3);
  const sectionHeadingLevel = Math.min(resolvedHeadingLevel + 1, 4) as
    2 | 3 | 4;

  return (
    <article
      className={`measurement-details measurement-details--${variant}`}
      aria-label={`Measurement ${measurement.measurementId}`}
    >
      <header className="measurement-details__header">
        <div>
          <p className="measurement-details__eyebrow">
            <MaterialLabel value={device.materialFamily} /> ·{" "}
            {paper.publicationYear}
          </p>
          <SemanticHeading level={resolvedHeadingLevel}>
            <Link href={`/papers/${encodeURIComponent(paper.paperId)}`}>
              {paper.title}
            </Link>
          </SemanticHeading>
          <div className="measurement-details__badges">
            <FlagBadge flag={measurement.flag} />
            <ShotNoiseBadge noiseMethod={measurement.noiseMethod} />
          </div>
        </div>
        {onClose ? (
          <button
            className="measurement-details__close"
            type="button"
            onClick={onClose}
            aria-label="Close selected measurement"
          >
            ×
          </button>
        ) : null}
      </header>

      <div className="measurement-details__metrics">
        <div>
          <span>Specific detectivity, D*</span>
          <strong>
            {formatScientific(measurement.detectivityJones)} Jones
          </strong>
        </div>
        <div>
          <span>Measurement wavelength</span>
          <strong>
            {formatWithUnit(measurement.wavelengthNm, "nm", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      </div>

      <AmberReasons measurement={measurement} compact={variant === "summary"} />

      <dl className="measurement-details__grid">
        <Detail label="CQD material">
          <MaterialLabel value={device.materialFamily} />
        </Detail>
        <Detail label="Composition">
          {device.materialComposition || NOT_REPORTED}
        </Detail>
        <Detail label="Device architecture">
          {device.deviceArchitecture || NOT_REPORTED}
        </Detail>
        <Detail label="Layer stack">{optionalText(device.deviceStack)}</Detail>
        <Detail label="Temperature">
          {formatWithUnit(measurement.temperatureK, "K", {
            maximumFractionDigits: 2,
          })}
        </Detail>
        <Detail label="Applied bias">
          {formatWithUnit(measurement.biasV, "V", {
            maximumFractionDigits: 4,
          })}
        </Detail>
        <Detail label="Noise method">
          {formatNoiseMethod(measurement.noiseMethod)}
        </Detail>
        <Detail label="Noise instrument">
          {formatNoiseInstruments(measurement.noiseInstruments)}
        </Detail>
        <Detail label="First author">
          {paper.firstAuthor || NOT_REPORTED}
        </Detail>
      </dl>

      {variant === "full" ? (
        <>
          <SemanticHeading
            level={sectionHeadingLevel}
            className="measurement-details__section-heading"
          >
            Reported measurement details
          </SemanticHeading>
          <dl className="measurement-details__grid">
            <Detail label="Active area">
              {formatWithUnit(device.activeAreaCm2, "cm²", {
                maximumSignificantDigits: 5,
              })}
            </Detail>
            <Detail label="Responsivity">
              {formatWithUnit(measurement.responsivityAW, "A W⁻¹", {
                maximumSignificantDigits: 5,
              })}
            </Detail>
            <Detail label="EQE">
              {formatWithUnit(measurement.eqePercent, "%", {
                maximumSignificantDigits: 5,
              })}
            </Detail>
            <Detail label="Response time">
              {formatWithUnit(measurement.responseTimeS, "s", {
                maximumSignificantDigits: 5,
              })}
            </Detail>
            <Detail label="Bandwidth">
              {formatWithUnit(measurement.bandwidthHz, "Hz", {
                maximumSignificantDigits: 5,
              })}
            </Detail>
            <Detail label="Measurement frequency">
              {formatWithUnit(measurement.measurementFrequencyHz, "Hz", {
                maximumSignificantDigits: 5,
              })}
            </Detail>
            <Detail label="Noise instrument chain">
              {optionalText(measurement.noiseInstrumentDetails)}
            </Detail>
            <Detail label="Instrument evidence">
              {optionalText(measurement.noiseInstrumentSource)}
            </Detail>
            <Detail label="Detectivity extraction">
              {optionalText(measurement.detectivityExtractionMethod)}
            </Detail>
            <Detail label="Source location">
              {optionalText(measurement.sourceLocation)}
            </Detail>
            <Detail label="Curator status">
              {measurement.curatorStatus
                ? humanizeCode(measurement.curatorStatus)
                : NOT_REPORTED}
            </Detail>
            <Detail label="Record identifier">
              {measurement.measurementId}
            </Detail>
          </dl>

          <SemanticHeading
            level={sectionHeadingLevel}
            className="measurement-details__section-heading"
          >
            Publication
          </SemanticHeading>
          <dl className="measurement-details__grid">
            <Detail label="Authors">{formatAuthors(paper.authors)}</Detail>
            <Detail label="Journal">{optionalText(paper.journal)}</Detail>
            <Detail label="Publication year">
              {formatNumber(paper.publicationYear, {
                useGrouping: false,
                maximumFractionDigits: 0,
              })}
            </Detail>
            <Detail label="Publication type">
              {paper.publicationType
                ? humanizeCode(paper.publicationType)
                : NOT_REPORTED}
            </Detail>
            <Detail label="DOI">
              {doiUrl && paper.doi ? (
                <a href={doiUrl} target="_blank" rel="noreferrer">
                  {paper.doi}
                </a>
              ) : (
                NOT_REPORTED
              )}
            </Detail>
            <Detail label="Publication URL">
              {sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noreferrer">
                  Open publication page
                </a>
              ) : (
                NOT_REPORTED
              )}
            </Detail>
          </dl>

          <div className="measurement-details__notes">
            <SemanticHeading
              level={sectionHeadingLevel}
              className="measurement-details__section-heading"
            >
              Curator notes
            </SemanticHeading>
            <p>{optionalText(measurement.curatorNotes)}</p>
          </div>
        </>
      ) : null}

      <footer className="measurement-details__actions">
        <Link href={`/papers/${encodeURIComponent(paper.paperId)}`}>
          View paper record
        </Link>
        {showDetailLink ? (
          <Link href={measurementUrl}>View full record</Link>
        ) : null}
        {doiUrl ? (
          <a href={doiUrl} target="_blank" rel="noreferrer">
            Open DOI
          </a>
        ) : null}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Open publication page
          </a>
        ) : null}
      </footer>
    </article>
  );
}
