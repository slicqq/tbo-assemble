import type { Metadata } from "next";
import FlightIntelligence from "@/components/flight-intelligence";

export const metadata: Metadata = { title: "Flight Predictions | TBO Assemble" };

export default function DashboardFlightPredictionsPage() {
  return <FlightIntelligence embedded />;
}
