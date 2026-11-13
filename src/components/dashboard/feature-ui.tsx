import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { PageHeader } from '@/components/system';

/** The same page header and stat-card proportions as the main Dashboard. */
export function FeatureHeader({title,description,status,actions}:{title:string;description:string;status?:string;actions?:ReactNode}) {
 return <PageHeader className="mb-6 items-center pl-12 lg:pl-0" title={title} description={description} actions={<>{status&&<span className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-muted-foreground"><span className="size-2 rounded-full bg-amber-500"/>{status}</span>}{actions}</>}/>;
}
export function FeatureNotice({children}:{children:ReactNode}){
 return <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0"/><div>{children}</div></div>;
}
export function FeatureMetric({icon,label,value,caption,visual}:{icon:ReactNode;label:string;value:ReactNode;caption?:ReactNode;visual?:ReactNode}) {
 return <div className="flex flex-col rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">{icon}</span></div><div className="mt-3 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">{value}</div>{caption&&<p className="mt-2 text-xs text-muted-foreground">{caption}</p>}{visual&&<div className="mt-auto flex min-h-16 items-end pt-4">{visual}</div>}</div>;
}
