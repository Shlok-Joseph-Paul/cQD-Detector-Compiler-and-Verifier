"use client";

import { useId } from "react";

import {
  countActiveFilters,
  materialOptions,
  yearOptions,
} from "@/lib/atlas/filters";
import {
  BIAS_LABELS,
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
  const invalidRange =
    filters.wavelengthMin !== undefined &&
    filters.wavelengthMax !== undefined &&
    filters.wavelengthMin > filters.wavelengthMax;
  const update = <Key extends keyof AtlasFilterState>(
    key: Key,
    value: AtlasFilterState[Key],
  ) => onChange({ ...filters, [key]: value });

  return (
    <form
      className="atlas-filters"
      aria-label="Filter atlas measurements"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="atlas-filters__heading">
        <div>
          <h2>Filter measurements</h2>
          <p aria-live="polite">
            {resultCount} {resultCount === 1 ? "measurement" : "measurements"}
          </p>
        </div>
        <button
          className="atlas-filters__reset"
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
        >
          Reset filters{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      <div className="atlas-filters__grid">
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
            placeholder="Material, DOI, paper, author, architecture…"
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
          <legend>Wavelength range (nm)</legend>
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
    </form>
  );
}
