import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/client/components/ui/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/Select";

function pageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: Array<number | "ellipsis"> = [];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  items.push(1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);

  return items;
}

type PaginationSectionProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  showingLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  withPerPage?: boolean;
  className?: string;
  isLoading?: boolean;
};

export function PaginationSection({
  page,
  totalPages,
  pageSize,
  showingLabel,
  onPageChange,
  onPageSizeChange,
  withPerPage,
  className,
  isLoading,
}: PaginationSectionProps) {
  if (totalPages <= 1) return null;

  const busy = Boolean(isLoading);

  return (
    <div className={["w-full py-2", className ?? ""].join(" ")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden w-[180px] shrink-0 lg:block" />
        <div className="flex min-w-0 flex-1 justify-center">
          <Pagination className="w-full">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={busy || page <= 1}
                  onClick={() => (busy ? null : onPageChange(Math.max(1, page - 1)))}
                  className="border border-white/10 bg-white/5 text-white/85! hover:border-white/25 hover:bg-white/[0.14] hover:text-white! disabled:opacity-40 disabled:hover:bg-white/5"
                />
              </PaginationItem>

              {pageItems(page, totalPages).map((it, idx) =>
                it === "ellipsis" ? (
                  <PaginationItem key={`e-${idx}`}>
                    <PaginationEllipsis className="text-white/50" />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={it}>
                    <PaginationLink
                      isActive={page === it}
                      disabled={busy}
                      onClick={() => (busy ? null : onPageChange(it))}
                      className={[
                        "border shadow-xs shadow-black/30 transition-[background-color,border-color,box-shadow,transform,filter] duration-150",
                        page === it
                          ? "border-white/40 bg-white !text-black shadow-md shadow-black/55 hover:bg-white hover:border-white/60"
                          : "border-white/10 bg-white/5 !text-white/85 hover:bg-white/[0.14] hover:!text-white hover:border-white/30",
                        "disabled:cursor-not-allowed disabled:opacity-45",
                      ].join(" ")}
                    >
                      {it}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  disabled={busy || page >= totalPages}
                  onClick={() => (busy ? null : onPageChange(Math.min(totalPages, page + 1)))}
                  className="border border-white/10 bg-white/5 text-white/85! hover:border-white/25 hover:bg-white/[0.14] hover:text-white! disabled:opacity-40 disabled:hover:bg-white/5"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
        {withPerPage && onPageSizeChange ? (
          <div className="flex shrink-0 items-center justify-start gap-3 lg:justify-end">
            <div className="text-sm text-white/60">Per page</div>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-10 w-[120px] rounded-lg border-white/10 bg-white/5 text-sm text-white shadow-none hover:bg-white/6 focus-visible:ring-[#E50914]/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="border-white/10 bg-[#0f0f0f] text-white shadow-xl shadow-black/60"
              >
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="40">40</SelectItem>
                <SelectItem value="60">60</SelectItem>
                <SelectItem value="80">80</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="hidden w-[180px] shrink-0 lg:block" />
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm text-white/60">
        {busy ? (
          <span className="inline-flex size-4 animate-spin rounded-full border-2 border-white/15 border-t-[#E50914]" />
        ) : null}
        <span>{showingLabel}</span>
      </div>
    </div>
  );
}
