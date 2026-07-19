"use client";

import { SiteShell } from "@/components/SiteShell";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <SiteShell>
      <section className="page-shell error-state">
        <p className="eyebrow">Atlas unavailable</p>
        <h1>The data view could not be prepared.</h1>
        <p>
          The curated files may have changed or the page may need to be loaded
          again. No data has been modified.
        </p>
        <button className="primary-button" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </SiteShell>
  );
}
