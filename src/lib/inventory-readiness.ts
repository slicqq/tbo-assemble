import { timingFor, type Opportunity } from './procurement';

// Coverage indicators only. They do not validate source quality or model accuracy.
export function inventoryReadiness(items: Opportunity[], asOf: string) {
 return {
  total: items.length,
  missingQuoteExpiry: items.filter(item => !item.quoteExpiry).length,
  expiredQuotes: items.filter(item => item.quoteExpiry && timingFor(item,asOf).expired).length,
  missingTrends: items.filter(item => !(item.previousBookings && item.previousBookings>0) || !(item.previousSearches && item.previousSearches>0)).length,
 };
}
