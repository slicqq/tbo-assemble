import { NextResponse } from "next/server";

// The former unauthenticated reset deleted all records. Disabled in every environment.
export async function POST() {
  return NextResponse.json({ error: "Database reset is disabled. Use an isolated local database for seeding." }, { status: 403 });
}
