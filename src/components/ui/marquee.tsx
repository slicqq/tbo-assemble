import { cn } from "@/lib/utils";

// Magic UI-style marquee: content is duplicated and scrolled; pauses on hover; respects reduced motion
export function Marquee({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("marquee relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]", className)}>
      <div className="marquee-track flex shrink-0 gap-4 pr-4">{children}</div>
      <div className="marquee-track flex shrink-0 gap-4 pr-4" aria-hidden="true">{children}</div>
    </div>
  );
}
