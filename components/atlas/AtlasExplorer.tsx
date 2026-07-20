"use client";

import { useDeferredValue, useMemo, useState } from "react";

import type { JoinedMeasurement } from "@/lib/data/types";
import { filterAtlasRecords } from "@/lib/atlas/filters";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import type { AtlasFilterState, AtlasRecord } from "@/lib/atlas/types";

import { AtlasFilters } from "./AtlasFilters";
import { MeasurementDetails } from "./MeasurementDetails";
import { MetricMeasurementTable } from "./MetricMeasurementTable";
import { PerformanceExplorer } from "./PerformanceExplorer";
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
  const filterByMaterial = (material: string) =>
    setFilters({ ...filters, material });

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

      <div
        className={`atlas-explorer__visual${
          selectedRecord ? " atlas-explorer__visual--selected" : ""
        }`}
      >
        <PerformanceExplorer
          records={filtered}
          plotMode={filters.plotMode}
          plotX={filters.plotX}
          plotY={filters.plotY}
          plotScope={filters.plotScope}
          activeMaterial={filters.material}
          selectedMeasurementId={selectedMeasurementId}
          onConfigChange={(changes) => setFilters({ ...filters, ...changes })}
          onMaterialFilter={
            lockedMaterial
              ? undefined
              : (material) => filterByMaterial(material)
          }
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

      <AtlasFilters
        records={normalized}
        filters={filters}
        resultCount={filtered.length}
        lockedMaterial={lockedMaterial}
        onChange={setFilters}
        onReset={resetFilters}
      />

      <MetricMeasurementTable
        records={filtered}
        view={filters.tableView}
        onViewChange={(tableView) => setFilters({ ...filters, tableView })}
      />
    </div>
  );
}
