'use client';
import { PlugZap } from 'lucide-react';
import type { PlanRow } from '@/lib/procurement-core';
import { supplierPriorities } from '@/lib/supplier-priority';

const units = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const compact = (n: number) => (Math.abs(n) >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e4 ? `₹${(n / 1e5).toFixed(Math.abs(n) >= 1e5 ? 1 : 2)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`);
const ACTION_CLASS: Record<string, string> = {
  'Refresh supplier quote': 'refresh', 'Negotiate more units': 'negotiate', 'Extend allotment': 'negotiate', 'Connect free-sale / API supply': 'connect', 'Top up with free-sale': 'topup',
};

/** Ranks products by the booking value of demand the plan leaves unserved, with the supplier action that would serve it. */
export default function SupplierPriorities({ rows, budget }: { rows: PlanRow[]; budget: number }) {
  const list = supplierPriorities(rows, { budget });
  const total = list.reduce((sum, p) => sum + p.unmetValue, 0);
  const counts = list.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.action]: (acc[p.action] ?? 0) + 1 }), {});
  return (
    <section className="panel supplier-panel" aria-labelledby="supplier-title">
      <div className="coverage-head">
        <div className="control-icon"><PlugZap size={18} /></div>
        <div>
          <h2 id="supplier-title">Supplier-integration priorities</h2>
          <p>Where the plan leaves demand unserved, ranked by booking value, with the supplier step that would serve it: connect free-sale or API supply, extend an allotment, negotiate more units or refresh a quote.</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="coverage-intro">Existing stock and the plan cover modelled demand for every product. Keep monitoring supplier quotes.</p>
      ) : (
        <>
          <p className="supplier-summary">
            <strong>{compact(total)}</strong> of modelled booking value stays unserved across {list.length} product{list.length === 1 ? '' : 's'}.{' '}
            {Object.entries(counts).map(([action, n], i) => <span key={action}>{i > 0 ? ' · ' : ''}{action}: {n}</span>)}
          </p>
          <div className="coverage-table-wrap">
            <table>
              <thead><tr><th>#</th><th>Opportunity</th><th>Unserved · expected</th><th>Strong season (P90)</th><th>Booking value unserved</th><th>Committed / offered</th><th>Next supplier step</th></tr></thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id}>
                    <td>{p.rank}</td>
                    <td><strong>{p.name}</strong><small>{p.destination} · {p.period} · {p.kind === 'Hotel' ? 'room-nights' : 'seats'}</small></td>
                    <td>{units(p.unmet)}</td>
                    <td>{units(p.highUnmet)}</td>
                    <td>{compact(p.unmetValue)}</td>
                    <td>{units(p.committed)} / {units(p.capacity)}</td>
                    <td className="supplier-step"><span className={`supplier-action ${ACTION_CLASS[p.action] ?? ''}`}>{p.action}</span><small>{p.reason}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="coverage-foot"><strong>How to read it:</strong> booking value = expected unserved units × selling price (gross bookings, not margin). Free-sale and on-request supply put no capital at risk but carry lower margins and no availability guarantee. Demand is modelled, not confirmed; size new connections to the strong-season figure.</p>
    </section>
  );
}
