"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface SearchContextValue {
  /** The current header search query (trimmed lookups are up to consumers). */
  query: string;
  setQuery: (value: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

/**
 * Read the shared header search query. Returns a no-op default when used
 * outside a provider (e.g. the standalone full-page components that render
 * their own chrome), so those keep working without a header search.
 */
export function useSearch(): SearchContextValue {
  return useContext(SearchContext) ?? { query: "", setQuery: () => {} };
}

/**
 * Convenience: does `haystack` contain the (trimmed, lower-cased) query?
 * Empty queries match everything.
 */
export function matchesQuery(query: string, ...fields: Array<string | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}
