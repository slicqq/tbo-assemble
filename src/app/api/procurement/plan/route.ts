import { NextResponse } from 'next/server';
import type { DemandHistoryPoint } from '@/lib/learned-demand';
import { columns, optionalColumns, readInventoryCSV } from '@/lib/inventory-csv';
import { optimizePortfolio } from '@/lib/portfolio-optimizer';
import { checkModelRisk } from '@/lib/model-risk';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try {
  if(Number(request.headers.get('content-length')||0)>200000)return NextResponse.json({error:'Request is too large.'},{status:413});
  const text=await request.text();if(text.length>200000)return NextResponse.json({error:'Request is too large.'},{status:413});
  const body=JSON.parse(text);const {items,budget,risk,asOf,engine:requestedEngine,serviceTarget,jointPricing,modelRisk,budgetBasis}=body;
  if(requestedEngine!==undefined&&requestedEngine!=='scenario-grid-v4'&&requestedEngine!=='risk-cvar-v5')return NextResponse.json({error:'engine must be scenario-grid-v4 or risk-cvar-v5.'},{status:400});
  const engine:'scenario-grid-v4'|'risk-cvar-v5'=requestedEngine??'scenario-grid-v4';
  if(serviceTarget!==undefined&&(typeof serviceTarget!=='number'||!Number.isFinite(serviceTarget)||serviceTarget<0||serviceTarget>.99))return NextResponse.json({error:'serviceTarget must be a number from 0 to 0.99.'},{status:400});
  if(jointPricing!==undefined&&typeof jointPricing!=='boolean')return NextResponse.json({error:'jointPricing must be true or false.'},{status:400});
  if(modelRisk!==undefined&&typeof modelRisk!=='boolean')return NextResponse.json({error:'modelRisk must be true or false.'},{status:400});
  if(budgetBasis!==undefined&&budgetBasis!=='cash'&&budgetBasis!=='capital-at-risk')return NextResponse.json({error:'budgetBasis must be cash or capital-at-risk.'},{status:400});
  if(engine!=='risk-cvar-v5'&&((serviceTarget??0)>0||jointPricing!==undefined||modelRisk||budgetBasis!==undefined))return NextResponse.json({error:'serviceTarget, jointPricing, modelRisk and budgetBasis need engine risk-cvar-v5.'},{status:400});
  if(!Array.isArray(items)||items.length<1||items.length>20||typeof budget!=='number'||!Number.isFinite(budget)||budget<0||budget>1e9||typeof risk!=='number'||!Number.isFinite(risk)||risk<0||risk>.8)return NextResponse.json({error:'Provide 1–20 items, a budget between 0 and 1 billion, and risk between 0 and 0.8.'},{status:400});
  if(typeof asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf+'T00:00:00Z'))||new Date(asOf+'T00:00:00Z').toISOString().slice(0,10)!==asOf)return NextResponse.json({error:'asOf must be a valid YYYY-MM-DD date.'},{status:400});
  const keys=[...columns,...optionalColumns];
  const lines=items.map((item:unknown)=>{if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Each item must be an object.');return keys.map(key=>{const v=(item as Record<string,unknown>)[key];if(v!==undefined&&v!==null&&typeof v!=='string'&&typeof v!=='number')throw new Error(`Invalid ${key}.`);return `"${String(v??'').replaceAll('"','""')}"`;}).join(',')});
  const inventory=readInventoryCSV([keys.join(','),...lines].join('\n'));for(let i=0;i<inventory.length;i++){const weight=items[i].bookingWeight;if(weight!==undefined&&weight!==null){if(typeof weight!=='number'||!Number.isFinite(weight)||weight<0||weight>1)throw new Error('bookingWeight must be a number between 0 and 1.');inventory[i].bookingWeight=weight;}const extras=readLearningInputs(items[i],i);if(extras.priceElasticity!==undefined)inventory[i].priceElasticity=extras.priceElasticity;if(extras.history)inventory[i].history=extras.history;}const optimization=optimizePortfolio(inventory,budget,risk,{asOf,engine,serviceTarget,jointPricing,budgetBasis});const robustness=modelRisk?checkModelRisk(inventory,budget,risk,{asOf,jointPricing,budgetBasis,planRows:optimization.rows}):undefined;const plan=optimization.rows;const riskSummary=optimization.risk;
  return NextResponse.json({asOf,budget,risk,summary:{spend:plan.reduce((s,r)=>s+r.spend,0),expectedProfit:plan.reduce((s,r)=>s+r.expectedProfit,0),lowProfit:plan.reduce((s,r)=>s+r.downsideProfit,0),units:plan.reduce((s,r)=>s+r.qty,0),...(riskSummary?{cvar10:riskSummary.cvar,lossProbability:riskSummary.pLoss,demandServedShare:riskSummary.servedShare,demandServedShareBefore:riskSummary.servedShareBefore,prepaidUnits:riskSummary.prepaidUnits,allotmentUnits:riskSummary.allotmentUnits}:{})},recommendations:plan,optimization:{objective:optimization.objective,upperBound:optimization.upperBound,gap:optimization.gap,baselineObjective:optimization.baselineObjective,algorithm:optimization.algorithm,bucketCount:optimization.bucketCount,engine,...(riskSummary?{risk:riskSummary}:{}),...(optimization.service?{service:optimization.service,pricing:optimization.pricing}:{})},...(robustness?{modelRisk:robustness}:{}),model:inventory.some(o=>o.bookingWeight!==undefined)?`${engine}-experimental-blend`:engine}, {headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request.'},{status:400,headers:{'Cache-Control':'no-store'}})}
}

/**
 * Optional per-item inputs for the risk-cvar-v5 learned demand model (src/lib/learned-demand.ts), passed through
 * alongside the CSV columns: a supplied price elasticity and a monthly history (≤ 120 months).
 */
function readLearningInputs(item: Record<string, unknown>, index: number): { priceElasticity?: number; history?: DemandHistoryPoint[] } {
  const out: { priceElasticity?: number; history?: DemandHistoryPoint[] } = {};
  const e = item.priceElasticity;
  if (e !== undefined && e !== null) {
    if (typeof e !== 'number' || !Number.isFinite(e) || e >= 0 || e < -20) throw new Error(`Item ${index + 1}: priceElasticity must be a negative number from -20 to 0.`);
    out.priceElasticity = e;
  }
  const h = item.history;
  if (h !== undefined && h !== null) {
    if (!Array.isArray(h) || h.length > 120) throw new Error(`Item ${index + 1}: history must be an array of at most 120 monthly rows.`);
    const optional = ['searches', 'soldOutSearches', 'signal', 'price'] as const;
    out.history = h.map((row: unknown, r: number) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Item ${index + 1}, history row ${r + 1}: must be an object.`);
      const v = row as Record<string, unknown>;
      if (typeof v.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.month)) throw new Error(`Item ${index + 1}, history row ${r + 1}: month must be YYYY-MM.`);
      if (typeof v.bookings !== 'number' || !Number.isFinite(v.bookings) || v.bookings < 0 || v.bookings > 1e7) throw new Error(`Item ${index + 1}, history row ${r + 1}: bookings must be a number from 0 to 10,000,000.`);
      const point: DemandHistoryPoint = { month: v.month, bookings: v.bookings };
      for (const key of optional) {
        const x = v[key];
        if (x === undefined || x === null) continue;
        if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 1e9) throw new Error(`Item ${index + 1}, history row ${r + 1}: ${key} must be a non-negative number.`);
        point[key] = x;
      }
      return point;
    });
  }
  return out;
}
