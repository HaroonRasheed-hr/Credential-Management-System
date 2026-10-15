import { useState } from "react";

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
  const [pageState, setPageState] = useState({ page: 1, key: resetKey });
  const currentPage = pageState.key === resetKey ? pageState.page : 1;
  const setCurrentPage = (page: number) => {
    setPageState({ page, key: resetKey });
  };

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
