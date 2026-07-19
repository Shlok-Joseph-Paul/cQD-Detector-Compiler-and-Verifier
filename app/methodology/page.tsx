import type { Metadata } from "next";
import Link from "next/link";

import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Scope, record structure, noise classifications, recommended measurement literature, and curation policy for the CQD Photodiode Atlas.",
};

const includedRecords = [
  "Experimental colloidal quantum-dot photodiodes reported in peer-reviewed papers, plus clearly identified preprints.",
  "Measurements for which a specific detectivity and measurement wavelength can be identified.",
  "Distinct operating points from the same device when the publication reports them separately.",
];

const excludedRecords = [
  "Photoconductors, photoresistors, phototransistors, and bolometers.",
  "Focal-plane-array reports without an extractable photodiode measurement.",
  "Epitaxial quantum-dot detectors and non-CQD perovskite thin films.",
  "Theoretical devices without an experimental photodiode.",
  "Comparison values copied from another paper; those values belong to the original source record.",
];

const greenCriteria = [
  "A human curator has reviewed the record.",
  "The value clearly belongs to a CQD photodiode.",
  "Detectivity and wavelength are explicitly identifiable.",
  "The value does not use a shot-noise approximation.",
  "The reported detectivity does not appear substantially above a plausible BLIP limit.",
];

const amberReasons = [
  "Detectivity uses a shot-noise approximation.",
  "The reported detectivity appears substantially above a plausible background-limited infrared photodetection (BLIP) limit and warrants manual review.",
];

