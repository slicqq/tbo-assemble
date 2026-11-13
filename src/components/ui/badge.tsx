import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

// shadcn/ui badge shape with soft, high-contrast status tones
const variants: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20",
  outline: "text-foreground ring-1 ring-inset ring-border",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
};

function Badge({
  className,
  variant = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  // Raw status values ("active", "draft") read as sentence case
  const content = typeof children === "string" ? children.charAt(0).toUpperCase() + children.slice(1) : children;
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3",
        variants[variant],
        className
      )}
      {...props}
    >
      {content}
    </span>
  );
}

export { Badge };
