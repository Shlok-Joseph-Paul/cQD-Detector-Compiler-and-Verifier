import { AtlasExplorer } from "@/components/atlas";
import { SiteShell } from "@/components/SiteShell";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data";

export default function Home() {
  const records = atlasData.records.map(normalizeJoinedMeasurement);
  const paperCount = new Set(records.map((record) => record.paper.paperId))
    .size;
  const deviceCount = new Set(records.map((record) => record.device.deviceId))
    .size;
  const materialCount = new Set(
    records.map((record) => record.device.materialFamily),
  ).size;
  const latestUpdate = records
    .map((record) => record.measurement.dateUpdated)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  const formattedUpdate = latestUpdate
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${latestUpdate}T00:00:00Z`))
    : "Not reported";

  return (
    <SiteShell>
      <section className="atlas-hero">
        <div className="page-shell atlas-hero__grid">
          <div className="atlas-hero__copy">
            <p className="eyebrow">Curator-reviewed literature data</p>
            <h1>CQD Photodiode Atlas</h1>
            <p className="atlas-hero__lede">
              Compare reported colloidal quantum-dot photodiode performance
              across materials, wavelengths, and measurement methods.
            </p>
            <div className="atlas-hero__actions">
              <a className="primary-button" href="#performance-map">
                Explore performance map
              </a>
              <a className="secondary-button" href="/methodology">
                Read methodology
              </a>
            </div>
          </div>

          <aside className="method-card" aria-label="Atlas curation summary">
            <div className="method-card__formula" aria-hidden="true">
              <span>D*</span>
              <i />
              <span>λ</span>
            </div>
            <p className="method-card__title">
              Built for scientific comparison
            </p>
            <ul>
              <li>Each point is one reported photodiode measurement.</li>
              <li>Noise methodology stays attached to every D* value.</li>
              <li>Green and amber flags expose comparison caveats.</li>
            </ul>
            <a href="/methodology">Review the curation policy →</a>
          </aside>
        </div>
        <div className="page-shell atlas-hero__footer">
          <div className="hero-stat">
            <strong>{atlasData.records.length}</strong>
            <span>measurements</span>
          </div>
          <div className="hero-stat">
            <strong>{paperCount}</strong>
            <span>papers</span>
          </div>
          <div className="hero-stat">
            <strong>{deviceCount}</strong>
            <span>devices</span>
          </div>
          <div className="hero-stat">
            <strong>{materialCount}</strong>
            <span>material families</span>
          </div>
        </div>
        <p className="page-shell atlas-hero__updated">
          Curator reviewed · Last updated {formattedUpdate} · Paper → device →
          measurement provenance
        </p>
      </section>

      <section className="page-shell atlas-section" id="performance-map">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Performance map</p>
            <h2>Explore the detectivity landscape</h2>
          </div>
          <p>
            Filter the map and table together. Select any point to inspect its
            device, operating conditions, noise method, and source.
          </p>
        </div>
        <AtlasExplorer records={atlasData.records} mode="full" />
      </section>

      <section className="page-shell methodology-strip">
        <div>
          <p className="eyebrow">Curation principle</p>
          <h2>Comparability begins with context.</h2>
        </div>
        <p>
          Detectivity values can depend strongly on bias, temperature, detector
          area, measurement frequency, and the treatment of noise. The atlas
          keeps those details attached to each point—and names what is missing.
        </p>
        <a className="secondary-button" href="/methodology">
          View inclusion policy
        </a>
      </section>
    </SiteShell>
  );
}
