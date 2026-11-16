/** Rebuilds public/research/learned-traffic-study.json: npx tsx scripts/learned-traffic-study.ts */
import { writeFileSync } from 'node:fs';
import base from '../public/research/statsforecast-study.json';
import snapshot from '../data/statsforecast/route-traffic-snapshot.json';
import { runLearnedTrafficStudy, type BaseStudy, type TrafficSnapshot } from '../src/lib/learned-traffic-study';

const result = runLearnedTrafficStudy(base as unknown as BaseStudy, snapshot as unknown as TrafficSnapshot);
const round = (v: unknown): unknown => typeof v === 'number' ? Math.round(v * 10) / 10 : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;
writeFileSync('public/research/learned-traffic-study.json', JSON.stringify(round(result), null, 1) + '\n');
console.log(JSON.stringify(result.summary));
