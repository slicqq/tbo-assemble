import type { Metadata } from 'next';
import HotelDemand from '@/components/dashboard/hotel-demand';
export const metadata: Metadata = { title: 'Hotel Demand | TBO Assemble' };
export default function HotelDemandPage() { return <HotelDemand />; }
