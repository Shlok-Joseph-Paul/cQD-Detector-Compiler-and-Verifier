import type { Metadata } from "next";
import Link from "next/link";

import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Scope, detector classes, record structure, noise classifications, and curation policy for the CQD and perovskite Photodiode Atlas.",
};

const includedRecords = [
  "Experimental solution-processed colloidal quantum-dot photodiodes, photoconductors, and phototransistors.",
  "Experimental metal-halide perovskite photodiodes, photoconductors, and phototransistors, including 3D, 2D, quasi-2D, mixed-halide, lead, tin, and lead-free absorbers.",
  "Peer-reviewed primary papers and clearly identified preprints.",
  "Measurements for which a specific detectivity and measurement wavelength can be identified.",
  "Distinct operating points from the same device when the publication reports them separately.",
];

const excludedRecords = [
  "Bolometers and other thermal detectors.",
  "Focal-plane-array reports without an extractable supported-device measurement.",
  "Epitaxial or self-assembled quantum-dot detectors.",
  "Perovskite solar cells and LEDs without an extractable detector measurement.",
  "Theoretical devices without an experimental supported photodetector.",
  "Comparison values copied from another paper; those values belong to the original source record.",
];

const greenCriteria = [
  "Detectivity and wavelength are explicitly identifiable.",
  "The value does not use a shot-noise approximation.",
  "The value does not use a Johnson-noise-only approximation.",
  "A lock-in amplifier was not the sole noise-acquisition method.",
  "A source measure unit was not the sole spectral acquisition route; mixed workflows that also use a spectrum or dynamic-signal analyzer remain eligible for green review.",
  "No curator-applied caution identifies an unreported D* noise basis as material to interpretation.",
  "The reported detectivity does not appear substantially above a plausible BLIP limit.",
  "The measured device noise was not reported below the current preamplifier noise floor.",
  "When D* combines measured or unspecified noise with responsivity/EQE, the signal and noise frequencies are both known and matched.",
];

const unverifiedCriteria = [
  "D* combines measured or unspecified noise with a reported responsivity/EQE value.",
  "The source does not establish both the signal frequency and the noise frequency needed to verify a match.",
  "No amber methodological caution applies; amber takes precedence when it does.",
];

