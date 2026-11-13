import type { Metadata } from 'next';
import CancellationRisk from '@/components/dashboard/cancellation-risk';

export const metadata: Metadata = { title: 'Cancellation & Unsold Risk | TBO Assemble' };
export default function CancellationRiskPage() { return <CancellationRisk />; }
