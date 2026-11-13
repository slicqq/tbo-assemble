import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// shadcn/ui native select: real <select> for accessibility, styled like Input
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative inline-flex">
      <select
        ref={ref}
        data-slot="native-select"
        className={cn(
          "h-9 w-full appearance-none rounded-full border border-input bg-background py-1 pr-9 pl-4 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  )
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
