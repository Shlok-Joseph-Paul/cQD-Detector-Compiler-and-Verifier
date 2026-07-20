"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_ATLAS_FILTERS,
  lockMaterialFilter,
  parseAtlasFilters,
  resetAtlasFilterCriteria,
  serializeAtlasFilters,
} from "@/lib/atlas/filters";
import type { AtlasFilterState, AtlasHistoryMode } from "@/lib/atlas/types";

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

function writeFilters(
  filters: AtlasFilterState,
  historyMode: AtlasHistoryMode = "push",
): void {
  const current = new URLSearchParams(window.location.search);
  const params = serializeAtlasFilters(filters, current);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (url === currentUrl) return;
  const method = historyMode === "replace" ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", url);
}

/** URL-backed filter state without imposing Next.js router/Suspense requirements. */
export function useUrlAtlasFilters(
  initial?: Partial<AtlasFilterState>,
  lockedMaterial?: string,
): {
  filters: AtlasFilterState;
  setFilters: (
    filters: AtlasFilterState,
    historyMode?: AtlasHistoryMode,
  ) => void;
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
        writeFilters(next, "replace");
      }
    };
    updateFromLocation();
    window.addEventListener("popstate", updateFromLocation);
    return () => window.removeEventListener("popstate", updateFromLocation);
  }, [base, lockedMaterial]);

  const setFilters = useCallback(
    (next: AtlasFilterState, historyMode: AtlasHistoryMode = "push") => {
      const constrained = lockMaterialFilter(next, lockedMaterial);
      setFilterState(constrained);
      writeFilters(constrained, historyMode);
    },
    [lockedMaterial],
  );

  const resetFilters = useCallback(() => {
    const constrained = lockMaterialFilter(
      resetAtlasFilterCriteria(filters, base),
      lockedMaterial,
    );
    setFilterState(constrained);
    writeFilters(constrained);
  }, [base, filters, lockedMaterial]);

  return { filters, setFilters, resetFilters };
}
