import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/client/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

const PaginationContent = React.forwardRef<HTMLOListElement, React.ComponentProps<"ol">>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn("flex flex-row flex-wrap items-center justify-center gap-2", className)}
      {...props}
    />
  ),
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn(className)} {...props} />,
);
PaginationItem.displayName = "PaginationItem";

function PaginationLink({
  className,
  isActive,
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      className={cn("gap-1 pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon className="size-4" />
      <span>Prev</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      className={cn("gap-1 pr-2.5", className)}
      {...props}
    >
      <span>Next</span>
      <ChevronRightIcon className="size-4" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("flex size-9 items-center justify-center text-white/50", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
