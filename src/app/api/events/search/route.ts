import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { summarizeEvent } from "@/lib/dashboard-metrics";

// GET - Search events
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const slug = searchParams.get("slug");

    const where: {
      status?: string;
      type?: string;
      slug?: string;
      OR?: { name?: { contains: string }; venue?: { contains: string }; location?: { contains: string } }[];
    } = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (slug) where.slug = slug;
    if (query) {
      const q = query.trim();
      where.OR = [
        { name: { contains: q } },
        { venue: { contains: q } },
        { location: { contains: q } },
      ];
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        roomBlocks: true,
        guests: { select: { id: true, status: true, name: true } },
        bookings: { select: { id: true, totalAmount: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const results = events.map(summarizeEvent);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search events error:", error);
    return NextResponse.json({ error: "Failed to search events" }, { status: 500 });
  }
}
