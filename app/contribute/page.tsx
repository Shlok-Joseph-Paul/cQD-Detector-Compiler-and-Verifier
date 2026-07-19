import type { Metadata } from "next";

import { SiteShell } from "@/components/SiteShell";

const newIssueUrl =
  "https://github.com/Shlok-Joseph-Paul/cQD-Detector-Compiler-and-Verifier/issues/new";

export const metadata: Metadata = {
  title: "Contribute",
  description:
    "Suggest a missing paper, correct a record, or provide additional metadata for the CQD Photodiode Atlas.",
};

export default function ContributePage() {
  return (
    <SiteShell>
      <div className="page-shell prose-page">
        <article>
          <header className="prose-hero">
            <p className="eyebrow">Contribute</p>
            <h1>Help improve the record</h1>
            <p className="prose-lede">
              Researchers and authors can suggest a missing publication, report
              a correction, or supply measurement metadata that is absent from a
              current record.
            </p>
          </header>

          <section aria-labelledby="steps-heading">
            <h2 id="steps-heading">How to make a suggestion</h2>
            <ol className="contribution-steps">
              <li>
                <strong>Check the atlas first.</strong> Search by DOI, title, or
                measurement identifier to avoid a duplicate report.
              </li>
              <li>
                <strong>Open one GitHub issue per paper or correction.</strong>{" "}
                Use a title such as <q>Missing paper: First author, year</q> or
                <q>Correction: measurement ID</q>.
              </li>
              <li>
                <strong>Provide provenance.</strong> Link the DOI or official
                publication page and cite the exact page, figure, table, or
                supporting-information location for the value.
              </li>
              <li>
                <strong>Describe the requested change.</strong> For a
                correction, include the current value, proposed value, units,
                and supporting evidence.
              </li>
            </ol>
            <p>
              <a href={newIssueUrl} target="_blank" rel="noreferrer">
                Start a new issue in the project repository
              </a>
              . A maintainer will review the source and validation results
              before any public record changes.
            </p>
          </section>

          <section aria-labelledby="include-heading">
            <h2 id="include-heading">What to include</h2>
            <div className="contribution-grid">
              <article>
                <h3>Missing paper</h3>
                <ul>
                  <li>Paper title, authors, year, and journal</li>
                  <li>DOI or stable publication link</li>
                  <li>Why the device meets the CQD photodiode scope</li>
                  <li>
                    Where D<sup>*</sup> and wavelength are reported
                  </li>
                  <li>Whether the source is peer reviewed or a preprint</li>
                </ul>
              </article>
              <article>
                <h3>Record correction</h3>
                <ul>
                  <li>Measurement, device, or paper identifier</li>
                  <li>Field that needs correction</li>
                  <li>Current and proposed values, including units</li>
                  <li>Exact source location and a short explanation</li>
                </ul>
              </article>
              <article>
                <h3>Additional metadata</h3>
                <ul>
                  <li>Measurement identifier</li>
                  <li>Bias, temperature, area, frequency, or other field</li>
                  <li>Value and units exactly as reported</li>
                  <li>
                    Page, figure, table, or supporting-information location
                  </li>
                </ul>
              </article>
            </div>
          </section>

          <section aria-labelledby="source-heading">
            <h2 id="source-heading">Source and copyright guidance</h2>
            <p>
              Link to an official publication page, DOI, repository copy, or
              other legally accessible source. Do not upload paywalled PDFs,
              reproduce large portions of copyrighted text, share institutional
              credentials, or post private correspondence. A precise source
              citation is normally sufficient for a curator to verify a field.
            </p>
          </section>

          <section aria-labelledby="review-heading">
            <h2 id="review-heading">What happens next</h2>
            <p>
              A contribution is a proposal, not an immediate publication. A
              human curator checks scientific scope, traces the value to its
              original source, records missing conditions, applies the green or
              amber criteria, and runs data validation. Discussion and the final
              disposition remain visible on the issue for an auditable history.
            </p>
          </section>
        </article>

        <aside className="callout" aria-label="Contribution workflow">
          <strong>Contributions use public GitHub issues.</strong>
          <p>
            This first version does not submit a private web form or send email.
            Please avoid including confidential, personal, or unpublished
            information in an issue.
          </p>
          <a
            className="primary-button"
            href={newIssueUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open a contribution issue
          </a>
        </aside>
      </div>
    </SiteShell>
  );
}
