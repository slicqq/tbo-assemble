import { bestAtQuantity, createGreedyPlan, planRow, timingFor, type Opportunity, type PlanOptions, type PlanRow } from './procurement-core';

type Choice={qty:number;cost:number;value:number};
export type OptimizedPlan={rows:PlanRow[]; objective:number; upperBound:number; gap:number; baselineObjective:number; algorithm:'discrete-budget'|'greedy-fallback'; bucketCount:number};

/**
 * Multiple-choice knapsack approximation with a conservative budget grid.
 * Each row chooses ONE quantity and its best modeled selling price. Rounded-up
 * product costs ensure a feasible result; the greedy baseline is retained if
 * better. A Lagrangian budget relaxation gives an upper bound on the model's
 * optimum. This proves nothing about the accuracy of the assumptions.
 */
export function optimizePortfolio(items:Opportunity[], budget:number, risk:number, options:PlanOptions={}):OptimizedPlan {
 const asOf=options.asOf || new Date().toISOString().slice(0,10);
 const baseline=createGreedyPlan(items,budget,risk,{asOf});
 // Decimal prices can accumulate floating-point error in the greedy loop.
 // Recheck the actual summed spend and remove units if necessary; never return
 // an over-budget baseline, even by a floating-point rounding amount.
 let baselineSpend=baseline.reduce((s,r)=>s+r.spend,0);
 while(baselineSpend>budget){
  let i=baseline.length-1;while(i>=0&&baseline[i].qty===0)i--;
  if(i<0)break;
  const q=baseline[i].qty-1;
  baseline[i]=planRow(items[i],q,bestAtQuantity(items[i],q,risk),timingFor(items[i],asOf));
  baselineSpend=baseline.reduce((s,r)=>s+r.spend,0);
 }
 const baselineObjective=baseline.reduce((s,r)=>s+r.objective,0);
 if(budget<=0||!items.length)return {rows:baseline,objective:baselineObjective,upperBound:baselineObjective,gap:0,baselineObjective,algorithm:'greedy-fallback',bucketCount:0};
 const bucketCount=1000, step=budget/bucketCount;
 const choices:Choice[][]=items.map(item=>{
  const found:Choice[]=[{qty:0,cost:0,value:0}];
  if(timingFor(item,asOf).expired)return found;
  const maxQty=Math.min(item.capacity,Math.floor(budget/item.buy));
  for(let qty=1;qty<=maxQty;qty++){
   const cost=item.buy*qty;
   const value=bestAtQuantity(item,qty,risk).objective;
   if(value>0)found.push({qty,cost,value});
  }
  return found;
 });
 let dp=new Float64Array(bucketCount+1);dp.fill(-Infinity);dp[0]=0;
 const choiceLayers:Int16Array[]=[];
 for(const choicesForItem of choices){
  const next=new Float64Array(bucketCount+1);next.fill(-Infinity);
  const selected=new Int16Array(bucketCount+1);selected.fill(-1);
  const normalized=choicesForItem.map(c=>({...c,slots:Math.ceil(c.cost/step)})).filter(c=>c.slots<=bucketCount);
  for(let prev=0;prev<=bucketCount;prev++){
   if(dp[prev]===-Infinity)continue;
   for(const c of normalized){
    const used=prev+c.slots;if(used>bucketCount)continue;
    const value=dp[prev]+c.value;
    if(value>next[used]+1e-9){next[used]=value;selected[used]=c.qty;}
   }
  }
  dp=next;choiceLayers.push(selected);
 }
 let bestSlot=0;
 for(let slot=1;slot<=bucketCount;slot++)if(dp[slot]>dp[bestSlot]+1e-9)bestSlot=slot;
 const quantities=new Array<number>(items.length).fill(0);
 for(let i=items.length-1;i>=0;i--){
  const qty=choiceLayers[i][bestSlot];
  if(qty<0)throw new Error('Portfolio reconstruction failed');
  quantities[i]=qty;bestSlot-=Math.ceil((qty*items[i].buy)/step);
 }
 const candidate=items.map((item,i)=>planRow(item,quantities[i],bestAtQuantity(item,quantities[i],risk),timingFor(item,asOf)));
 const candidateObjective=candidate.reduce((s,r)=>s+r.objective,0);
 const candidateSpend=candidate.reduce((s,r)=>s+r.spend,0);
 const useCandidate=candidateSpend<=budget && candidateObjective>baselineObjective+1e-8;
 const rows=useCandidate?candidate:baseline;
 const objective=useCandidate?candidateObjective:baselineObjective;
 // Every feasible combination has objective <= lambda*budget + sum(max(v-lambda*cost)).
 // Bisection samples the dual function; every sample remains an upper bound.
 let lo=0,hi=0;
 for(const group of choices)for(const c of group)if(c.cost>0)hi=Math.max(hi,c.value/c.cost);
 let upperBound=Infinity;
 for(let iteration=0;iteration<60;iteration++){
  const lambda=(lo+hi)/2;let maxValue=0,chosenSpend=0;
  for(const group of choices){let best=group[0],bestScore=0;for(const c of group){const score=c.value-lambda*c.cost;if(score>bestScore){best=c;bestScore=score;}}maxValue+=bestScore;chosenSpend+=best.cost;}
  upperBound=Math.min(upperBound,lambda*budget+maxValue);
  if(chosenSpend>budget)lo=lambda;else hi=lambda;
 }
 // Offset tiny floating-point round-off; report only an upper bound, not an exact optimum.
 upperBound=Math.max(objective,upperBound+Math.max(1e-7,Math.abs(upperBound)*1e-12));
 return {rows,objective,upperBound,gap:Math.max(0,upperBound-objective),baselineObjective,algorithm:useCandidate?'discrete-budget':'greedy-fallback',bucketCount};
}
