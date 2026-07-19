import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AtlasExplorer, MaterialLabel } from "@/components/atlas";
import { SiteShell } from "@/components/SiteShell";
import { formatScientific } from "@/lib/atlas/format";
import { summarizeMaterials } from "@/lib/atlas/materials";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data";

type PageProps = { params: Promise<{ material: string }> };

const normalizedRecords = atlasData.records.map(normalizeJoinedMeasurement);
const materialSummaries = summarizeMaterials(normalizedRecords);

export function generateStaticParams() {
  return materialSummaries.map((summary) => ({ material: summary.material }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { material } = await params;
  const decodedMaterial = decodeURIComponent(material);
  return {
    title: decodedMaterial,
    description: `Curated ${decodedMaterial} colloidal quantum-dot photodiode measurements and material summary.`,
  };
}

export default async function MaterialDetailPage({ params }: PageProps) {
  const { material } = await params;
  const decodedMaterial = decodeURIComponent(material);
  const summary = materialSummaries.find(
    (candidate) => candidate.material === decodedMaterial,
  );

  if (!summary) notFound();

  return (
    <SiteShell>
      <section className="page-shell material-detail-hero">
        <div className="record-breadcrumbs">
          <Link href="/materials">Materials</Link>
          <span aria-hidden="true">/</span>
          <span>{decodedMaterial}</span>
        </div>
        <p className="eyebrow">Material family</p>
        <div className="material-detail-hero__grid">
          <h1>
            <MaterialLabel value={decodedMaterial} />
          </h1>
          <p>
            This curated subset contains {summary.measurementCount} measurement
            {summary.measurementCount === 1 ? "" : "s"} from{" "}
            {summary.paperCount} source record
            {summary.paperCount === 1 ? "" : "s"}, spanning{" "}
            {summary.wavelengthMinNm.toLocaleString()}–
            {summary.wavelengthMaxNm.toLocaleString()} nm. Its highest listed D*
            is {formatScientific(summary.highestDetectivityJones)} Jones.
          </p>
        </div>
      </section>

      <section className="page-shell atlas-section material-atlas-section">
        <AtlasExplorer
          records={atlasData.records}
          initialMaterial={decodedMaterial}
          mode="material"
          title={`${decodedMaterial} measurements`}
        />
      </section>
    </SiteShell>
  );
}
