'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CloudSun, FileText, Globe2, Info, Plane, RefreshCw, Sparkles, TrendingUp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { exampleHistory, forecastRoute, parseHistoryCSV, type DailyHistory } from '@/lib/flight-forecast';
import type { OfferResult } from '@/lib/travelpayouts';

type OfferData = { origin: string; destination: string; fetchedAt: string; results: OfferResult[] };
type Article = { title: string; url: string; domain: string; seenDate: string; language: string };
type News = { city: string; articles: Article[]; fetchedAt: string };
type Weather = { city: string; timezone: string; days: { date: string; high: number | null; low: number | null; rainChance: number | null }[]; fetchedAt: string };
type State = 'idle' | 'loading' | 'ready' | 'error';
const today = () => new Date().toISOString().slice(0, 10);
const money = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
const datefmt = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const inputStyle = 'mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10';
const cardStyle = 'rounded-[24px] border bg-card p-6 sm:p-7';
const eyebrowStyle = 'text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground';

export default function FlightIntelligence({ embedded = false }: { embedded?: boolean }) {
  const [origin, setOrigin] = useState('BOM');
  const [destination, setDestination] = useState('DEL');
  const [departure, setDeparture] = useState(today);
  const [asOf, setAsOf] = useState(today);
  const [offers, setOffers] = useState<OfferData | null>(null);
  const [offersState, setOffersState] = useState<State>('idle');
  const [offersError, setOffersError] = useState('');
  const [news, setNews] = useState<News | null>(null);
  const [newsState, setNewsState] = useState<State>('idle');
  const [newsError, setNewsError] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherState, setWeatherState] = useState<State>('idle');
  const [weatherError, setWeatherError] = useState('');
  const [history, setHistory] = useState<DailyHistory[]>([]);
  const [historyName, setHistoryName] = useState('');
  const [historyError, setHistoryError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const analysis = useMemo(() => {
    if (!history.length) return null;
    try { return forecastRoute(history, origin.toUpperCase(), destination.toUpperCase(), asOf); } catch { return null; }
  }, [history, origin, destination, asOf]);
  const loading = offersState === 'loading' || newsState === 'loading' || weatherState === 'loading';

  function load() {
    setOffers(null); setNews(null); setWeather(null);
    setOffersState('loading'); setNewsState('loading'); setWeatherState('loading');
    setOffersError(''); setNewsError(''); setWeatherError('');
    const q = new URLSearchParams({ origin: origin.toUpperCase(), destination: destination.toUpperCase(), date: departure });
    const n = new URLSearchParams({ destination: destination.toUpperCase() });
    const loadOne = async (url: string) => { const r = await fetch(url, { cache: 'no-store' }); const json = await r.json(); if (!r.ok) throw new Error(json.error || 'Request failed.'); return json; };
    void loadOne('/api/flight/offers?' + q).then(j => { setOffers(j); setOffersState('ready'); }).catch(e => { setOffersError(e.message); setOffersState('error'); });
    void loadOne('/api/flight/news?' + n).then(j => { setNews(j); setNewsState('ready'); }).catch(e => { setNewsError(e.message); setNewsState('error'); });
    void loadOne('/api/flight/weather?' + n).then(j => { setWeather(j); setWeatherState('ready'); }).catch(e => { setWeatherError(e.message); setWeatherState('error'); });
  }
  function updateHistory(text: string, name: string) {
    try { setHistory(parseHistoryCSV(text)); setHistoryName(name); setHistoryError(''); }
    catch (e) { setHistoryError(e instanceof Error ? e.message : 'Could not parse CSV.'); }
  }
  async function upload(f?: File) {
    if (!f) return;
    try { if (f.size > 1000000) throw new Error('Maximum file size is 1 MB.'); updateHistory(await f.text(), f.name); }
    catch (e) { setHistoryError(e instanceof Error ? e.message : 'Could not load file.'); }
    finally { if (file.current) file.current.value = ''; }
  }
  function download() {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exampleHistory(asOf)], { type: 'text/csv' }));
    a.download = 'sample-flight-history-synthetic.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function trySample() { setOrigin('BOM'); setDestination('DEL'); updateHistory(exampleHistory(asOf), 'Synthetic sample'); }

  return <div className={`${embedded ? "" : "min-h-screen"} bg-background text-foreground`}>
    {!embedded && <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="TBO Assemble home">
          <Image src="/logo.svg" alt="" width={32} height={32} /><span className="font-display text-xl font-bold">tbo assemble</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3"><Link href="/inventory" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex">Inventory intelligence</Link><ThemeToggle /><Button asChild size="sm" variant="outline"><Link href="/"><ArrowLeft /> <span className="hidden sm:inline">Home</span></Link></Button></div>
      </div>
    </header>}
    <div>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-10 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-14 lg:pb-14">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,200,26,.4)] bg-[rgba(255,200,26,.14)] px-3.5 py-1.5 text-xs font-semibold"><Sparkles className="size-3.5" /> FLIGHT INTELLIGENCE <span className="text-muted-foreground">· PROTOTYPE</span></div>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.55rem]">A clearer view of <span className="bg-[linear-gradient(transparent_62%,var(--ill-yellow)_62%,var(--ill-yellow)_92%,transparent_92%)] px-1 [box-decoration-break:clone]">what comes next.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">Explore route demand and fare estimates from your own history, with travel context in one place.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><a href="#route">Explore a route <ArrowRight /></a></Button><Button asChild size="lg" variant="secondary"><a href="#forecast"><TrendingUp /> View predictions</a></Button></div>
          <p className="mt-5 flex max-w-xl items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" /> Forecasts are a historical baseline, not guaranteed sales or fares. News, weather and cached prices are context only.</p>
        </div>
        <div className="relative h-56 overflow-hidden rounded-[28px] sm:h-72 lg:h-[320px]">
          <Image src="/photos/mumbai.webp" alt="Mumbai's Gateway of India and Taj Mahal Palace hotel" fill priority sizes="(max-width: 1024px) 100vw, 480px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white sm:bottom-7 sm:left-7 sm:right-7"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/75">A better way to plan</p><p className="font-display mt-2 text-2xl font-bold">Travel, with insight.</p></div><div className="flex size-11 items-center justify-center rounded-full bg-white text-black"><Plane className="size-5" /></div></div>
        </div>
      </section>
      <section className="border-y bg-surface/60" id="route">
        <div className="mx-auto max-w-6xl px-5 py-9 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={eyebrowStyle}>01 / YOUR ROUTE</p><h2 className="font-display mt-2 text-2xl font-bold sm:text-3xl">Where are we looking?</h2><p className="mt-2 text-sm text-muted-foreground">Choose a route to fetch cached fares, destination news and weather.</p></div><span className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium">Airport codes · UTC dates</span></div>
          <div className="mt-6 grid gap-4 rounded-[24px] border bg-card p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[1fr_1fr_1.15fr_auto] lg:items-end">
            <label className={eyebrowStyle}>Origin airport<input className={inputStyle} maxLength={3} value={origin} onChange={e => setOrigin(e.target.value.toUpperCase())} placeholder="BOM" /></label>
            <label className={eyebrowStyle}>Destination airport<input className={inputStyle} maxLength={3} value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} placeholder="DEL" /></label>
            <label className={eyebrowStyle}>Departure date<input className={inputStyle} type="date" value={departure} onChange={e => setDeparture(e.target.value)} /></label>
            <Button className="h-12 w-full px-6 lg:w-auto" onClick={load} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} /> {loading ? 'Fetching…' : 'Fetch route signals'}</Button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Cached fares require a configured Travelpayouts token; news and weather need no key. Forecasts below refer to booking dates and a historical travel-date mix, not these departure dates.</p>
        </div>
      </section>
      <section id="forecast" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className={eyebrowStyle}>02 / DEMAND &amp; PRICE</p><h2 className="font-display mt-2 text-3xl font-bold sm:text-4xl">A little more foresight.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Upload daily route history to estimate net bookings and observed minimum fares for today and tomorrow.</p></div><a href="/research/flight-setup.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">How it works <ArrowUpRight className="size-4" /></a></div>
        <div className={`${cardStyle} mt-7`}>
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(255,200,26,.24)] text-black"><TrendingUp className="size-5" /></div><div><h3 className="font-display text-xl font-bold">Historical predictions</h3><p className="mt-1 text-sm text-muted-foreground">Your CSV stays in this browser.</p></div></div><span className="rounded-full border px-3 py-1 text-xs font-medium">Simple baseline</span></div>
          <div className="mt-6 flex flex-wrap items-end gap-2.5"><Button onClick={() => file.current?.click()}><Upload /> Upload history</Button><input type="file" accept=".csv,text/csv" hidden ref={file} onChange={e => upload(e.target.files?.[0])} /><Button variant="secondary" onClick={trySample}><Sparkles /> Try synthetic sample</Button><Button variant="outline" onClick={download}><ArrowDownToLine /> Sample CSV</Button><label className={`${eyebrowStyle} w-full sm:ml-auto sm:w-auto`}>Forecast as of<input type="date" className={`${inputStyle} mt-1.5 h-10 min-w-[150px]`} value={asOf} onChange={e => { if (e.target.value) setAsOf(e.target.value); }} /></label></div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Requires daily gross bookings, cancellations, searches and comparable minimum fares, aggregated across departure dates. At least seven consecutive completed days ending yesterday are needed for the selected route. <a className="font-semibold underline underline-offset-2" href="/research/flight-setup.md" target="_blank" rel="noreferrer">CSV guide</a>.</p>
          {historyError && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">{historyError} Previous data was retained.</p>}
          {!analysis ? <div className="mt-6 rounded-2xl border border-dashed bg-surface/50 px-5 py-8 text-center"><FileText className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Your forecast starts with history</p><p className="mt-1 text-xs text-muted-foreground">Upload a CSV or explore with clearly labelled synthetic sample data.</p></div> : <>
            <div className="mt-6 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{historyName} · {analysis.historyRows} completed rows · {origin} → {destination}</span><span>Last included: {analysis.lastDate || 'none'} · {analysis.ignoredRows} same-day/future rows excluded</span></div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">{analysis.predictions.map((p, i) => <div key={p.date} className="rounded-2xl border bg-surface/60 p-5"><div className="flex items-center justify-between gap-2"><p className={eyebrowStyle}>{i === 0 ? 'AS-OF DAY' : 'NEXT DAY'} · {datefmt(p.date)}</p><CalendarDays className="size-4 text-muted-foreground" /></div><div className="mt-5 grid grid-cols-2 gap-4"><div><p className="text-xs text-muted-foreground">Expected net bookings</p><p className="font-display mt-2 text-2xl font-bold">{p.bookings === null ? '—' : p.bookings.toFixed(1)}</p><p className="mt-1 text-xs text-muted-foreground">{analysis.bookingsMetrics[i]?.mae != null ? `Rolling MAE ${analysis.bookingsMetrics[i].mae!.toFixed(1)} (${analysis.bookingsMetrics[i].count} tests)` : 'Insufficient data for MAE'}</p></div><div><p className="text-xs text-muted-foreground">Estimated min fare</p><p className="font-display mt-2 text-2xl font-bold">{p.minFare === null ? '—' : money(p.minFare)}</p><p className="mt-1 text-xs text-muted-foreground">{analysis.fareMetrics[i]?.mae != null ? `Rolling MAE ${money(analysis.fareMetrics[i].mae!)} (${analysis.fareMetrics[i].count} tests)` : 'Insufficient data for MAE'}</p></div></div>{(p.bookings === null || p.minFare === null) && <p className="mt-4 text-xs text-muted-foreground">Insufficient or incomplete recent route history for one or more estimates.</p>}</div>)}</div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">7-day gross look-to-book: {analysis.lookToBook === null ? 'not available' : `${(analysis.lookToBook * 100).toFixed(2)}%`}. Baseline: 50% recent seven-day average + 50% same-weekday historical average, using completed days before the as-of date. Not a buying signal.</p>
          </>}
        </div>
      </section>
      <section className="border-y bg-surface/60"><div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16"><p className={eyebrowStyle}>03 / THE BIGGER PICTURE</p><h2 className="font-display mt-2 text-3xl font-bold sm:text-4xl">Context for the journey.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Current signals can help you investigate a route. They do not change the predictions above.</p>
        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          <section className={cardStyle}><div className="flex justify-between gap-4"><div><div className="flex items-center gap-2"><Plane className="size-4" /><h3 className="font-display text-xl font-bold">Recent cached fares</h3></div><p className="mt-2 text-sm text-muted-foreground">Selected departure date and the following day.</p></div><span className="h-fit rounded-full border px-3 py-1 text-xs">INR</span></div>
            {offersState === 'idle' ? <Empty>Fetch route signals above to compare cached fares.</Empty> : offersState === 'loading' ? <Empty>Searching for fares…</Empty> : offersState === 'error' ? <ErrorMessage>{offersError} <a href="/research/flight-setup.md" className="underline">Setup guide</a>.</ErrorMessage> : offers && <><p className="mt-5 text-xs font-semibold text-muted-foreground">{offers.origin} → {offers.destination} · 1 adult</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{offers.results.map(r => <div key={r.date} className="rounded-2xl border bg-surface/60 p-4"><p className={eyebrowStyle}>{datefmt(r.date)}</p>{r.error ? <p className="mt-3 text-sm text-red-600">{r.error}</p> : r.offers.length ? <><p className="font-display mt-3 text-2xl font-bold">{money(r.offers[0].total)}</p><p className="mt-1 text-xs text-muted-foreground">{r.offers[0].airline} · {r.offers[0].stops} stop(s)</p><p className="mt-2 text-xs text-muted-foreground">Found: {r.offers[0].foundAt || 'not supplied'} · Expires: {r.offers[0].expiresAt || 'not supplied'}</p></> : <p className="mt-3 text-sm text-muted-foreground">No cached result returned; availability is unknown.</p>}</div>)}</div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Fetched {new Date(offers.fetchedAt).toLocaleString('en-IN')} · Travelpayouts / Aviasales. Cached prices are not guaranteed current or bookable; recheck with the seller. No seat availability provided.</p></>}
          </section>
          <section className={cardStyle}><div className="flex items-center gap-2"><Globe2 className="size-4" /><h3 className="font-display text-xl font-bold">Destination news</h3></div><p className="mt-2 text-sm text-muted-foreground">Matching travel headlines from the past seven days.</p>
            {newsState === 'idle' ? <Empty>Fetch route signals to see recent headlines.</Empty> : newsState === 'loading' ? <Empty>Fetching news…</Empty> : newsState === 'error' ? <ErrorMessage>{newsError}</ErrorMessage> : news && <><div className="mt-4 divide-y">{news.articles.length ? news.articles.slice(0, 5).map((a, i) => <a href={a.url} key={`${a.url}-${i}`} target="_blank" rel="noreferrer" className="flex gap-3 py-3 text-sm font-medium hover:underline"><span className="flex-1">{a.title}<span className="mt-1 block text-xs font-normal text-muted-foreground">{a.domain} · {new Date(a.seenDate).toLocaleString('en-IN')}</span></span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></a>) : <p className="py-4 text-sm text-muted-foreground">No matching titles for {news.city}; relevant news may still exist.</p>}</div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Google News RSS · Retrieved {new Date(news.fetchedAt).toLocaleString('en-IN')}. Title filtering can miss articles; verify reporting. Not used in the forecast.</p></>}
          </section>
          <section className={`${cardStyle} lg:col-span-2`}><div className="flex items-center gap-2"><CloudSun className="size-4" /><h3 className="font-display text-xl font-bold">Today &amp; tomorrow weather</h3></div><p className="mt-2 text-sm text-muted-foreground">Destination outlook from Open-Meteo.</p>
            {weatherState === 'idle' ? <Empty>Fetch route signals for the next two local calendar days.</Empty> : weatherState === 'loading' ? <Empty>Fetching weather…</Empty> : weatherState === 'error' ? <ErrorMessage>{weatherError}</ErrorMessage> : weather && <><div className="mt-5 grid gap-3 sm:grid-cols-2">{weather.days.map(d => <div key={d.date} className="rounded-2xl border bg-surface/60 p-4"><p className={eyebrowStyle}>{datefmt(d.date)} · {weather.city}</p><p className="font-display mt-3 text-2xl font-bold">{d.high == null ? '—' : Math.round(d.high) + '°C'} <span className="text-base font-normal text-muted-foreground">/ {d.low == null ? '—' : Math.round(d.low) + '°C'}</span></p><p className="mt-1 text-xs text-muted-foreground">Maximum rain probability: {d.rainChance == null ? 'not available' : `${Math.round(d.rainChance)}%`}</p></div>)}</div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Fetched {new Date(weather.fetchedAt).toLocaleString('en-IN')} · {weather.timezone}. Forecast conditions are not actual future conditions or model inputs. Open-Meteo free tier is for non-commercial use.</p></>}
          </section>
        </div>
      </div></section>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-9 text-sm sm:px-6"><p className="text-muted-foreground">A decision-support prototype. Validate before making procurement decisions.</p><Link href="/inventory" className="inline-flex items-center gap-2 font-semibold hover:underline">Explore inventory intelligence <ArrowRight className="size-4" /></Link></div>
    </div>
    {!embedded && <footer className="border-t"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:px-6"><span>tbo assemble · Travel, made thoughtful.</span><Link href="/">Back to home</Link></div></footer>}
  </div>;
}

function Empty({ children }: { children: React.ReactNode }) { return <div className="mt-5 rounded-2xl border border-dashed bg-surface/50 px-4 py-7 text-center text-sm text-muted-foreground">{children}</div>; }
function ErrorMessage({ children }: { children: React.ReactNode }) { return <p className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">{children}</p>; }
