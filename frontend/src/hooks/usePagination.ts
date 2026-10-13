import { useState, useEffect } from "react";

export const ITEMS_PER_PAGE = 10;

export interface UsePaginationResult<T> {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageItems: T[];
  totalItems: number;
  itemsPerPage: number;
}

/**
 * Generic pagination hook.
 * Pass `resetKey` (e.g. a search query string or filter value joined as a
 * string) to automatically reset to page 1 when filters change.
 */
export function usePagination<T>(
  items: T[],
  resetKey: string = "",
  itemsPerPage: number = ITEMS_PER_PAGE
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever the data source or any filter changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Guard against currentPage going out of bounds when items are removed.
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const pageItems = items.slice(startIndex, startIndex + itemsPerPage);

  return {
    currentPage: safePage,
    setCurrentPage,
    pageItems,
    totalItems,
    itemsPerPage,
  };
}
