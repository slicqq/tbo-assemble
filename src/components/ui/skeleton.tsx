import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}

// Event card loading skeleton
function EventCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Skeleton className="h-1.5 w-full rounded-none" />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-8" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Stat card loading skeleton
function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

// Table row skeleton
function TableRowSkeleton() {
  return (
    <div className="flex gap-4 p-3 items-center border-b">
      <div className="w-1/4 flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export { Skeleton, EventCardSkeleton, StatCardSkeleton, TableRowSkeleton };

