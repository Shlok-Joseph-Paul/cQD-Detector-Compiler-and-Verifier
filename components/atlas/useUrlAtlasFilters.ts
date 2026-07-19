"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_ATLAS_FILTERS,
  lockMaterialFilter,
  parseAtlasFilters,
  serializeAtlasFilters,
} from "@/lib/atlas/filters";
import type { AtlasFilterState } from "@/lib/atlas/types";

function readFilters(
  base: AtlasFilterState,
  lockedMaterial?: string,
): AtlasFilterState {
  if (typeof window === "undefined") {
    return lockMaterialFilter(base, lockedMaterial);
  }
  const current = new URLSearchParams(window.location.search);
  const merged = serializeAtlasFilters(base);
  current.forEach((value, key) => merged.set(key, value));
  return lockMaterialFilter(parseAtlasFilters(merged), lockedMaterial);
}

function writeFilters(filters: AtlasFilterState): void {
  const current = new URLSearchParams(window.location.search);
  const params = serializeAtlasFilters(filters, current);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
}

/** URL-backed filter state without imposing Next.js router/Suspense requirements. */
export function useUrlAtlasFilters(
  initial?: Partial<AtlasFilterState>,
  lockedMaterial?: string,
): {
  filters: AtlasFilterState;
  setFilters: (filters: AtlasFilterState) => void;
  resetFilters: () => void;
} {
  const [base] = useState<AtlasFilterState>(() => ({
    ...DEFAULT_ATLAS_FILTERS,
    ...initial,
  }));
  const [filters, setFilterState] = useState<AtlasFilterState>(base);

  useEffect(() => {
    const updateFromLocation = () => {
      const next = readFilters(base, lockedMaterial);
      setFilterState(next);
      const urlMaterial = new URLSearchParams(window.location.search).get(
        "material",
      );
      if (lockedMaterial && urlMaterial && urlMaterial !== lockedMaterial) {
        writeFilters(next);
      }
    };
    updateFromLocation();
    window.addEventListener("popstate", updateFromLocation);
    return () => window.removeEventListener("popstate", updateFromLocation);
  }, [base, lockedMaterial]);

  const setFilters = useCallback(
    (next: AtlasFilterState) => {
      const constrained = lockMaterialFilter(next, lockedMaterial);
      setFilterState(constrained);
      writeFilters(constrained);
    },
    [lockedMaterial],
  );

  const resetFilters = useCallback(() => {
    const constrained = lockMaterialFilter(base, lockedMaterial);
    setFilterState(constrained);
    writeFilters(constrained);
  }, [base, lockedMaterial]);

  return { filters, setFilters, resetFilters };
}
