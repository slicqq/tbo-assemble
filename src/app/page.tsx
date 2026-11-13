"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Illustration, type IllustrationName } from "@/components/ui/illustration";
import { Marquee } from "@/components/ui/marquee";
import { Sparkline } from "@/components/ui/sparkline";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Section, FeatureBlock, PhotoFrame, IconChip, Eyebrow } from "@/components/system";
import { photo, type PhotoKey } from "@/lib/photos";
import {
  ArrowRight, BarChart3, Check, ChevronRight, FileText, Globe, Heart, Menu, MapPin,
  QrCode, Sparkles, Star, X, Zap, MessageSquare, IndianRupee, Users,
} from "lucide-react";

/* Number ticker */
function useCounter(end: number, duration = 1600) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = end / (duration / 16);
          const timer = setInterval(() => {
            start += step;
            if (start >= end) {
              setCount(end);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration]);
  return { count, ref };
}

/* Hero visual: one destination photo, two product cards (illustrative data) */
function HeroVisual() {
  const p = photo("udaipur");
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <PhotoFrame src={p.src} alt={p.alt} className="aspect-[4/5] rounded-[28px]">
        <p className="text-xs font-medium uppercase tracking-wider text-white/75">Destination wedding · 3 nights</p>
        <p className="mt-1 font-display text-2xl font-bold">Sharma–Patel Wedding</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-white/85"><MapPin className="size-3.5" /> The Grand Hyatt, Udaipur</p>
      </PhotoFrame>

      <div className="absolute -left-6 top-10 w-52 rounded-2xl border bg-card p-4 shadow-xl sm:-left-12">
        <p className="text-xs text-muted-foreground">Revenue booked</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">₹18,40,000</p>
        <Sparkline data={[2, 3, 3, 5, 6, 8, 9, 11, 12, 15, 17, 18]} className="mt-2 h-10 w-full" />
      </div>

      <div className="absolute -right-4 bottom-28 w-56 rounded-2xl border bg-card p-4 shadow-xl sm:-right-10">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">RSVPs</p>
          <Badge variant="success">64% of rooms</Badge>
        </div>
        <p className="mt-1 text-xl font-semibold tabular-nums">142 <span className="text-sm font-normal text-muted-foreground">/ 180</span></p>
        <AvatarStack names={["Aarav Shah", "Meera Iyer", "Kabir Rao", "Diya Nair", "Rohan Das", "Isha Gupta"]} max={5} className="mt-3" />
      </div>
    </div>
  );
}