const amberReasons = [
  "Detectivity uses a shot-noise approximation.",
  "Detectivity uses a Johnson-noise-only approximation.",
  "A lock-in amplifier was the sole noise-acquisition method.",
  "A source measure unit or parameter analyzer acquired the noise signal without a spectrum or dynamic-signal analyzer in the reported acquisition chain.",
  "A curator determined that the publication does not establish the D* noise basis at a critical operating point.",
  "The reported detectivity appears substantially above a plausible background-limited infrared photodetection (BLIP) limit and warrants manual review.",
  "The measured device noise was reported below the current preamplifier noise floor.",
  "Responsivity or EQE was acquired at a different frequency from the noise value used for D*.",
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
              A concise guide to what the Atlas includes, how measurements are
              structured, and why a result is labeled green, frequency
              unverified, or amber.
            </p>
          </header>

          <div
            className="methodology-at-a-glance"
            aria-label="Methodology summary"
          >
            <div>
              <span>Scope</span>
              <strong>CQD and perovskite detectors</strong>
            </div>
            <div>
              <span>Compared as</span>
              <strong>Individual measurements</strong>
            </div>
            <div>
              <span>Evidence labels</span>
              <strong>Green · Unverified · Amber</strong>
            </div>
          </div>

          <section aria-labelledby="scope-heading">
            <h2 id="scope-heading">Scientific scope</h2>
            <p>
              An in-scope device is an experimental photodiode, photoconductor,
              or phototransistor whose absorber is either solution-processed
              colloidal quantum dots or a metal-halide perovskite. A record must
              report specific detectivity, D<sup>*</sup>, in Jones (cm Hz
              <sup>1/2</sup> W<sup>−1</sup>).
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
              Detector class is stored at the device level. The atlas permits a
              combined view, but class-specific filtering is recommended for
              benchmarking because internal gain, carrier lifetime, transit
              time, bias-dependent noise, geometry, and bandwidth normalization
              can make cross-class D* comparisons misleading. Detector class
              alone does not determine review status.
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
                <strong>Device</strong> stores detector class, material,
                architecture, layer stack, active area, and ligand-exchange
                method.
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

          <section aria-labelledby="ligand-exchange-heading">
            <h2 id="ligand-exchange-heading">Ligand-exchange methods</h2>
            <p>
              CQD ligand exchange is recorded at the device level because a
              paper can compare several treatments or use different exchanges in
              the absorber and charge-transport layers. The atlas preserves the
              reported chemicals, native ligands, treated layer, processing
              conditions, and exact source location.
            </p>
            <p>
              Process types distinguish solid-state or layer-by-layer exchange,
              solution-phase exchange before deposition, exchanged CQD inks, and
              mixed workflows. <q>Not reported</q> is used only after the
              supplied main article and available Supporting Information have
              been checked, while <q>Not used</q> preserves an explicit
              statement that the device avoids ligand exchange. Ambiguous
              assignments and unavailable sources remain explicit and do not
              affect the measurement review status.
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
                <dt>Johnson-noise approximation</dt>
                <dd>
                  Noise was estimated only from device resistance and
                  temperature rather than measured as a total-noise spectrum.
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

            <details className="methodology-detail">
              <summary>Noise-acquisition instrument rules</summary>
              <div>
                <p>
                  The Atlas records spectrum or signal analyzers, lock-in
                  amplifiers operating in noise mode, oscilloscope or
                  transient-current FFT methods, dedicated noise analyzers, and
                  reported preamplifier details.
                </p>
                <p>
                  A lock-in or source measure unit is counted only when the
                  source explicitly includes it in the noise-acquisition chain,
                  not when it merely supplies bias or measures responsivity,
                  EQE, photocurrent, or J–V data. Mixed workflows retain every
                  reported method. <q>Not reported</q> and <q>Not applicable</q>
                  do not independently change review status.
                </p>
              </div>
            </details>

            <div
              className="callout callout-amber"
              role="note"
              aria-label="Shot-noise interpretation note"
            >
              <strong>Why modeled shot noise is amber.</strong>
              <p>
                Estimating noise from √(2qI<sub>dark</sub>) may omit 1/f,
                generation–recombination, readout, and other device-specific
                noise. Amber does not say the result is incorrect; it marks a
                comparability difference from measured total noise.
              </p>
            </div>
          </section>

          <section aria-labelledby="curation-status-heading">
            <h2 id="curation-status-heading">Curation status</h2>
            <p>
              Curation status is independent of the green, unverified, or amber
              measurement status. <strong>Reviewed</strong> means a human
              curator has confirmed the Paper → Device → Measurement assignment.{" "}
              <strong>Needs human review</strong> identifies a provisional
              record whose reported value is sufficiently documented to remain
              visible, but whose interpretation or assignment still has a named
              unresolved question.
            </p>
            <p>
              Every provisional record displays that question in its curator
              note. Provisional measurements remain searchable and available in
              the measurement index and data exports, but they are excluded from
              performance plots, paper maxima, rankings, and aggregate material
              summaries until a curator resolves them.
            </p>
          </section>

          <section aria-labelledby="flags-heading">
            <h2 id="flags-heading">Green, unverified, and amber status</h2>
            <p>
              Flags communicate documentation and comparability, not a ranking
              of scientific quality. Three public levels are used, with
              precedence amber → unverified → green.
            </p>

            <div className="flag-policy-grid">
              <article className="flag-policy flag-policy-green">
                <h3>Green</h3>
                <p>
                  No defined methodological caution applies, and any relevant
                  signal/noise frequencies are known and matched.
                </p>
              </article>
              <article className="flag-policy flag-policy-unverified">
                <h3>Unverified</h3>
                <p>
                  Measured or unspecified noise is used, but the source does not
                  establish the frequencies needed to verify compatibility.
                </p>
              </article>
              <article className="flag-policy flag-policy-amber">
                <h3>Amber</h3>
                <p>
                  A defined caution applies, such as modeled noise, a limited
                  acquisition method, or an explicit frequency mismatch.
                </p>
              </article>
            </div>

            <p>
              Unverified is not an amber reason and does not assert that the
              frequencies differ. It records insufficient evidence to verify
              that the responsivity/EQE and sampled-noise inputs are directly
              comparable. Calculated shot- and Johnson-noise records do not use
              this frequency test; they remain amber under their applicable
              modeled-noise cautions.
            </p>
            <details className="methodology-detail">
              <summary>View the complete status rules</summary>
              <div className="methodology-rule-columns">
                <section>
                  <h3>Green requirements</h3>
                  <ul>
                    {greenCriteria.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Unverified requirements</h3>
                  <ul>
                    {unverifiedCriteria.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Amber reasons</h3>
                  <ul>
                    {amberReasons.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </details>
          </section>

          <section aria-labelledby="values-heading">
            <h2 id="values-heading">How values are handled</h2>
            <p>
              Information absent from the publication is stored as a null value
              and displayed as <q>Not reported</q>. It is never converted to
              zero, guessed from an unrelated condition, or silently backfilled.
              Missing conditions—such as bias, temperature, or area—do not by
              themselves trigger amber. Missing signal/noise frequency evidence
              produces an unverified status when that comparison applies.
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
            <details className="methodology-detail">
              <summary>Extended performance-metric rules</summary>
              <div>
                <p>
                  Responsivity, response time, explicit −3 dB bandwidth, and LDR
                  retain their own wavelength, bias, temperature, frequency,
                  definition, and source location because these may differ from
                  the plotted D<sup>*</sup> operating point.
                </p>
                <p>
                  Rise time, fall time, general response time, and bandwidth are
                  stored separately. Tested modulation frequency is not treated
                  as bandwidth without an explicit −3 dB definition, and LDR
                  requires a source-identified linear range.
                </p>
                <p>
                  <q>Not reported</q>, <q>Not checked</q>, and
                  <q>Source unavailable</q> describe review coverage; they do
                  not change green, unverified, or amber status.
                </p>
              </div>
            </details>
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
