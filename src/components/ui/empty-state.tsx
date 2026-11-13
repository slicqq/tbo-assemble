import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Illustration, type IllustrationName } from "@/components/ui/illustration";

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Optional spot illustration instead of the icon. */
  illustration?: IllustrationName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

// Modelled on shadcn/ui <Empty />
export function EmptyState({ icon: Icon, illustration, title, description, action, className, iconClassName }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      {illustration ? (
        <Illustration name={illustration} className={cn("w-24 rounded-xl", iconClassName)} />
      ) : Icon ? (
        <div className={cn("flex size-10 items-center justify-center rounded-lg bg-muted text-foreground", iconClassName)}>
          <Icon className="size-5" />
        </div>
      ) : null}
      <div className="flex max-w-sm flex-col items-center gap-1.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}
