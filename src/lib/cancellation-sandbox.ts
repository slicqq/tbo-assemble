/** Hypothetical booking outcomes for a fixed, pre-purchased block. Not a demand forecast. */
export type CancellationInputs={capacity:number;bookings:number;cancelRate:number;salePrice:number;unitCost:number;fixedFee:number;recoveryRate:number;cancelFee:number;deniedCost:number};
export type CancellationOutcome={probabilityDenied:number;expectedDenied:number;expectedCancelled:number;expectedServed:number;expectedUnsold:number;expectedCancellationFees:number;expectedDeniedCost:number;purchaseCost:number;expectedRecovery:number;expectedProfit:number};
export function validateCancellationInputs(x:CancellationInputs):string|null{
 if(!Number.isInteger(x.capacity)||x.capacity<1||x.capacity>500)return 'Purchased capacity must be a whole number from 1 to 500.';
 if(!Number.isInteger(x.bookings)||x.bookings<0||x.bookings>1000)return 'Booking count must be a whole number from 0 to 1,000.';
 if(!Number.isFinite(x.cancelRate)||x.cancelRate<0||x.cancelRate>1)return 'Cancellation probability must be between 0% and 100%.';
 if(!Number.isFinite(x.recoveryRate)||x.recoveryRate<0||x.recoveryRate>1)return 'Unsold recovery must be between 0% and 100%.';
 for(const value of [x.salePrice,x.unitCost,x.fixedFee,x.cancelFee,x.deniedCost])if(!Number.isFinite(value)||value<0||value>10000000)return 'Money values must be between ₹0 and ₹1,00,00,000.';
 if(x.cancelFee>x.salePrice)return 'The cancellation fee cannot exceed the booking price.';
 return null;
}
/** Calculate normalized binomial probabilities starting at the mode. This avoids
 * underflow from starting at either tail for large booking counts. */
function binomial(n:number,p:number):Float64Array{
 const weights=new Float64Array(n+1);
 if(p===0){weights[0]=1;return weights}if(p===1){weights[n]=1;return weights}
 const mode=Math.floor((n+1)*p);weights[mode]=1;
 for(let k=mode;k>0;k--)weights[k-1]=weights[k]*(k/(n-k+1))*((1-p)/p);
 for(let k=mode;k<n;k++)weights[k+1]=weights[k]*((n-k)/(k+1))*(p/(1-p));
 const total=weights.reduce((a,b)=>a+b,0);for(let k=0;k<=n;k++)weights[k]/=total;return weights;
}
export function simulateCancellations(x:CancellationInputs):CancellationOutcome{
 const error=validateCancellationInputs(x);if(error)throw new Error(error);
 const weights=binomial(x.bookings,x.cancelRate);let probabilityDenied=0,expectedDenied=0,expectedCancelled=0,expectedServed=0,expectedUnsold=0;
 for(let c=0;c<=x.bookings;c++){const p=weights[c],arriving=x.bookings-c,served=Math.min(x.capacity,arriving),denied=Math.max(0,arriving-x.capacity);probabilityDenied+=denied>0?p:0;expectedDenied+=p*denied;expectedCancelled+=p*c;expectedServed+=p*served;expectedUnsold+=p*(x.capacity-served);}
 const purchaseCost=x.capacity*x.unitCost+x.fixedFee,expectedCancellationFees=expectedCancelled*x.cancelFee,expectedDeniedCost=expectedDenied*x.deniedCost,expectedRecovery=expectedUnsold*x.unitCost*x.recoveryRate;
 const expectedProfit=expectedServed*x.salePrice+expectedCancellationFees+expectedRecovery-purchaseCost-expectedDeniedCost;
 return {probabilityDenied:Math.min(1,Math.max(0,probabilityDenied)),expectedDenied,expectedCancelled,expectedServed,expectedUnsold,expectedCancellationFees,expectedDeniedCost,purchaseCost,expectedRecovery,expectedProfit};
}
