import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MeasurementDetails } from "@/components/atlas";
import { DemoBanner } from "@/components/DemoBanner";
import { SiteShell } from "@/components/SiteShell";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data";

type PageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return atlasData.measurements.map((measurement) => ({
    id: measurement.measurement_id,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const record = atlasData.records.find(
    (candidate) => candidate.measurement.measurement_id === id,
  );

  return record
    ? {
        title: `${record.device.material_family} · ${record.measurement.wavelength_nm} nm`,
        description: `Measurement record ${id}: ${record.device.material_family} photodiode detectivity at ${record.measurement.wavelength_nm} nm.`,
      }
    : { title: "Measurement not found" };
}

export default async function MeasurementPage({ params }: PageProps) {
  const { id } = await params;
  const joinedRecord = atlasData.records.find(
    (candidate) => candidate.measurement.measurement_id === id,
  );

  if (!joinedRecord) notFound();

  const record = normalizeJoinedMeasurement(joinedRecord);

  return (
    <SiteShell>
      <div className="page-shell record-page">
        <div className="record-breadcrumbs">
          <Link href="/">Atlas</Link>
          <span aria-hidden="true">/</span>
          <span>Measurement {record.measurement.measurementId}</span>
        </div>
        {record.paper.publicationType === "demonstration" ? (
          <DemoBanner />
        ) : null}
        <MeasurementDetails record={record} variant="full" />
      </div>
    </SiteShell>
  );
}
