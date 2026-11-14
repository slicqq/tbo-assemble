import { NextResponse } from 'next/server';
import { columns, optionalColumns, readInventoryCSV } from '@/lib/inventory-csv';
import { optimizePortfolio } from '@/lib/portfolio-optimizer';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try {
  if(Number(request.headers.get('content-length')||0)>200000)return NextResponse.json({error:'Request is too large.'},{status:413});
  const text=await request.text();if(text.length>200000)return NextResponse.json({error:'Request is too large.'},{status:413});
  const body=JSON.parse(text);const {items,budget,risk,asOf}=body;
  if(!Array.isArray(items)||items.length<1||items.length>20||typeof budget!=='number'||!Number.isFinite(budget)||budget<0||budget>1e9||typeof risk!=='number'||!Number.isFinite(risk)||risk<0||risk>.8)return NextResponse.json({error:'Provide 1–20 items, a budget between 0 and 1 billion, and risk between 0 and 0.8.'},{status:400});
  if(typeof asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf+'T00:00:00Z'))||new Date(asOf+'T00:00:00Z').toISOString().slice(0,10)!==asOf)return NextResponse.json({error:'asOf must be a valid YYYY-MM-DD date.'},{status:400});
  const keys=[...columns,...optionalColumns];
  const lines=items.map((item:unknown)=>{if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Each item must be an object.');return keys.map(key=>{const v=(item as Record<string,unknown>)[key];if(v!==undefined&&v!==null&&typeof v!=='string'&&typeof v!=='number')throw new Error(`Invalid ${key}.`);return `"${String(v??'').replaceAll('"','""')}"`;}).join(',')});
  const inventory=readInventoryCSV([keys.join(','),...lines].join('\n'));const optimization=optimizePortfolio(inventory,budget,risk,{asOf});const plan=optimization.rows;
  return NextResponse.json({asOf,budget,risk,summary:{spend:plan.reduce((s,r)=>s+r.spend,0),expectedProfit:plan.reduce((s,r)=>s+r.expectedProfit,0),lowProfit:plan.reduce((s,r)=>s+r.downsideProfit,0),units:plan.reduce((s,r)=>s+r.qty,0)},recommendations:plan,optimization:{objective:optimization.objective,upperBound:optimization.upperBound,gap:optimization.gap,baselineObjective:optimization.baselineObjective,algorithm:optimization.algorithm,bucketCount:optimization.bucketCount},model:'scenario-grid-v3'}, {headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request.'},{status:400,headers:{'Cache-Control':'no-store'}})}
}
