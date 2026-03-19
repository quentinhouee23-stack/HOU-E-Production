"use client";

import { useEffect, useState } from "react";

/**
 * Retourne une valeur debounced (retardée) pour limiter les mises à jour (ex: recherche).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
