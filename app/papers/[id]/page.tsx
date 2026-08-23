import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FlagBadge,
  FrequencyMatchBadge,
  MaterialLabel,
  ProvisionalBadge,
  ShotNoiseBadge,
} from "@/components/atlas";
import { SiteShell } from "@/components/SiteShell";
import {
  formatDetectorClass,
  formatAuthors,
  formatNoiseMethod,
  formatNoiseInstruments,
  formatScientific,
  formatWithUnit,
  humanizeCode,
  NOT_REPORTED,
  publicationLinks,
} from "@/lib/atlas/format";
import { reviewedRecords } from "@/lib/atlas/review";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data";
import { journalMetricFor } from "@/lib/data/journals";

type PageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return atlasData.papers.map((paper) => ({ id: paper.paper_id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const paper = atlasData.papers.find((candidate) => candidate.paper_id === id);
  return paper
    ? {
        title: paper.title,
        description: `CQD and perovskite photodetector measurements curated from ${paper.first_author} et al. (${paper.publication_year}).`,
      }
    : { title: "Paper not found" };
}

export default async function PaperPage({ params }: PageProps) {
  const { id } = await params;
  const paper = atlasData.papers.find((candidate) => candidate.paper_id === id);
  if (!paper) notFound();

  const records = atlasData.records
    .filter((record) => record.paper.paper_id === id)
    .map(normalizeJoinedMeasurement);
  const devices = atlasData.devices.filter((device) => device.paper_id === id);
  const materials = [
    ...new Set(records.map((record) => record.device.materialFamily)),
  ];
  const confirmedRecords = reviewedRecords(records);
  const highestDetectivity = confirmedRecords.length
    ? Math.max(
        ...confirmedRecords.map(
          (record) => record.measurement.detectivityJones,
        ),
      )
    : null;
  const amberCount = records.filter(
    (record) => record.measurement.flag === "amber",
  ).length;
  const unverifiedCount = records.filter(
    (record) => record.measurement.flag === "unverified",
  ).length;
  const { doiUrl, sourceUrl } = publicationLinks(
    paper.doi,
    paper.publication_url,
  );
  const journalMetric = journalMetricFor(paper.journal);

  return (
    <SiteShell>
      <article className="page-shell paper-page">
        <div className="record-breadcrumbs">
          <Link href="/">Atlas</Link>
          <span aria-hidden="true">/</span>
          <span>Papers</span>
          <span aria-hidden="true">/</span>
          <span>
            {paper.first_author}, {paper.publication_year}
          </span>
        </div>

        <header className="paper-hero">
          <div className="paper-hero__copy">
            <p className="eyebrow">Curated paper record</p>
            <h1>{paper.title}</h1>
            <p className="paper-hero__authors">
              {formatAuthors(paper.authors)}
            </p>
            <p className="paper-hero__citation">
              {paper.journal || NOT_REPORTED} · {paper.publication_year} ·{" "}
              {paper.peer_reviewed ? "Peer reviewed" : "Not peer reviewed"}
              {journalMetric && journalMetric.impact_factor !== null ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={journalMetric.source_url}
                    target="_blank"
                    rel="noreferrer"
                    title={`Source for the ${journalMetric.impact_factor_year} Journal Impact Factor`}
                  >
                    {journalMetric.impact_factor_year} JIF{" "}
                    {journalMetric.impact_factor.toFixed(1)}
                  </a>
                </>
              ) : journalMetric?.note ? (
                <> · JIF not applicable</>
              ) : null}
            </p>
            <div className="paper-hero__actions">
              {doiUrl ? (
                <a
                  className="primary-button"
                  href={doiUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open DOI
                </a>
              ) : null}
              {sourceUrl ? (
                <a
                  className="secondary-button"
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Publication page
                </a>
              ) : null}
            </div>
          </div>

          <dl className="paper-summary" aria-label="Paper contribution summary">
            <div>
              <dt>Measurements</dt>
              <dd>{records.length}</dd>
            </div>
            <div>
              <dt>Devices</dt>
              <dd>{devices.length}</dd>
            </div>
            <div>
              <dt>Material classes</dt>
              <dd>{materials.length}</dd>
            </div>
            <div>
              <dt>Highest D*</dt>
              <dd>
                {highestDetectivity === null
                  ? "Pending review"
                  : formatScientific(highestDetectivity)}
              </dd>
            </div>
          </dl>
        </header>

        <section
          className="paper-overview"
          aria-labelledby="paper-overview-heading"
        >
          <div>
            <p className="section-kicker">Atlas contribution</p>
            <h2 id="paper-overview-heading">What this paper contributes</h2>
          </div>
          <p>
            The atlas links {records.length} reported measurement
            {records.length === 1 ? "" : "s"} to {devices.length} distinct
            device{devices.length === 1 ? "" : "s"}.{" "}
            {amberCount
              ? `${amberCount} measurement${amberCount === 1 ? " is" : "s are"} amber.${unverifiedCount ? ` ${unverifiedCount} additional measurement${unverifiedCount === 1 ? " is" : "s are"} unverified because the signal/noise frequency match is not established.` : ""}`
              : unverifiedCount
                ? `${unverifiedCount} measurement${unverifiedCount === 1 ? " is" : "s are"} unverified because the signal/noise frequency match is not established.`
                : "All listed measurements currently carry a green review status."}
          </p>
        </section>

        <div className="paper-device-list">
          {devices.map((device, index) => {
            const deviceRecords = records.filter(
              (record) => record.device.deviceId === device.device_id,
            );
            return (
              <section
                className="paper-device"
                key={device.device_id}
                aria-labelledby={`${device.device_id}-heading`}
              >
                <header className="paper-device__header">
                  <div>
                    <p className="section-kicker">
                      Device {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 id={`${device.device_id}-heading`}>
                      <MaterialLabel value={device.material_family} />{" "}
                      {formatDetectorClass(device.detector_class).toLowerCase()}
                    </h2>
                  </div>
                  <span>{device.device_id}</span>
                </header>

                <dl className="paper-device__metadata">
                  <div>
                    <dt>Detector class</dt>
                    <dd>{formatDetectorClass(device.detector_class)}</dd>
                  </div>
                  <div>
                    <dt>Composition</dt>
                    <dd>{device.material_composition || NOT_REPORTED}</dd>
                  </div>
                  <div>
                    <dt>Architecture</dt>
                    <dd>{device.device_architecture || NOT_REPORTED}</dd>
                  </div>
                  <div>
                    <dt>Layer stack</dt>
                    <dd>{device.device_stack || NOT_REPORTED}</dd>
                  </div>
                  <div>
                    <dt>Active area</dt>
                    <dd>
                      {formatWithUnit(device.active_area_cm2, "cm²", {
                        maximumSignificantDigits: 5,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Ligand exchange</dt>
                    <dd>{humanizeCode(device.ligand_exchange_status)}</dd>
                  </div>
                  <div>
                    <dt>Exchange process</dt>
                    <dd>
                      {device.ligand_exchange_type
                        ? humanizeCode(device.ligand_exchange_type)
                        : NOT_REPORTED}
                    </dd>
                  </div>
                  <div>
                    <dt>Exchange chemicals</dt>
                    <dd>
                      {device.ligand_exchange_chemicals?.replaceAll("|", ",") ||
                        NOT_REPORTED}
                    </dd>
                  </div>
                  <div>
                    <dt>Native ligands</dt>
                    <dd>
                      {device.native_ligands?.replaceAll("|", ",") ||
                        NOT_REPORTED}
                    </dd>
                  </div>
                  <div>
                    <dt>Treated layer</dt>
                    <dd>{device.ligand_exchange_target || NOT_REPORTED}</dd>
                  </div>
                  <div>
                    <dt>Method details</dt>
                    <dd>{device.ligand_exchange_conditions || NOT_REPORTED}</dd>
                  </div>
                  <div>
                    <dt>Ligand source</dt>
                    <dd>
                      {device.ligand_exchange_source_location || NOT_REPORTED}
                    </dd>
                  </div>
                </dl>

                <div
                  className="paper-measurements__scroll"
                  role="region"
                  aria-label={`Measurements for ${device.device_id}`}
                  tabIndex={0}
                >
                  <table className="paper-measurements">
                    <thead>
                      <tr>
                        <th scope="col">Wavelength</th>
                        <th scope="col">Detectivity</th>
                        <th scope="col">Conditions</th>
                        <th scope="col">Noise basis</th>
                        <th scope="col">Review</th>
                        <th scope="col">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceRecords.map((record) => (
                        <tr
                          className={
                            record.measurement.flag === "amber"
                              ? "is-amber"
                              : record.measurement.flag === "unverified"
                                ? "is-unverified"
                                : undefined
                          }
                          key={record.measurement.measurementId}
                        >
                          <td>
                            <Link
                              href={`/measurements/${encodeURIComponent(record.measurement.measurementId)}`}
                            >
                              {formatWithUnit(
                                record.measurement.wavelengthNm,
                                "nm",
                              )}
                            </Link>
                          </td>
                          <td>
                            {formatScientific(
                              record.measurement.detectivityJones,
                            )}{" "}
                            Jones
                          </td>
                          <td>
                            {formatWithUnit(
                              record.measurement.temperatureK,
                              "K",
                            )}{" "}
                            · {formatWithUnit(record.measurement.biasV, "V")}
                          </td>
                          <td>
                            {formatNoiseMethod(record.measurement.noiseMethod)}
                            <small className="paper-measurements__instrument">
                              {formatNoiseInstruments(
                                record.measurement.noiseInstruments,
                              )}
                            </small>
                            <ShotNoiseBadge
                              noiseMethod={record.measurement.noiseMethod}
                            />
                          </td>
                          <td>
                            <FlagBadge flag={record.measurement.flag} />
                            <FrequencyMatchBadge
                              measurement={record.measurement}
                            />
                            <ProvisionalBadge
                              curatorStatus={record.measurement.curatorStatus}
                            />
                          </td>
                          <td>
                            {record.measurement.sourceLocation || NOT_REPORTED}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {device.device_notes ? (
                  <p className="paper-device__notes">
                    <strong>Device notes:</strong> {device.device_notes}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>

        <section
          className="paper-provenance"
          aria-labelledby="paper-provenance-heading"
        >
          <div>
            <p className="section-kicker">Publication record</p>
            <h2 id="paper-provenance-heading">Provenance and curation</h2>
          </div>
          <dl>
            <div>
              <dt>Paper identifier</dt>
              <dd>{paper.paper_id}</dd>
            </div>
            <div>
              <dt>Publication type</dt>
              <dd>{humanizeCode(paper.publication_type)}</dd>
            </div>
            <div>
              <dt>DOI</dt>
              <dd>{paper.doi || NOT_REPORTED}</dd>
            </div>
            <div>
              <dt>Paper notes</dt>
              <dd>{paper.notes || NOT_REPORTED}</dd>
            </div>
          </dl>
        </section>
      </article>
    </SiteShell>
  );
}
