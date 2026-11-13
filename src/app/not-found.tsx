"use client";

import Link from "next/link";
import { Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Illustration } from "@/components/ui/illustration";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-8 w-32">
          <Illustration name="snail" className="rounded-xl" priority />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Room not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Looks like this page checked out early. The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild><Link href="/"><Home /> Go home</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard"><LayoutDashboard /> Dashboard</Link></Button>
        </div>
      </div>
    </div>
  );
}
