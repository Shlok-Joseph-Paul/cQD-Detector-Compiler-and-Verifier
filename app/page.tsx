import { AtlasExplorer } from "@/components/atlas";
import { DemoBanner } from "@/components/DemoBanner";
import { SiteShell } from "@/components/SiteShell";
import { atlasData } from "@/lib/data";

export default function Home() {
  const materialCount = new Set(
    atlasData.records.map((record) => record.device.material_family),
  ).size;

  return (
    <SiteShell>
      <section className="atlas-hero">
        <div className="page-shell atlas-hero__grid">
          <div className="atlas-hero__copy">
            <p className="eyebrow">
              Curated scientific data · first working release
            </p>
            <h1>CQD Photodiode Atlas</h1>
            <p className="atlas-hero__lede">
              A curated map of reported colloidal quantum-dot photodiode
              performance across materials and wavelengths.
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

          <aside className="method-card" aria-label="How to read the atlas">
            <div className="method-card__formula" aria-hidden="true">
              <span>D*</span>
              <i />
              <span>λ</span>
            </div>
            <p className="method-card__title">How to read this release</p>
            <ul>
              <li>Each point is one reported photodiode measurement.</li>
              <li>
                Measured-noise and shot-noise-derived values are distinct.
              </li>
              <li>
                Green and amber flags describe documentation and comparability.
              </li>
              <li>
                Inclusion reports a published value; it is not an endorsement.
              </li>
            </ul>
          </aside>
        </div>
        <div className="page-shell atlas-hero__footer">
          <div className="hero-stat">
            <strong>{atlasData.records.length}</strong>
            <span>demo measurements</span>
          </div>
          <div className="hero-stat">
            <strong>{materialCount}</strong>
            <span>material families</span>
          </div>
          <div className="hero-stat hero-stat--wide">
            <strong>Measurement-level</strong>
            <span>paper → device → operating point</span>
          </div>
        </div>
      </section>

      <div className="page-shell home-demo-notice">
        <DemoBanner />
      </div>

      <section className="page-shell atlas-section" id="performance-map">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Performance map</p>
            <h2>Detectivity across wavelength</h2>
          </div>
          <p>
            Filter the logarithmic D* map and the table together. Select a point
            to inspect its device, operating conditions, noise method, and
            source.
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
