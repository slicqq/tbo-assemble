import Link from "next/link";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { ActivityLog } from "@/components/dashboard/activity-log";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true },
  });

  if (!event) return notFound();

  return (
    <div>
      <Link
        href={`/dashboard/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-zinc-100 transition-colors mb-4 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to {event.name}
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            Activity Log
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track all actions and changes for {event.name}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <ActivityLog eventId={eventId} />
      </div>
    </div>
  );
}
