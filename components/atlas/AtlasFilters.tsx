"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  clearMetricFilters,
  countActiveFilters,
  materialOptions,
  normalizeMetricFilterValue,
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
  AtlasHistoryMode,
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
  onChange: (filters: AtlasFilterState, historyMode?: AtlasHistoryMode) => void;
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

function MetricNumberField({
  id,
  label,
  value,
  displayScale = 1,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value?: number;
  displayScale?: number;
  unit: string;
  onChange: (value?: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(
    value === undefined ? "" : String(value * displayScale),
  );
  const parsed = draft.trim() === "" ? undefined : Number(draft);
  const invalid =
    parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(value === undefined ? "" : String(value * displayScale));
    }
  }, [displayScale, value]);

  return (
    <label className="atlas-field metric-number-field" htmlFor={id}>
      <span>{label}</span>
      <span className="metric-number-field__control">
        <input
          ref={inputRef}
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={draft}
          placeholder="Any"
          aria-invalid={invalid}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (!next.trim()) onChange(undefined);
            else {
              const number = Number(next);
              const normalized = normalizeMetricFilterValue(
                number,
                displayScale,
              );
              onChange(normalized);
            }
          }}
          onBlur={() =>
            setDraft(value === undefined ? "" : String(value * displayScale))
          }
        />
        <small>{unit}</small>
      </span>
      {invalid ? (
        <small className="atlas-fieldset__error" role="alert">
          Enter zero or a positive number.
        </small>
      ) : null}
    </label>
  );
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
  const metricActiveCount =
    Number(filters.hasResponsivity) +
    Number(filters.hasEqe) +
    Number(filters.hasTemporal) +
    Number(filters.hasRiseTime) +
    Number(filters.hasFallTime) +
    Number(filters.hasBandwidth) +
    Number(filters.hasLdr) +
    Number(filters.extendedReview !== "all") +
    Number(filters.ambiguousExtraction) +
    Number(filters.responsivityMin !== undefined) +
    Number(filters.eqeMin !== undefined) +
    Number(filters.responseTimeMaxS !== undefined) +
    Number(filters.riseTimeMaxS !== undefined) +
    Number(filters.fallTimeMaxS !== undefined) +
    Number(filters.bandwidthMinHz !== undefined) +
    Number(filters.ldrMinDb !== undefined);
  const [advancedOpenOverride, setAdvancedOpen] = useState<boolean | null>(
    null,
  );
  const [metricOpenOverride, setMetricOpen] = useState<boolean | null>(null);
  const advancedOpen = advancedOpenOverride ?? advancedActiveCount > 0;
  const metricOpen = metricOpenOverride ?? metricActiveCount > 0;
  const invalidRange =
    filters.wavelengthMin !== undefined &&
    filters.wavelengthMax !== undefined &&
    filters.wavelengthMin > filters.wavelengthMax;
  const update = <Key extends keyof AtlasFilterState>(
    key: Key,
    value: AtlasFilterState[Key],
    historyMode: AtlasHistoryMode = "push",
  ) => onChange({ ...filters, [key]: value }, historyMode);
  const updateWavelength = (
    min?: number,
    max?: number,
    historyMode: AtlasHistoryMode = "push",
  ) =>
    onChange(
      { ...filters, wavelengthMin: min, wavelengthMax: max },
      historyMode,
    );

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
      label: `D* λ: ${filters.wavelengthMin ?? "Any"}–${filters.wavelengthMax ?? "Any"} nm`,
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
      label: `D* ${TEMPERATURE_LABELS[filters.temperature]}`,
      clear: () => update("temperature", "all"),
    });
  }
  if (filters.bias !== "all") {
    chips.push({
      label: `D* ${BIAS_LABELS[filters.bias]}`,
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
  const metricChips: Array<{
    active: boolean;
    label: string;
    clear: () => void;
  }> = [
    {
      active: filters.hasResponsivity,
      label: "Responsivity reported",
      clear: () => update("hasResponsivity", false),
    },
    {
      active: filters.hasEqe,
      label: "EQE reported",
      clear: () => update("hasEqe", false),
    },
    {
      active: filters.hasTemporal,
      label: "Any temporal result",
      clear: () => update("hasTemporal", false),
    },
    {
      active: filters.hasRiseTime,
      label: "Rise time reported",
      clear: () => update("hasRiseTime", false),
    },
    {
      active: filters.hasFallTime,
      label: "Fall time reported",
      clear: () => update("hasFallTime", false),
    },
    {
      active: filters.hasBandwidth,
      label: "−3 dB bandwidth reported",
      clear: () => update("hasBandwidth", false),
    },
    {
      active: filters.hasLdr,
      label: "LDR reported",
      clear: () => update("hasLdr", false),
    },
    {
      active: filters.ambiguousExtraction,
      label: "Ambiguous extraction",
      clear: () => update("ambiguousExtraction", false),
    },
  ];
  for (const chip of metricChips) if (chip.active) chips.push(chip);
  if (filters.extendedReview !== "all") {
    chips.push({
      label:
        filters.extendedReview === "checked"
          ? "Extended metrics checked"
          : "Source unavailable",
      clear: () => update("extendedReview", "all"),
    });
  }
  const numericChips: Array<{
    value?: number;
    label: (value: number) => string;
    clear: () => void;
  }> = [
    {
      value: filters.responsivityMin,
      label: (value) => `Responsivity ≥ ${value} A W⁻¹`,
      clear: () => update("responsivityMin", undefined),
    },
    {
      value: filters.eqeMin,
      label: (value) => `EQE ≥ ${value}%`,
      clear: () => update("eqeMin", undefined),
    },
    {
      value: filters.responseTimeMaxS,
      label: (value) => `Response ≤ ${value * 1e6} µs`,
      clear: () => update("responseTimeMaxS", undefined),
    },
    {
      value: filters.riseTimeMaxS,
      label: (value) => `Rise ≤ ${value * 1e6} µs`,
      clear: () => update("riseTimeMaxS", undefined),
    },
    {
      value: filters.fallTimeMaxS,
      label: (value) => `Fall ≤ ${value * 1e6} µs`,
      clear: () => update("fallTimeMaxS", undefined),
    },
    {
      value: filters.bandwidthMinHz,
      label: (value) => `Bandwidth ≥ ${value / 1e3} kHz`,
      clear: () => update("bandwidthMinHz", undefined),
    },
    {
      value: filters.ldrMinDb,
      label: (value) => `LDR ≥ ${value} dB`,
      clear: () => update("ldrMinDb", undefined),
    },
  ];
  for (const chip of numericChips) {
    if (chip.value !== undefined) {
      chips.push({ label: chip.label(chip.value), clear: chip.clear });
    }
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
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            {advancedOpen ? "Hide" : "More"} filters
            {advancedActiveCount ? ` (${advancedActiveCount})` : ""}
          </button>
          <button
            className="atlas-filters__advanced-toggle"
            type="button"
            aria-expanded={metricOpen}
            aria-controls={`${id}-metric-filters`}
            onClick={() => setMetricOpen(!metricOpen)}
          >
            {metricOpen ? "Hide" : "Metric"} filters
            {metricActiveCount ? ` (${metricActiveCount})` : ""}
          </button>
          <button
            className="atlas-filters__reset"
            type="button"
            onClick={() => {
              onReset();
              setAdvancedOpen(false);
              setMetricOpen(false);
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
            onChange={(event) =>
              update("search", event.target.value, "replace")
            }
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
          <legend>D* wavelength (nm)</legend>
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
                update(
                  "wavelengthMin",
                  optionalNumber(event.target.value),
                  "replace",
                )
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
                update(
                  "wavelengthMax",
                  optionalNumber(event.target.value),
                  "replace",
                )
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
          <span>D* spectral band</span>
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
            <span>D* temperature</span>
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
            <span>D* bias condition</span>
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

      {metricOpen ? (
        <section
          className="atlas-filters__metrics"
          id={`${id}-metric-filters`}
          aria-labelledby={`${id}-metric-filters-title`}
        >
          <div className="atlas-filters__metrics-heading">
            <div>
              <h3 id={`${id}-metric-filters-title`}>Metric filters</h3>
              <p>
                Require reported values or set scientific thresholds. Missing
                values never count as zero. Wavelength, temperature, and bias
                controls above apply to the D* row; metric-specific conditions
                remain visible in hover and table details.
              </p>
            </div>
            {metricActiveCount ? (
              <button
                type="button"
                onClick={() => onChange(clearMetricFilters(filters))}
              >
                Clear metric filters
              </button>
            ) : null}
          </div>

          <fieldset className="metric-availability-filters">
            <legend>Value availability</legend>
            <div>
              {[
                ["hasResponsivity", "Responsivity"],
                ["hasEqe", "EQE"],
                ["hasTemporal", "Any temporal result"],
                ["hasRiseTime", "Rise time"],
                ["hasFallTime", "Fall time"],
                ["hasBandwidth", "Explicit −3 dB bandwidth"],
                ["hasLdr", "LDR"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(filters[key as keyof AtlasFilterState])}
                    onChange={(event) =>
                      update(
                        key as keyof AtlasFilterState,
                        event.target.checked as never,
                      )
                    }
                  />
                  <span>{label} reported</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="metric-review-filters">
            <label className="atlas-field" htmlFor={`${id}-extended-review`}>
              <span>Source-review status</span>
              <select
                id={`${id}-extended-review`}
                value={filters.extendedReview}
                onChange={(event) =>
                  update(
                    "extendedReview",
                    event.target.value as AtlasFilterState["extendedReview"],
                  )
                }
              >
                <option value="all">All review states</option>
                <option value="checked">Extended metrics checked</option>
                <option value="source_unavailable">Source unavailable</option>
              </select>
            </label>
            <label className="metric-review-filters__check">
              <input
                type="checkbox"
                checked={filters.ambiguousExtraction}
                onChange={(event) =>
                  update("ambiguousExtraction", event.target.checked)
                }
              />
              <span>Ambiguous extraction present</span>
            </label>
          </div>

          <fieldset className="metric-threshold-filters">
            <legend>Thresholds</legend>
            <div>
              <MetricNumberField
                id={`${id}-responsivity-min`}
                label="Minimum responsivity"
                value={filters.responsivityMin}
                unit="A W⁻¹"
                onChange={(value) =>
                  update("responsivityMin", value, "replace")
                }
              />
              <MetricNumberField
                id={`${id}-eqe-min`}
                label="Minimum EQE"
                value={filters.eqeMin}
                unit="%"
                onChange={(value) => update("eqeMin", value, "replace")}
              />
              <MetricNumberField
                id={`${id}-response-max`}
                label="Maximum response time"
                value={filters.responseTimeMaxS}
                displayScale={1e6}
                unit="µs"
                onChange={(value) =>
                  update("responseTimeMaxS", value, "replace")
                }
              />
              <MetricNumberField
                id={`${id}-rise-max`}
                label="Maximum rise time"
                value={filters.riseTimeMaxS}
                displayScale={1e6}
                unit="µs"
                onChange={(value) => update("riseTimeMaxS", value, "replace")}
              />
              <MetricNumberField
                id={`${id}-fall-max`}
                label="Maximum fall time"
                value={filters.fallTimeMaxS}
                displayScale={1e6}
                unit="µs"
                onChange={(value) => update("fallTimeMaxS", value, "replace")}
              />
              <MetricNumberField
                id={`${id}-bandwidth-min`}
                label="Minimum −3 dB bandwidth"
                value={filters.bandwidthMinHz}
                displayScale={1e-3}
                unit="kHz"
                onChange={(value) => update("bandwidthMinHz", value, "replace")}
              />
              <MetricNumberField
                id={`${id}-ldr-min`}
                label="Minimum LDR"
                value={filters.ldrMinDb}
                unit="dB"
                onChange={(value) => update("ldrMinDb", value, "replace")}
              />
            </div>
          </fieldset>
        </section>
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
