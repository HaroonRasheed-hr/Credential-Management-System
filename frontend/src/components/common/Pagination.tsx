"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Build the page-number sequence with "..." for truncated ranges. */
function buildPageSequence(
  current: number,
  total: number
): (number | "...")[] {
  // No truncation needed for 7 pages or fewer.
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // Collect pages that must always be visible.
  const visible = new Set<number>([
    1,
    total,
    current,
    Math.max(1, current - 1),
    Math.min(total, current + 1),
  ]);

  const sorted = Array.from(visible).sort((a, b) => a - b);
  const result: (number | "...")[] = [];

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
      result.push("...");
    }
  }

  return result;
}

// ── Shared button base classes ─────────────────────────────────────────────────

const BASE =
  "flex h-9 min-w-[36px] items-center justify-center rounded-xl border text-sm font-medium transition-all duration-200 select-none";

const INACTIVE = `${BASE} bg-white/5 border-white/10 text-white/50 hover:border-[#03A9F4] hover:text-white cursor-pointer`;
const DISABLED = `${BASE} bg-white/5 border-white/10 text-white/30 opacity-40 cursor-not-allowed`;
const NAV_ACTIVE = `${BASE} bg-white/5 border-white/10 text-white/50 hover:border-[#03A9F4] hover:text-white cursor-pointer`;

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Render nothing if all items fit on one page.
  if (totalItems <= itemsPerPage) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const pageSequence = buildPageSequence(currentPage, totalPages);

  const isPrevDisabled = currentPage === 1;
  const isNextDisabled = currentPage === totalPages;

  return (
    <div
      className={`mt-6 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between${className ? ` ${className}` : ""}`}
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      {/* ── Results summary ────────────────────────────────────────────── */}
      <span
        className="text-center text-sm sm:text-left"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        Showing {startItem}–{endItem} of {totalItems} results
      </span>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        {/* Previous */}
        <button
          type="button"
          onClick={() => !isPrevDisabled && onPageChange(currentPage - 1)}
          disabled={isPrevDisabled}
          aria-label="Previous page"
          className={`flex-1 sm:flex-none ${isPrevDisabled ? DISABLED : NAV_ACTIVE}`}
        >
          <ChevronLeft size={15} />
          <span className="ml-1 hidden sm:inline">Prev</span>
        </button>

        {/* Page numbers — desktop only */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageSequence.map((item, i) =>
            item === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="flex h-9 w-8 items-center justify-center text-sm"
                style={{ color: "rgba(255,255,255,0.28)" }}
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === currentPage ? "page" : undefined}
                className={
                  item === currentPage
                    ? `${BASE} border-transparent text-white font-bold cursor-default`
                    : INACTIVE
                }
                style={
                  item === currentPage
                    ? {
                        background:
                          "linear-gradient(180deg, #03A9F4 0%, #086FB7 100%)",
                      }
                    : {}
                }
              >
                {item}
              </button>
            )
          )}
        </div>

        {/* Mobile: "Page X of Y" text in place of page buttons */}
        <span
          className="flex items-center px-2 text-sm sm:hidden"
          style={{ color: "rgba(255,255,255,0.50)" }}
        >
          Page {currentPage} of {totalPages}
        </span>

        {/* Next */}
        <button
          type="button"
          onClick={() => !isNextDisabled && onPageChange(currentPage + 1)}
          disabled={isNextDisabled}
          aria-label="Next page"
          className={`flex-1 sm:flex-none ${isNextDisabled ? DISABLED : NAV_ACTIVE}`}
        >
          <span className="mr-1 hidden sm:inline">Next</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
