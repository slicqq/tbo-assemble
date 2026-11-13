"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Coins,
  Lightbulb,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import {
  optimizeInventory,
  type InventoryOption,
} from "@/lib/inventory-optimizer";

type Props = {
  options: InventoryOption[];
  initialDemand: number;
  defaultBudget: number;
  eventName: string;
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

export function InventoryOptimizer({ options, initialDemand, defaultBudget, eventName }: Props) {
  const [budget, setBudget] = useState(defaultBudget);
  const [roomDemand, setRoomDemand] = useState(initialDemand);
  const [sellMarkupPct, setSellMarkupPct] = useState(25);
  const [cancellationPct, setCancellationPct] = useState(10);
  const [marketSignalPct, setMarketSignalPct] = useState(10);

  const recommendations = useMemo(
    () => optimizeInventory(options, { budget, roomDemand, sellMarkupPct, cancellationPct, marketSignalPct }),
    [options, budget, roomDemand, sellMarkupPct, cancellationPct, marketSignalPct],
  );
  const totals = useMemo(() => recommendations.reduce((sum, row) => ({
    buyQty: sum.buyQty + row.buyQty,
    budgetUsed: sum.budgetUsed + row.budgetUsed,
    expectedRevenue: sum.expectedRevenue + row.expectedRevenue,
    expectedProfit: sum.expectedProfit + row.expectedProfit,
    unsoldExposure: sum.unsoldExposure + row.unsoldExposure,
  }), { buyQty: 0, budgetUsed: 0, expectedRevenue: 0, expectedProfit: 0, unsoldExposure: 0 }), [recommendations]);
  const budgetLeft = Math.max(0, budget - totals.budgetUsed);
  const returnPct = totals.budgetUsed > 0 ? Math.round((totals.expectedProfit / totals.budgetUsed) * 100) : 0;
  const recommendationsWithBuy = recommendations.filter((row) => row.buyQty > 0);

  return (
    <section className="mt-8 space-y-4" aria-labelledby="optimizer-heading">
      <Card className="overflow-hidden border-blue-200/70 dark:border-blue-900/70">
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-white/10 p-2.5"><Sparkles className="size-5" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="optimizer-heading" className="text-lg font-semibold">Inventory investment planner</h2>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-100">Decision support</span>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-blue-100/85">
                  Allocate a pre-buy budget across {eventName} room blocks using demand, booking, margin and cancellation-risk assumptions.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-white/25 bg-white/10 text-white">Scenario model</Badge>
          </div>
        </div>
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4 text-blue-600" /> Planning assumptions</div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Procurement budget (₹)</span>
                <input aria-label="Procurement budget in rupees" className={inputClass} type="number" min="0" step="10000" value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Forecast room demand (rooms)</span>
                <input aria-label="Forecast room demand" className={inputClass} type="number" min="0" step="1" value={roomDemand} onChange={(e) => setRoomDemand(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Target selling uplift (%)</span>
                  <input className={inputClass} type="number" min="0" max="200" value={sellMarkupPct} onChange={(e) => setSellMarkupPct(Math.max(0, Number(e.target.value) || 0))} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Cancellation allowance (%)</span>
                  <input className={inputClass} type="number" min="0" max="100" value={cancellationPct} onChange={(e) => setCancellationPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Search / seasonality signal uplift</span><span className="tabular-nums">+{marketSignalPct}%</span>
                </span>
                <input aria-label="Search and seasonality signal uplift" className="w-full accent-blue-600" type="range" min="0" max="60" step="5" value={marketSignalPct} onChange={(e) => setMarketSignalPct(Number(e.target.value))} />
                <span className="block text-[11px] leading-relaxed text-muted-foreground">Manual scenario input. Live search trends and external market feeds are not connected yet.</span>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" onClick={() => { setBudget(defaultBudget); setRoomDemand(initialDemand); setSellMarkupPct(25); setCancellationPct(10); setMarketSignalPct(10); }}>Reset scenario</Button>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><BarChart3 className="size-3.5" /> Recalculates instantly</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-blue-600" /> Recommended investment outcome</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric icon={<Coins className="size-4" />} label="Budget allocated" value={formatCurrency(totals.budgetUsed)} detail={`${formatCurrency(budgetLeft)} unallocated`} />
                <Metric icon={<ArrowUpRight className="size-4" />} label="Expected net profit" value={formatCurrency(totals.expectedProfit)} detail={`${returnPct}% risk-adjusted return`} positive={totals.expectedProfit > 0} />
                <Metric icon={<CheckCircle2 className="size-4" />} label="Additional rooms to buy" value={totals.buyQty.toLocaleString()} detail={`of ${roomDemand} forecast rooms`} />
                <Metric icon={<ShieldCheck className="size-4" />} label="Downside exposure" value={formatCurrency(totals.unsoldExposure)} detail={`${cancellationPct}% cancellation allowance`} warning={totals.unsoldExposure > 0} />
              </div>
              <div className="rounded-xl border bg-muted/35 p-4">
                {totals.buyQty > 0 ? (
                  <>
                    <p className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-amber-500" /> Action recommendation</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Prioritize {recommendationsWithBuy.slice(0, 2).map((row) => `${row.buyQty} ${row.roomType} at ${row.supplier}`).join(" and ")}. The model ranks each buy by forecast demand, margin and cancellation-adjusted return, then stops at the budget or demand limit.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-500" /> No additional buy recommended</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Current blocks cover the forecast, the budget is too small for another unit, or the assumed risk-adjusted margin is not positive. Adjust the scenario inputs to compare alternatives.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/35 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Supplier and room-type allocation</p>
                <p className="text-xs text-muted-foreground">Purchase quantities respect forecast demand and budget constraints.</p>
              </div>
              <span className="text-xs text-muted-foreground">Expected sales: {formatCurrency(totals.expectedRevenue)}</span>
            </div>
            {recommendations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Room block / supplier</th>
                      <th className="px-4 py-3 text-right font-medium">Demand target</th>
                      <th className="px-4 py-3 text-right font-medium">Current block</th>
                      <th className="px-4 py-3 text-right font-medium">Buy</th>
                      <th className="px-4 py-3 text-right font-medium">Buy rate</th>
                      <th className="px-4 py-3 text-right font-medium">Sell target</th>
                      <th className="px-4 py-3 text-right font-medium">Expected profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recommendations.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.roomType}</p>
                          <p className="text-xs text-muted-foreground">{row.supplier} · {row.booked} booked</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.demandTarget}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.currentBlock}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-xs font-semibold ${row.buyQty > 0 ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "bg-muted text-muted-foreground"}`}>{row.buyQty}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.buyRate)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.sellRate)}</td>
                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${row.expectedProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(row.expectedProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Add room blocks to this event to calculate a supplier allocation.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Assumption icon={<BarChart3 className="size-4" />} title="Demand forecast" text="Starts with expected attendees / 2.2, checked against current bookings and guest records. Edit the room forecast above." />
            <Assumption icon={<ShieldCheck className="size-4" />} title="Risk controls" text="Cancellation allowance reduces expected sell-through. Buys are capped by the remaining forecast demand and available budget." />
            <Assumption icon={<ArrowDownRight className="size-4" />} title="Model boundary" text="Search, seasonality and competitor data are not wired to external feeds. The uplift is a transparent manual what-if input." />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ icon, label, value, detail, positive, warning }: {
  icon: React.ReactNode; label: string; value: string; detail: string; positive?: boolean; warning?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span><span className={warning ? "text-amber-600" : positive ? "text-emerald-600" : "text-blue-600"}>{icon}</span></div>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function Assumption({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-muted/35 p-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{text}</p></div>
    </div>
  );
}
