'use client';

import type { ReactNode } from 'react';

export type BarItem = { label: string; value: number | null; text: string; tone?: 'brand' | 'blue' | 'neutral' | 'amber'; detail?: string };
const colors = { brand: 'bg-brand', blue: 'bg-blue-500', neutral: 'bg-foreground/70', amber: 'bg-amber-500' };

/** Values remain visible as text; an unavailable value never becomes a zero bar. */
export function ComparisonBars({items, empty='No values available.'}:{items:BarItem[];empty?:string}) {
 const max=Math.max(0,...items.map(item=>item.value??0));
 if(!items.length)return <p className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{empty}</p>;
 return <ul className="mt-5 space-y-4">{items.map((item,i)=><li key={`${item.label}-${i}`}><div className="mb-1.5 flex items-start justify-between gap-4 text-xs"><span className="min-w-0 font-medium">{item.label}{item.detail&&<span className="ml-1.5 font-normal text-muted-foreground">{item.detail}</span>}</span><span className="shrink-0 font-semibold tabular-nums">{item.text}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">{item.value!==null&&item.value>0&&<div className={`h-full rounded-full ${colors[item.tone??'brand']}`} style={{width:`${max?Math.max(1,item.value/max*100):0}%`}}/>}</div></li>)}</ul>;
}

export type ActivityPoint = { date:string; value:number|null; kind:'History'|'Estimate' };
export function ActivityBars({points, unit, format}:{points:ActivityPoint[];unit:string;format:(v:number)=>string}) {
 const max=Math.max(1,...points.map(p=>p.value??0));
 const short=(date:string)=>new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
 if(!points.length)return <div className="mt-5 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No completed history for this route and date.</div>;
 return <><div className="mt-5 overflow-x-auto"><div className="sm:min-w-[560px]"><div className="relative h-40 border-b pl-20"><div className="pointer-events-none absolute inset-0 flex flex-col justify-between text-[10px] text-muted-foreground"><div className="flex items-center gap-2"><span className="w-[72px] text-right">{format(max)}</span><span className="flex-1 border-t border-dashed"/></div><div className="flex items-center gap-2"><span className="w-[72px] text-right">{format(max/2)}</span><span className="flex-1 border-t border-dashed"/></div><div className="flex items-center gap-2"><span className="w-[72px] text-right">0</span><span className="flex-1 border-t border-dashed"/></div></div><div className="relative flex h-full items-end gap-1 sm:gap-2" aria-hidden="true">{points.map((p,i)=><div key={`${p.date}-${i}`} className="flex h-full min-w-0 flex-1 items-end justify-center"><div title={`${short(p.date)}: ${p.value===null?'Unavailable':format(p.value)} ${unit}`} className={`w-full max-w-10 rounded-t-md ${p.kind==='Estimate'?'bg-brand':'bg-blue-500/75'}`} style={{height:p.value===null||p.value===0?'0%':`${Math.max(1,p.value/max*100)}%`}}/></div>)}</div></div><div className="flex gap-1 pl-20 pt-2 sm:gap-2">{points.map((p,i)=><span key={`${p.date}-${i}`} className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground"><span className="whitespace-nowrap sm:hidden">{i%4===0 ? short(p.date) : ''}</span><span className="hidden whitespace-nowrap sm:inline">{i%2===0||p.kind==='Estimate'?short(p.date):''}</span></span>)}</div></div></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground"><span><span className="mr-1.5 inline-block size-2 rounded-full bg-blue-500/75"/>History</span><span><span className="mr-1.5 inline-block size-2 rounded-full bg-brand"/>Estimate</span></div><details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium hover:text-foreground">View chart values</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b"><th className="py-2">Date</th><th>Type</th><th>{unit}</th></tr></thead><tbody>{points.map((p,i)=><tr key={`${p.date}-${i}`} className="border-b last:border-0"><td className="py-2">{short(p.date)}</td><td>{p.kind}</td><td>{p.value===null?'Unavailable':format(p.value)}</td></tr>)}</tbody></table></div></details></>;
}
export function VisualCard({title,description,children,className=''}:{title:string;description:string;children:ReactNode;className?:string}) {
 return <section className={`min-w-0 rounded-2xl border bg-card p-5 sm:p-6 ${className}`}><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>{children}</section>;
}
