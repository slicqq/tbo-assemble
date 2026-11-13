'use client';
import {useState} from 'react';
import {Server} from 'lucide-react';
import type {Opportunity} from '@/lib/procurement';
type Result={key:string;summary:{spend:number;expectedProfit:number;units:number}};
export default function PlanApiCheck({items,budget,risk,asOf}:{items:Opportunity[];budget:number;risk:number;asOf:string}){
 const [pending,setPending]=useState(false);const [result,setResult]=useState<Result|null>(null);const [error,setError]=useState('');const key=JSON.stringify({items,budget,risk,asOf});
 async function run(){setPending(true);setError('');try{const response=await fetch('/api/procurement/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:key});const data=await response.json();if(!response.ok)throw new Error(data.error||'Planning API failed.');setResult({key,summary:data.summary})}catch(e){setResult(null);setError(e instanceof Error?e.message:'Planning API failed.')}finally{setPending(false)}}
 const current=result?.key===key?result:null;const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
 return <section className="api-check"><div><strong><Server size={16}/> Planning API</strong><p>Optionally send your current inventory and settings to this app’s server to run the same model. The endpoint does not persist data or place orders.</p>{error&&<span className="api-error" role="alert">{error}</span>}{current&&<span className="api-success">API returned {current.summary.units} units · {money(current.summary.spend)} spend · {money(current.summary.expectedProfit)} expected profit</span>}</div><button onClick={run} disabled={pending}>{pending?'Running…':'Run planning API'}</button></section>
}
