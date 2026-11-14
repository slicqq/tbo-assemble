"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { authErrorMessage } from "@/lib/auth-error";

type Mode = "signin" | "signup" | "reset";


export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const switchMode = (next: Mode) => { setMode(next); setMessage(""); setIsError(false); };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !fullName.trim()) { setIsError(true); setMessage("Please enter your name."); return; }
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const client = supabaseBrowser();
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/secure-account/callback?flow=recovery` });
        if (error) throw error;
        setMessage("If the address can receive auth emails, a reset link has been sent. Check your inbox.");
      } else if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/secure-account/callback` } });
        if (error) throw error;
        if (data.session) { router.replace("/dashboard"); router.refresh(); }
        else setMessage("If registration is available, check your email for a confirmation link, then sign in.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/dashboard"); router.refresh();
      }
    } catch (error) {
      setIsError(true); setMessage(authErrorMessage(error));
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f7f6f3] text-foreground dark:bg-background lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <div className="relative hidden min-h-screen overflow-hidden lg:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/photos/udaipur.webp" alt="The City Palace on Lake Pichola, Udaipur" className="absolute inset-0 size-full object-cover" />
      <div className="photo-scrim-panel absolute inset-0" />
      <div className="relative flex h-full min-h-screen flex-col justify-between p-10 text-white xl:p-14">
        <Link href="/" className="flex w-fit items-center gap-3"><Image src="/logo.png" alt="" width={40} height={40} className="size-10" /><span className="font-display text-xl font-bold">tbo assemble</span></Link>
        <div className="max-w-lg"><span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[11px] font-bold tracking-widest backdrop-blur"><Sparkles className="size-3.5 text-ill-yellow" /> INVENTORY INTELLIGENCE</span>
          <h2 className="mt-6 text-5xl font-bold leading-[1.08] xl:text-6xl">Better decisions start <span className="text-ill-yellow">here.</span></h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/85">Explore travel demand, compare scenarios and plan inventory with transparent assumptions.</p>
          <div className="mt-8 inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur"><LockKeyhole className="size-4 text-ill-yellow" /> Your own space for event drafts</div></div>
        <p className="text-xs text-white/70">TBO Assemble · Inventory intelligence prototype</p>
      </div>
    </div>
    <div className="flex min-w-0 flex-col px-4 py-6 sm:px-8 lg:justify-center lg:px-10 lg:py-12">
      <Link href="/" className="mx-auto mb-7 flex w-full max-w-md items-center gap-2.5 lg:hidden"><Image src="/logo.png" alt="" width={36} height={36} className="size-9" /><span className="font-display text-lg font-bold">tbo assemble</span></Link>
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div className="mb-6"><span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"><span className="size-1.5 rounded-full bg-orange-500" /> Account preview</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : "Welcome back"}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "signup" ? "Set up your space for event drafts." : mode === "reset" ? "Enter your email to request a reset link." : "Sign in to continue to your event drafts."}</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && <div className="space-y-2"><label htmlFor="full-name" className="text-sm font-semibold">Full name</label><Input id="full-name" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={100} required className="h-12 bg-background" /></div>}
          <div className="space-y-2"><label htmlFor="email" className="text-sm font-semibold">Email address</label><Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required className="h-12 bg-background" /></div>
          {mode !== "reset" && <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label htmlFor="password" className="text-sm font-semibold">Password</label>{mode === "signin" && <button type="button" onClick={()=>switchMode("reset")} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline">Forgot password?</button>}</div><div className="relative"><Input id="password" type={show ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === "signup" ? "Create a password" : "Enter your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required className="h-12 bg-background pr-12" /><button type="button" onClick={()=>setShow(!show)} className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{mode === "signup" && <p className="text-xs text-muted-foreground">Use at least 8 characters and a unique password.</p>}</div>}
          {message && <p role={isError ? "alert" : "status"} className={`rounded-xl border px-3.5 py-3 text-sm leading-5 ${isError ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" : "bg-muted/40 text-muted-foreground"}`}>{message}</p>}
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl font-semibold">{busy ? <><Loader2 className="animate-spin" /> Please wait…</> : <>{mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}<ArrowRight className="size-4" /></>}</Button>
        </form>
        <div className="mt-5 text-center text-sm text-muted-foreground">{mode === "signin" ? <>New here? <button type="button" className="font-semibold text-foreground underline underline-offset-4" onClick={()=>switchMode("signup")}>Create an account</button></> : <button type="button" className="font-semibold text-foreground underline underline-offset-4" onClick={()=>switchMode("signin")}>Back to sign in</button>}</div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4"><div><p className="text-sm font-semibold">Just exploring?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Try the synthetic demo, no account needed.</p></div><Button asChild variant="outline" size="sm"><Link href="/inventory">Open demo <ArrowRight className="size-3.5" /></Link></Button></div>
      </div>
      <div className="mx-auto w-full max-w-md px-1"><p className="mt-5 text-xs leading-5 text-muted-foreground">Account preview: email ownership is not currently verified; recovery emails may be restricted. Don’t add sensitive data. Rooms and bookings are still being built. <Link href="/legacy-login" className="underline underline-offset-2">Old shared dashboard</Link> is not private.</p><Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to home</Link></div>
    </div>
  </main>;
}
