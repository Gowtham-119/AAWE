import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./utils.js";

function getPages(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("...");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push("...");

  pages.push(totalPages);
  return pages;
}

function MUIPagination({ count = 1, page = 1, onChange, className, ...props }) {
  const totalPages = Math.max(1, Number(count) || 1);
  const currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const pages = getPages(totalPages, currentPage);

  const emitPage = (nextPage) => {
    if (!onChange || nextPage < 1 || nextPage > totalPages || nextPage === currentPage) {
      return;
    }
    onChange(null, nextPage);
  };

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)} aria-label="pagination" {...props}>
      <button
        type="button"
        onClick={() => emitPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((item, idx) => {
        if (item === "...") {
          return (
            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-gray-500">
              ...
            </span>
          );
        }

        const pageNumber = item;
        const active = pageNumber === currentPage;

        return (
          <button
            key={pageNumber}
            type="button"
            onClick={() => emitPage(pageNumber)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm",
              active
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            )}
          >
            {pageNumber}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => emitPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

export { MUIPagination };
