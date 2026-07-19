"use client";

import { useId, useState } from "react";

import {
  countActiveFilters,
  materialOptions,
  yearOptions,
} from "@/lib/atlas/filters";
import {
  BIAS_LABELS,
  formatNoiseMethod,
  NOISE_METHOD_LABELS,
  TEMPERATURE_LABELS,
} from "@/lib/atlas/format";
import type {
  AtlasFilterState,
  AtlasRecord,
  BiasCondition,
  NoiseMethod,
  PublicationFilter,
  PublicFlag,
  TemperatureCategory,
} from "@/lib/atlas/types";
import { NOISE_METHODS } from "@/lib/atlas/types";

export interface AtlasFiltersProps {
  records: readonly AtlasRecord[];
  filters: AtlasFilterState;
  resultCount: number;
  lockedMaterial?: string;
  onChange: (filters: AtlasFilterState) => void;
  onReset: () => void;
}

const SPECTRAL_BANDS = [
  { label: "NIR", min: 700, max: 1000 },
  { label: "SWIR", min: 1000, max: 2500 },
  { label: "MWIR", min: 3000, max: 5000 },
] as const;

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function AtlasFilters({
  records,
  filters,
  resultCount,
  lockedMaterial,
  onChange,
  onReset,
}: AtlasFiltersProps) {
  const id = useId();
  const materials = materialOptions(records);
  const years = yearOptions(records);
  const activeCount = Math.max(
    0,
    countActiveFilters(filters) - Number(Boolean(lockedMaterial)),
  );
  const advancedActiveCount =
    Number(filters.year !== undefined) +
    Number(filters.temperature !== "all") +
    Number(filters.bias !== "all") +
    Number(filters.noiseMethod !== "all") +
    Number(filters.flag !== "all") +
    Number(filters.publicationType !== "all");
  const [advancedOpen, setAdvancedOpen] = useState(advancedActiveCount > 0);
  const invalidRange =
    filters.wavelengthMin !== undefined &&
    filters.wavelengthMax !== undefined &&
    filters.wavelengthMin > filters.wavelengthMax;
  const update = <Key extends keyof AtlasFilterState>(
    key: Key,
    value: AtlasFilterState[Key],
  ) => onChange({ ...filters, [key]: value });
  const updateWavelength = (min?: number, max?: number) =>
    onChange({ ...filters, wavelengthMin: min, wavelengthMax: max });

  const chips: Array<{ label: string; clear: () => void }> = [];
  if (filters.search.trim()) {
    chips.push({
      label: `Search: ${filters.search.trim()}`,
      clear: () => update("search", ""),
    });
  }
  if (!lockedMaterial && filters.material !== "all") {
    chips.push({
      label: filters.material,
      clear: () => update("material", "all"),
    });
  }
  if (
    filters.wavelengthMin !== undefined ||
    filters.wavelengthMax !== undefined
  ) {
    chips.push({
      label: `${filters.wavelengthMin ?? "Any"}–${filters.wavelengthMax ?? "Any"} nm`,
      clear: () => updateWavelength(),
    });
  }
  if (filters.year !== undefined) {
    chips.push({
      label: String(filters.year),
      clear: () => update("year", undefined),
    });
  }
  if (filters.temperature !== "all") {
    chips.push({
      label: TEMPERATURE_LABELS[filters.temperature],
      clear: () => update("temperature", "all"),
    });
  }
  if (filters.bias !== "all") {
    chips.push({
      label: BIAS_LABELS[filters.bias],
      clear: () => update("bias", "all"),
    });
  }
  if (filters.noiseMethod !== "all") {
    chips.push({
      label: formatNoiseMethod(filters.noiseMethod),
      clear: () => update("noiseMethod", "all"),
    });
  }
  if (filters.flag !== "all") {
    chips.push({
      label: `${filters.flag === "green" ? "Green" : "Amber"} flag`,
      clear: () => update("flag", "all"),
    });
  }
  if (filters.publicationType !== "all") {
    const publicationLabels: Record<PublicationFilter, string> = {
      peer_reviewed: "Peer reviewed",
      preprint: "Preprint",
      demonstration: "Demonstration",
    };
    chips.push({
      label: publicationLabels[filters.publicationType],
      clear: () => update("publicationType", "all"),
    });
  }

  return (
    <form
      className="atlas-filters"
      aria-label="Filter atlas measurements"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="atlas-filters__heading">
        <div>
          <p className="section-kicker">Research workspace</p>
          <h2>Find comparable measurements</h2>
          <p aria-live="polite">
            {resultCount} {resultCount === 1 ? "measurement" : "measurements"}
          </p>
        </div>
        <div className="atlas-filters__heading-actions">
          <button
            className="atlas-filters__advanced-toggle"
            type="button"
            aria-expanded={advancedOpen}
            aria-controls={`${id}-advanced`}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            {advancedOpen ? "Hide" : "More"} filters
            {advancedActiveCount ? ` (${advancedActiveCount})` : ""}
          </button>
          <button
            className="atlas-filters__reset"
            type="button"
            onClick={() => {
              onReset();
              setAdvancedOpen(false);
            }}
            disabled={activeCount === 0}
          >
            Reset{activeCount ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>

      <div className="atlas-filters__primary">
        <label
          className="atlas-field atlas-field--search"
          htmlFor={`${id}-search`}
        >
          <span>Search</span>
          <input
            id={`${id}-search`}
            type="search"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Paper, author, material, DOI, architecture…"
            autoComplete="off"
            aria-controls="atlas-performance-plot atlas-measurement-table"
          />
        </label>

        <label className="atlas-field" htmlFor={`${id}-material`}>
          <span>Material</span>
          <select
            id={`${id}-material`}
            value={filters.material}
            disabled={Boolean(lockedMaterial)}
            onChange={(event) => update("material", event.target.value)}
          >
            {lockedMaterial ? (
              <option value={lockedMaterial}>{lockedMaterial}</option>
            ) : (
              <>
                <option value="all">All materials</option>
                {materials.map((material) => (
                  <option value={material} key={material}>
                    {material}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>

        <fieldset className="atlas-fieldset atlas-fieldset--range">
          <legend>Wavelength (nm)</legend>
          <label htmlFor={`${id}-wavelength-min`}>
            <span className="sr-only">Minimum wavelength</span>
            <input
              id={`${id}-wavelength-min`}
              inputMode="decimal"
              min="0"
              step="any"
              type="number"
              placeholder="Minimum"
              value={filters.wavelengthMin ?? ""}
              onChange={(event) =>
                update("wavelengthMin", optionalNumber(event.target.value))
              }
              aria-invalid={invalidRange}
            />
          </label>
          <span aria-hidden="true">to</span>
          <label htmlFor={`${id}-wavelength-max`}>
            <span className="sr-only">Maximum wavelength</span>
            <input
              id={`${id}-wavelength-max`}
              inputMode="decimal"
              min="0"
              step="any"
              type="number"
              placeholder="Maximum"
              value={filters.wavelengthMax ?? ""}
              onChange={(event) =>
                update("wavelengthMax", optionalNumber(event.target.value))
              }
              aria-invalid={invalidRange}
            />
          </label>
          {invalidRange ? (
            <small className="atlas-fieldset__error" role="alert">
              Minimum must not exceed maximum.
            </small>
          ) : null}
        </fieldset>

        <div className="spectral-presets" aria-label="Spectral band shortcuts">
          <span>Spectral band</span>
          <div>
            {SPECTRAL_BANDS.map((band) => {
              const active =
                filters.wavelengthMin === band.min &&
                filters.wavelengthMax === band.max;
              return (
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    active
                      ? updateWavelength()
                      : updateWavelength(band.min, band.max)
                  }
                  key={band.label}
                >
                  {band.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {advancedOpen ? (
        <div className="atlas-filters__advanced" id={`${id}-advanced`}>
          <label className="atlas-field" htmlFor={`${id}-year`}>
            <span>Publication year</span>
            <select
              id={`${id}-year`}
              value={filters.year ?? "all"}
              onChange={(event) =>
                update(
                  "year",
                  event.target.value === "all"
                    ? undefined
                    : Number(event.target.value),
                )
              }
            >
              <option value="all">All years</option>
              {years.map((year) => (
                <option value={year} key={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="atlas-field" htmlFor={`${id}-temperature`}>
            <span>Temperature</span>
            <select
              id={`${id}-temperature`}
              value={filters.temperature}
              onChange={(event) =>
                update(
                  "temperature",
                  event.target.value as TemperatureCategory | "all",
                )
              }
            >
              <option value="all">All temperatures</option>
              {Object.entries(TEMPERATURE_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="atlas-field" htmlFor={`${id}-bias`}>
            <span>Bias condition</span>
            <select
              id={`${id}-bias`}
              value={filters.bias}
              onChange={(event) =>
                update("bias", event.target.value as BiasCondition | "all")
              }
            >
              <option value="all">All bias conditions</option>
              {Object.entries(BIAS_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="atlas-field" htmlFor={`${id}-noise`}>
            <span>Noise method</span>
            <select
              id={`${id}-noise`}
              value={filters.noiseMethod}
              onChange={(event) =>
                update("noiseMethod", event.target.value as NoiseMethod | "all")
              }
            >
              <option value="all">All noise methods</option>
              {NOISE_METHODS.map((method) => (
                <option value={method} key={method}>
                  {NOISE_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </label>

          <label className="atlas-field" htmlFor={`${id}-flag`}>
            <span>Documentation flag</span>
            <select
              id={`${id}-flag`}
              value={filters.flag}
              onChange={(event) =>
                update("flag", event.target.value as PublicFlag | "all")
              }
            >
              <option value="all">Green and amber</option>
              <option value="green">Green</option>
              <option value="amber">Amber</option>
            </select>
          </label>

          <label className="atlas-field" htmlFor={`${id}-publication`}>
            <span>Publication type</span>
            <select
              id={`${id}-publication`}
              value={filters.publicationType}
              onChange={(event) =>
                update(
                  "publicationType",
                  event.target.value as PublicationFilter | "all",
                )
              }
            >
              <option value="all">All source types</option>
              <option value="peer_reviewed">Peer-reviewed papers</option>
              <option value="preprint">Preprints</option>
              <option value="demonstration">Demonstration records</option>
            </select>
          </label>
        </div>
      ) : null}

      {chips.length ? (
        <div className="atlas-filter-chips" aria-label="Active filters">
          <span>Active</span>
          {chips.map((chip) => (
            <button type="button" onClick={chip.clear} key={chip.label}>
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