export default function MethodologyPage() {
  return (
    <SiteShell>
      <div className="page-shell prose-page">
        <article>
          <header className="prose-hero">
            <p className="eyebrow">Methods &amp; inclusion policy</p>
            <h1>How records enter the atlas</h1>
            <p className="prose-lede">
              The CQD Photodiode Atlas is a curated index of published specific
              detectivity measurements. Its unit of comparison is a measurement,
              with the publication and device context preserved around it.
            </p>
          </header>

          <section aria-labelledby="scope-heading">
            <h2 id="scope-heading">Scientific scope</h2>
            <p>
              For this database, a <dfn>CQD photodiode</dfn> is an experimental
              diode-like photodetector whose light-absorbing semiconductor is
              made from solution-processed colloidal quantum dots and whose
              reported operation is based on a rectifying or photovoltaic
              junction. A record must report specific detectivity, D<sup>*</sup>
              , in Jones (cm Hz<sup>1/2</sup> W<sup>−1</sup>).
            </p>

            <div className="method-grid">
              <div>
                <h3>Included</h3>
                <ul>
                  {includedRecords.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Excluded</h3>
                <ul>
                  {excludedRecords.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p>
              Photoconductors and phototransistors are excluded because internal
              gain, carrier lifetime, transit time, and bias-dependent noise can
              make their detectivity values fundamentally different from
              junction-photodiode measurements. Keeping device classes separate
              improves comparability without implying that excluded devices are
              less useful.
            </p>
          </section>

          <section aria-labelledby="records-heading">
            <h2 id="records-heading">Paper, device, and measurement records</h2>
            <p>
              A paper can describe several device stacks, and each device can be
              measured at several wavelengths, biases, temperatures, or noise
              frequencies. The atlas therefore separates three linked entities:
            </p>
            <ol className="record-levels">
              <li>
                <strong>Paper</strong> stores the bibliographic source.
              </li>
              <li>
                <strong>Device</strong> stores material, architecture, layer
                stack, and active area.
              </li>
              <li>
                <strong>Measurement</strong> stores one reported D<sup>*</sup>
                value and its operating conditions.
              </li>
            </ol>
            <p>
              Consequently, several points can legitimately link to the same
              paper or device. Each point on the performance map represents one
              measurement—not one publication and not an average across a paper.
            </p>
          </section>

          <section aria-labelledby="noise-heading">
            <h2 id="noise-heading">Noise and detectivity classification</h2>
            <p>
              Specific detectivity depends on responsivity, detector area, and
              noise. Reported values are most useful when the relevant noise was
              measured under the same operating conditions and at a stated
              frequency. The atlas preserves the source&apos;s extraction method
              and classifies its noise basis using a controlled vocabulary.
            </p>

            <dl className="definition-list">
              <div>
                <dt>Measured noise</dt>
                <dd>
                  D<sup>*</sup> was derived from an experimental noise current
                  or noise spectrum.
                </dd>
              </div>
              <div>
                <dt>Shot-noise approximation</dt>
                <dd>
                  Noise was estimated from dark current using a shot-noise
                  model, rather than measured as a total-noise spectrum.
                </dd>
              </div>
              <div>
                <dt>Calculated shot and thermal noise</dt>
                <dd>
                  The source combined modeled shot-noise and thermal-noise
                  terms.
                </dd>
              </div>
              <div>
                <dt>NEP from minimum detectable power</dt>
                <dd>
                  Detectivity was obtained from an experimentally reported
                  minimum detectable power or corresponding noise-equivalent
                  power.
                </dd>
              </div>
              <div>
                <dt>Unspecified</dt>
                <dd>The publication does not make the noise basis clear.</dd>
              </div>
            </dl>

            <h3>Noise acquisition instruments</h3>
            <p>
              The atlas separately records how an experimental noise signal was
              acquired. Controlled instrument classes include spectrum or signal
              analyzers, lock-in amplifiers operating in noise mode,
              oscilloscope or transient-current FFT methods, and dedicated noise
              analyzers. A preamplifier and model number are retained in the
              instrument-chain details when the source reports them.
            </p>
            <p>
              Some publications combine acquisition methods across frequency
              ranges; those records retain every reported method. If measured
              noise is shown but the supplied article does not identify the
              instrument, the field remains <q>Not reported</q>. For a modeled
              shot-noise approximation, the instrument field is marked
              <q>Not applicable</q>. Neither status independently changes the
              green or amber flag.
            </p>

            <h3>Why shot-noise estimates are marked separately</h3>
            <p>
              In a common approximation, the shot-noise current spectral density
              is estimated from dark current as √(2qI<sub>dark</sub>), and this
              modeled noise is used with responsivity and detector area to
              obtain D<sup>*</sup>. The approximation can be informative, but it
              may omit 1/f noise, generation–recombination noise, readout noise,
              and other device-specific contributions. It is therefore not
              automatically comparable to a value derived from a measured
              total-noise spectrum.
            </p>
            <div
              className="callout callout-amber"
              role="note"
              aria-label="Shot-noise interpretation note"
            >
              <strong>Interpret with caution.</strong>
              <p>
                Detectivity was calculated using a shot-noise approximation
                rather than a measured total-noise spectrum. This label does not
                state that the result is incorrect; it identifies a
                methodological difference that matters when comparing records.
              </p>
            </div>
          </section>

          <section aria-labelledby="flags-heading">
            <h2 id="flags-heading">Green and amber flags</h2>
            <p>
              Flags communicate documentation and comparability, not a ranking
              of scientific quality. Only two public levels are used.
            </p>

            <div className="flag-policy-grid">
              <article className="flag-policy flag-policy-green">
                <h3>Green</h3>
                <p>A record is green only when every criterion below is met.</p>
                <ul>
                  {greenCriteria.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="flag-policy flag-policy-amber">
                <h3>Amber</h3>
                <p>
                  A record is amber when one or more caution conditions apply.
                </p>
                <ul>
                  {amberReasons.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <p>
              Every amber record carries at least one machine-readable reason
              and a human-readable explanation. Shot-noise-approximation records
              are always amber. A potential BLIP-limit concern is applied by a
              curator only when the comparison is straightforward and the
              reported value is clearly anomalous. An amber flag is never shown
              without an explanation.
            </p>
          </section>

          <section aria-labelledby="missing-heading">
            <h2 id="missing-heading">
              Missing and graphically extracted values
            </h2>
            <p>
              Information absent from the publication is stored as a null value
              and displayed as <q>Not reported</q>. It is never converted to
              zero, guessed from an unrelated condition, or silently backfilled.
              Missing conditions—such as bias, temperature, frequency, or
              area—do not by themselves trigger an amber flag.
            </p>
            <p>
              A value read from a plot is labeled as graphically extracted. Its
              record identifies the source figure, page, table, or
              supporting-information location when available. Digitization adds
              uncertainty from plot resolution, axis scaling, and marker width;
              the displayed precision should not be read as greater than the
              source supports, but graphical extraction alone does not trigger
              an amber flag.
            </p>
            <p>
              If a curator derives D<sup>*</sup> from other reported fields, the
              result is labeled as calculated from reported values, retains the
              calculation provenance, and is not presented as a number directly
              stated by the publication. This provenance alone does not trigger
              an amber flag.
            </p>
          </section>

          <section aria-labelledby="curation-heading">
            <h2 id="curation-heading">Curation and corrections</h2>
            <p>
              Curators transcribe source values, retain provenance, validate the
              linked paper–device–measurement structure, and apply the published
              flag rules. The first release is manually maintained; it does not
              scrape publishers, use institutional credentials, or automatically
              publish extracted results. Records can change when better metadata
              or a documented correction becomes available.
            </p>
            <p>
              Researchers can propose additions and corrections through the
              documented workflow on the{" "}
              <Link href="/contribute">Contribute page</Link>.
            </p>
          </section>
        </article>

        <aside
          className="methodology-sidebar"
          aria-label="Methodology notes and recommended reading"
        >
          <section className="callout methodology-sidebar__note">
            <strong>Published does not mean independently verified.</strong>
            <p>
              The atlas reports values and methods as described by their
              sources. Inclusion is not an endorsement of a result, and the
              atlas does not reproduce the experiment or independently certify
              its accuracy.
            </p>
          </section>

          <section
            className="reading-list-card"
            aria-labelledby="measurement-reading-heading"
          >
            <p className="section-kicker">For experimentalists</p>
            <h2 id="measurement-reading-heading">
              Learn to measure photodetectors well
            </h2>
            <p className="reading-list-card__intro">
              These papers are useful starting points for planning,
              interpreting, and reporting photodetector measurements.
            </p>
            <ol className="measurement-reading-list">
              <li>
                <a
                  href="https://doi.org/10.1038/s41566-018-0288-z"
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>
                    Accurate characterization of next-generation thin-film
                    photodetectors
                  </strong>
                  <span>Fang et al. · Nature Photonics · 2019</span>
                </a>
                <p>
                  A concise introduction to noise spectra, response linearity,
                  NEP, and common D* overestimation errors.
                </p>
              </li>
              <li>
                <a
                  href="https://doi.org/10.24425/bpasts.2022.140534"
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>
                    Review of photodetectors characterization methods
                  </strong>
                  <span>
                    Bielecki et al. · Bulletin of the Polish Academy of Sciences
                    · 2022
                  </span>
                </a>
                <p>
                  A broad reference for detector parameters, measurement
                  systems, and metrological definitions.
                </p>
              </li>
              <li>
                <a
                  href="https://doi.org/10.1021/acsphotonics.2c01672"
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>
                    Commentary on the Record-Breaking Performance of
                    Low-Dimensional Solid Photodetectors
                  </strong>
                  <span>Rogalski · ACS Photonics · 2023</span>
                </a>
                <p>
                  Context for signal-fluctuation and BLIP limits when evaluating
                  exceptional detectivity claims.
                </p>
              </li>
              <li>
                <a
                  href="https://doi.org/10.1038/s41566-025-01759-1"
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>
                    Guidelines for accurate evaluation of photodetectors based
                    on emerging semiconductor technologies
                  </strong>
                  <span>Pecunia et al. · Nature Photonics · 2025</span>
                </a>
                <p>
                  A community consensus statement on characterization,
                  reporting, and application-aware benchmarking.
                </p>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </SiteShell>
  );
}