export default function Home() {
  const [mobileNav, setMobileNav] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const stat1 = useCounter(4);
  const stat2 = useCounter(13);
  const stat3 = useCounter(42);
  const stat4 = useCounter(60);

  const destinations: { k: PhotoKey; city: string; note: string }[] = [
    { k: "udaipur", city: "Udaipur", note: "Palace weddings" },
    { k: "goa", city: "Goa", note: "Beach weddings" },
    { k: "jaipur", city: "Jaipur", note: "Corporate offsites" },
    { k: "mumbai", city: "Mumbai", note: "MICE summits" },
    { k: "shimla", city: "Shimla", note: "Reunions" },
    { k: "hyderabad", city: "Hyderabad", note: "Conventions" },
    { k: "bengaluru", city: "Bengaluru", note: "Product launches" },
  ];

  const steps: { step: string; title: string; desc: string; art: IllustrationName }[] = [
    { step: "01", title: "Upload documents", desc: "Drop your hotel contract and event invitation. The GenAI pipeline parses room types, rates and dates, and extracts theme colours for branding.", art: "printer" },
    { step: "02", title: "Review & customise", desc: "Verify the extracted data, adjust room blocks, configure add-ons, set attrition rules and fine-tune the branded microsite.", art: "ui-ux" },
    { step: "03", title: "Go live & track", desc: "Share the microsite with guests. Monitor bookings in real time, allocate rooms, track revenue and auto-nudge pending RSVPs.", art: "rocket" },
  ];

  const useCases: { k: PhotoKey; title: string; desc: string }[] = [
    { k: "wedding", title: "Destination weddings", desc: "Sangeet, mehendi, reception across hotels. Group guests by family and allocate VIP suites." },
    { k: "keynote", title: "MICE conferences", desc: "Negotiated room blocks, speaker suites, delegate rooms and networking passes." },
    { k: "goa", title: "Sports tournaments", desc: "Team delegations allocated by squad, with meal packages and venue check-in lists." },
    { k: "shimla", title: "College fests & reunions", desc: "Bulk import attendees, auto-assign rooms and share booking links on WhatsApp." },
    { k: "hyderabad", title: "Religious pilgrimages", desc: "Bookings across dharamshalas and hotels, with dietary preferences and temple-visit add-ons." },
    { k: "jaipur", title: "Film & production shoots", desc: "Rooms near locations with crew tiers — talent suites, crew rooms and storage." },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ─── Navigation ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="size-8" />
            <span className="font-display text-xl font-bold">tbo assemble</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {["Features", "How it Works", "Feedback", "Impact"].map((l) => (
              <Link key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                {l}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/inventory">Inventory intelligence</Link></Button>
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/dashboard">Sign in</Link></Button>
            <Button asChild className="hidden sm:inline-flex"><Link href="/dashboard/onboarding">Get started</Link></Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation menu" aria-expanded={mobileNav ? "true" : "false"}>
              {mobileNav ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {mobileNav && (
          <div className="border-t px-6 py-3 md:hidden">
            {[
              { href: "#features", label: "Features" },
              { href: "#how-it-works", label: "How it Works" },
              { href: "#feedback", label: "Feedback" },
              { href: "#impact", label: "Impact" },
              { href: "/inventory", label: "Inventory intelligence" },
              { href: "/flight-intelligence", label: "Flight intelligence" },
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/onboarding", label: "Get started" },
            ].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMobileNav(false)} className="block rounded-full px-3 py-2 text-sm font-medium hover:bg-accent">
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main>
        {/* ─── Hero ────────────────────────────────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-16 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <Link href="/event/techconnect-summit-2026" className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,200,26,0.35)] bg-[rgba(255,200,26,0.14)] px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-[rgba(255,200,26,0.24)]">
              VoyageHack 3.0 · Team IIITDards · Built for TBO <ChevronRight className="size-3.5" />
            </Link>
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-[4.25rem]">
              The operating system for{" "}
              <span className="bg-[linear-gradient(transparent_62%,var(--ill-yellow)_62%,var(--ill-yellow)_92%,transparent_92%)] px-1 [box-decoration-break:clone]">group travel</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Transform hotel room block management from spreadsheet chaos into an intelligent, automated workflow. Parse contracts with AI, allocate guests visually, and protect your revenue — all in one platform.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg"><Link href="/dashboard/onboarding">Start 60-second setup <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="secondary"><Link href="/dashboard"><BarChart3 /> View live demo</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/inventory">Inventory intelligence <ArrowRight /></Link></Button>
            </div>
            <div className="mt-10 flex items-center gap-4 border-t pt-6">
              <AvatarStack names={["Priya Sharma", "Arjun Mehta", "Neha Kapoor", "Ravi Kumar"]} max={4} size="size-8" />
              <div className="text-sm">
                <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />)}</div>
                <p className="mt-0.5 text-muted-foreground">Tested by wedding planners, MICE coordinators and travel agents</p>
              </div>
            </div>
          </div>
          <HeroVisual />
        </section>

        {/* ─── Destinations ───────────────────────────── */}
        <section aria-label="Destinations" className="border-y bg-surface/60 py-10">
          <p className="mb-6 text-center text-sm text-muted-foreground">Room blocks managed across India&apos;s favourite destinations</p>
          <Marquee>
            {destinations.map((d) => {
              const p = photo(d.k);
              return (
                <PhotoFrame key={d.city} src={p.src} alt={p.alt} className="h-36 w-56 shrink-0">
                  <p className="font-display text-lg font-bold leading-none">{d.city}</p>
                  <p className="mt-1 text-xs text-white/80">{d.note}</p>
                </PhotoFrame>
              );
            })}
          </Marquee>
        </section>

        {/* ─── Stats ───────────────────────────────────── */}
        <section id="impact" className="scroll-mt-16 border-b">
          <div className="mx-auto grid max-w-6xl grid-cols-2 px-6 lg:grid-cols-4">
            {[
              { ref: stat1.ref, value: stat1.count, suffix: "", label: "Core modules" },
              { ref: stat2.ref, value: stat2.count, suffix: "", label: "Prisma models" },
              { ref: stat3.ref, value: stat3.count, suffix: "+", label: "API endpoints" },
              { ref: stat4.ref, value: stat4.count, suffix: "s", label: "AI setup time" },
            ].map((s, i) => (
              <div key={s.label} ref={s.ref} className={`py-10 text-center ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
                <p className="font-display text-5xl font-bold tabular-nums">{s.value.toLocaleString("en-IN")}{s.suffix}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Features ───────────────────────────────── */}
        <Section id="features" eyebrow="Core capabilities" title="Four pillars of intelligence" description="Purpose-built features for the core pain points of group travel inventory across India's MICE and wedding industry.">
          <div className="grid gap-4 lg:grid-cols-5">
            <FeatureBlock tone="yellow" tag="AI" title="GenAI contract parsing" className="lg:col-span-3"
              description="Upload your hotel contract (PDF, Word, Excel, or image) and event invitation. The AI pipeline extracts room blocks, negotiated rates, dates, attrition penalties and theme colours — and generates a branded microsite in under 60 seconds.">
              <div className="rounded-2xl bg-white p-4 text-black">
                <div className="flex items-center gap-2 text-sm font-medium"><FileText className="size-4" /> Hotel_Contract_Udaipur.pdf</div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  {[["Room blocks", "4 types · 120 rooms"], ["Rate", "₹18,500 / night"], ["Check-in", "12 Dec 2026"], ["Attrition", "20% by 15 Nov"]].map(([k, v]) => (
                    <div key={k}><dt className="text-black/55">{k}</dt><dd className="font-semibold">{v}</dd></div>
                  ))}
                </dl>
              </div>
            </FeatureBlock>

            <FeatureBlock tone="green" tag="Drag & drop" title="Visual proximity allocator" className="lg:col-span-2"
              description="Assign guests to floors and wings. Honour requests like 'near the bride's family' with VIP prioritisation and live capacity.">
              <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white p-3" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className={`flex h-7 items-center justify-center rounded-lg text-[10px] font-semibold ${[0, 1, 4, 5, 9].includes(i) ? "bg-black text-white" : i === 6 ? "bg-ill-yellow text-black" : "bg-black/5 text-black/40"}`}>
                    {i === 6 ? "VIP" : 401 + i}
                  </span>
                ))}
              </div>
            </FeatureBlock>

            <FeatureBlock tag="Live" title="Smart-yield protection" className="lg:col-span-2"
              description="Track release deadlines, auto-calculate at-risk revenue in ₹ and nudge pending guests on WhatsApp before penalties hit.">
              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">At risk before 15 Nov</span><span className="font-semibold text-red-600">₹4,62,000</span></div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-red-100 dark:bg-red-500/20"><span className="w-[68%] bg-emerald-500" /></div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><MessageSquare className="size-3.5" /> 23 WhatsApp nudges sent today</div>
              </div>
            </FeatureBlock>

            <FeatureBlock tag="Add-ons" title="Experience bundling engine" className="lg:col-span-3"
              description="Airport transfers, gala passes and spa packages as add-ons, with GST-compliant, itemised invoices and included perks clearly marked.">
              <ul className="divide-y rounded-2xl border bg-card text-sm">
                {[["Airport transfer", "₹2,400"], ["Gala dinner pass", "Included"], ["Spa package", "₹6,500"]].map(([a, v]) => (
                  <li key={a} className="flex items-center justify-between px-4 py-2.5"><span>{a}</span><span className={v === "Included" ? "text-emerald-600" : "font-medium tabular-nums"}>{v}</span></li>
                ))}
              </ul>
            </FeatureBlock>
          </div>
        </Section>

        {/* ─── How it works ───────────────────────────── */}
        <Section id="how-it-works" tone="muted" eyebrow="Workflow" title="From contract to microsite in minutes" description="A streamlined three-step workflow that replaces weeks of manual coordination.">
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.step} className="rounded-[28px] border bg-card p-3">
                <Illustration name={s.art} className="rounded-[20px]" />
                <div className="px-3 pb-4 pt-5">
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">Step {s.step}</span>
                  <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* ─── Use cases ──────────────────────────────── */}
        <Section eyebrow="Use cases" title="Built for India's biggest occasions" description="Whether it's a 500-guest destination wedding in Udaipur or a 3-day corporate summit in Mumbai, TBO Assemble handles the complexity.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((uc) => {
              const p = photo(uc.k);
              return (
                <PhotoFrame key={uc.title} src={p.src} alt={p.alt} className="h-72 rounded-[28px]">
                  <h3 className="font-display text-2xl font-bold">{uc.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/80">{uc.desc}</p>
                </PhotoFrame>
              );
            })}
          </div>
        </Section>

        {/* ─── Testimonials ───────────────────────────── */}
        <Section id="feedback" tone="muted" eyebrow="Beta feedback" title="What our early testers say" description="We shared this prototype with travel professionals for hands-on testing. Here's their feedback.">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { quote: "The drag-and-drop room allocator is a game-changer. What used to take me hours on Excel took minutes here. Just needs bulk upload support and it's perfect.", name: "Priya Sharma", role: "Wedding Planner · Beta Tester", location: "Jaipur" },
              { quote: "I tested the attrition tracking and deadline alerts — exactly what we've been missing. The AI contract parsing picked up dates I would have missed manually. Impressive for a prototype.", name: "Arjun Mehta", role: "MICE Coordinator · Beta Tester", location: "Bengaluru" },
              { quote: "Shared the guest microsite link with my team — they loved the self-service booking and WhatsApp confirmations. If this goes live, it'll save us 20+ calls per event.", name: "Neha Kapoor", role: "Travel Agent · Beta Tester", location: "Mumbai" },
            ].map((t) => (
              <figure key={t.name} className="flex flex-col rounded-2xl border bg-card p-6">
                <div className="flex gap-0.5" role="img" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-amber-400 text-amber-400" />)}
                </div>
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t pt-4">
                  <AvatarStack names={[t.name]} size="size-9" />
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role} · {t.location}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        {/* ─── Problem / solution ─────────────────────── */}
        <Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-8">
              <Eyebrow>The problem</Eyebrow>
              <h2 className="mt-3 text-3xl font-bold">Why the industry needs this</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                India&apos;s group travel industry manages thousands of crore in hotel room blocks annually — yet most agents still rely on spreadsheets, WhatsApp groups and manual emails. This leads to:
              </p>
              <ul className="mt-6 divide-y border-y">
                {[
                  "Missed attrition deadlines leading to heavy penalty charges",
                  "4-6 hours wasted per event on manual guest allocation",
                  "High booking drop-off due to clunky reservation processes",
                  "Zero real-time visibility into room block utilisation",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-3 py-3 text-sm"><X className="mt-0.5 size-4 shrink-0 text-red-600" />{p}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-8">
              <Eyebrow>The solution</Eyebrow>
              <h2 className="mt-3 text-3xl font-bold">With TBO Assemble, you get</h2>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2">
                {[
                  { icon: Sparkles, text: "60-second AI-powered event setup from contract PDF" },
                  { icon: QrCode, text: "Branded microsite with QR check-in for every guest" },
                  { icon: Zap, text: "Automated attrition alerts via WhatsApp before deadlines" },
                  { icon: IndianRupee, text: "Real-time revenue tracking with GST-ready invoicing" },
                  { icon: Users, text: "Drag-and-drop room allocation with proximity matching" },
                  { icon: BarChart3, text: "Comparative analytics across all your events" },
                ].map((b) => (
                  <li key={b.text} className="flex items-start gap-3 text-sm">
                    <IconChip icon={b.icon} />
                    <span className="pt-2 leading-relaxed">{b.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ─── Comparison ─────────────────────────────── */}
        <Section tone="muted" align="center" eyebrow="Why switch" title="Manual coordination vs TBO Assemble" description="How TBO Assemble replaces manual workflows at every step.">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Task</TableHead>
                  <TableHead>Manual</TableHead>
                  <TableHead className="pr-6">TBO Assemble</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Contract parsing", "Read 20-page PDFs manually", "AI extracts in 30 seconds"],
                  ["Room allocation", "Spreadsheet juggling", "Smart auto-allocator"],
                  ["Guest invitations", "Individual emails/calls", "Branded microsites + QR"],
                  ["Check-in process", "Paper lists at lobby", "QR scan, instant verify"],
                  ["Attrition tracking", "Calendar reminders", "Auto deadline alerts"],
                  ["Revenue reports", "Manual Excel formulas", "Real-time analytics"],
                  ["Guest changes", "Phone calls & emails", "Self-service portal"],
                  ["Multi-event management", "Separate spreadsheets", "Unified dashboard"],
                ].map(([task, manual, tbo]) => (
                  <TableRow key={task}>
                    <TableCell className="py-3.5 pl-6 font-medium">{task}</TableCell>
                    <TableCell className="text-muted-foreground">{manual}</TableCell>
                    <TableCell className="pr-6"><span className="inline-flex items-center gap-1.5"><Check className="size-4 text-emerald-600" />{tbo}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-xs text-muted-foreground">Built with</span>
            {["Next.js 16", "GPT-4o", "Prisma 7", "TypeScript", "Tailwind v4", "shadcn/ui", "Recharts"].map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        </Section>

        {/* ─── CTA ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid items-center gap-10 rounded-[28px] bg-ill-yellow p-10 text-black sm:p-14 md:grid-cols-[1.4fr_1fr]">
            <div>
              <span className="ill-chip">Free to start · No credit card</span>
              <h2 className="mt-4 text-4xl font-bold leading-[1.02] sm:text-5xl">Ready to transform your group bookings?</h2>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-black/70">See how TBO Assemble replaces spreadsheets with an intelligent, AI-powered workflow. Try the live demo now.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="bg-black text-white hover:bg-black/85"><Link href="/dashboard/onboarding">Create your first event <ArrowRight /></Link></Button>
                <Button asChild size="lg" variant="ghost" className="bg-black/10 text-black hover:bg-black/15 hover:text-black"><Link href="/dashboard">Explore dashboard</Link></Button>
              </div>
            </div>
            <div className="mx-auto w-full max-w-[280px]">
              <Illustration name="travel-bag" className="rounded-[24px]" />
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ───────────────────────────────────── */}
      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" className="size-7" />
              <span className="font-display text-lg font-bold">tbo assemble</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The Operating System for Group Travel — AI-powered hotel room block management for MICE events, destination weddings and corporate retreats across India.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Product</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { href: "/inventory", label: "Inventory intelligence" },
              { href: "/flight-intelligence", label: "Flight intelligence" },
              { href: "/dashboard", label: "Dashboard" },
                { href: "/dashboard/onboarding", label: "Create event" },
                { href: "/dashboard/analytics", label: "Analytics" },
                { href: "/dashboard/calendar", label: "Calendar view" },
              ].map((l) => <li key={l.href}><Link href={l.href} className="text-muted-foreground hover:text-foreground">{l.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Demo events</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { href: "/event/techconnect-summit-2026", label: "MICE conference", icon: Globe },
                { href: "/event/sharma-patel-wedding-2026", label: "Destination wedding", icon: Heart },
              ].map((l) => <li key={l.href}><Link href={l.href} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><l.icon className="size-3.5" />{l.label}</Link></li>)}
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>&copy; {new Date().getFullYear()} TBO Tech Pvt. Ltd. · Built by Team IIITDards for VOYAGEHACK 3.0</span>
          </div>
        </div>
      </footer>

      {showScrollTop && (
        <Button size="icon" variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 shadow-md" aria-label="Scroll to top">
          <ChevronRight className="-rotate-90" />
        </Button>
      )}
    </div>
  );
}
