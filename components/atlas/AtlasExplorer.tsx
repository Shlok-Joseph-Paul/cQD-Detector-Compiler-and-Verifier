"use client";

import { useDeferredValue, useMemo, useState } from "react";

import type { JoinedMeasurement } from "@/lib/data/types";
import { filterAtlasRecords } from "@/lib/atlas/filters";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import type { AtlasFilterState, AtlasRecord } from "@/lib/atlas/types";

import { AtlasFilters } from "./AtlasFilters";
import { MeasurementDetails } from "./MeasurementDetails";
import { MeasurementTable } from "./MeasurementTable";
import { PerformancePlot } from "./PerformancePlot";
import { useUrlAtlasFilters } from "./useUrlAtlasFilters";

export interface AtlasExplorerProps {
  records: readonly JoinedMeasurement[];
  initialMaterial?: string;
  mode?: "full" | "material";
  title?: string;
}

export function AtlasExplorer({
  records,
  initialMaterial,
  mode = "full",
  title,
}: AtlasExplorerProps) {
  const normalized = useMemo(
    () => records.map(normalizeJoinedMeasurement),
    [records],
  );
  const initialFilters: Partial<AtlasFilterState> | undefined = initialMaterial
    ? { material: initialMaterial }
    : undefined;
  const lockedMaterial = mode === "material" ? initialMaterial : undefined;
  const { filters, setFilters, resetFilters } = useUrlAtlasFilters(
    initialFilters,
    lockedMaterial,
  );
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(
    () => filterAtlasRecords(normalized, deferredFilters),
    [normalized, deferredFilters],
  );
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string>();
  const selectedRecord = filtered.find(
    (record) => record.measurement.measurementId === selectedMeasurementId,
  );
  const selectRecord = (record: AtlasRecord) =>
    setSelectedMeasurementId(record.measurement.measurementId);

  return (
    <div className={`atlas-explorer atlas-explorer--${mode}`}>
      {title ? (
        <div className="atlas-explorer__heading">
          <h2>{title}</h2>
          <p>
            Each point and row represents one reported photodiode measurement.
            Filters are reflected in the URL so this view can be shared.
          </p>
        </div>
      ) : null}

      <AtlasFilters
        records={normalized}
        filters={filters}
        resultCount={filtered.length}
        lockedMaterial={lockedMaterial}
        onChange={setFilters}
        onReset={resetFilters}
      />

      <div
        className={`atlas-explorer__visual${
          selectedRecord ? " atlas-explorer__visual--selected" : ""
        }`}
      >
        <PerformancePlot
          records={filtered}
          selectedMeasurementId={selectedMeasurementId}
          onSelect={selectRecord}
        />

        {selectedRecord ? (
          <aside className="atlas-explorer__selection" aria-live="polite">
            <MeasurementDetails
              record={selectedRecord}
              variant="summary"
              showDetailLink
              onClose={() => setSelectedMeasurementId(undefined)}
            />
          </aside>
        ) : null}
      </div>

      <MeasurementTable records={filtered} />
    </div>
  );
}
