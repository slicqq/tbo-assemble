"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Mode = "signin" | "signup" | "reset";
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const switchMode = (next: Mode) => { setMode(next); setMessage(""); setIsError(false); };
  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(""); setIsError(false);
    try {
      const client = supabaseBrowser();
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/secure-account/callback?flow=recovery` });
        if (error) throw error;
        setMessage("If the address can receive auth emails, a reset link has been sent. Check your inbox.");
      } else if (mode === "signup") {
        const { error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/secure-account/callback` } });
        if (error) throw error;
        setMessage("If registration is available, check your email for a confirmation link, then sign in.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/secure-account"); router.refresh();
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      setIsError(true);
      setMessage(code === "email_address_not_authorized" ? "This address cannot receive email from the current test email service. Contact the project owner." : code === "over_email_send_rate_limit" || code === "over_request_rate_limit" ? "Too many attempts. Please wait and try again." : "Unable to continue. Check your details and try again.");
    } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen bg-background lg:grid-cols-2">
    <div className="relative hidden overflow-hidden lg:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/photos/udaipur.webp" alt="The City Palace on Lake Pichola, Udaipur" className="absolute inset-0 size-full object-cover" />
      <div className="photo-scrim-panel absolute inset-0" />
      <div className="relative flex h-full flex-col justify-between p-10 text-white">
        <div className="flex items-center gap-2.5"><Image src="/logo.png" alt="" width={36} height={36} className="size-9" /><span className="font-display text-xl font-bold">tbo assemble</span></div>
        <div className="max-w-lg"><span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur"><Sparkles className="size-3.5" /> INVENTORY INTELLIGENCE</span>
          <h2 className="mt-5 text-5xl font-bold leading-[1.02]">Better decisions start <span className="text-ill-yellow">here.</span></h2>
          <p className="mt-4 text-lg leading-relaxed text-white/80">Explore travel demand, compare scenarios and plan inventory with transparent assumptions.</p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-sm backdrop-blur"><LockKeyhole className="size-4 text-ill-yellow" /> Supabase account sign-in</div></div>
        <p className="text-xs text-white/60">TBO Assemble · Inventory intelligence prototype</p>
      </div>
    </div>
    <div className="flex items-center justify-center px-6 py-10 sm:p-12"><div className="w-full max-w-sm">
      <div className="mb-9 flex items-center gap-2.5 lg:hidden"><Image src="/logo.png" alt="" width={32} height={32} className="size-8" /><span className="font-display text-lg font-bold">tbo assemble</span></div>
      <div className="mb-7"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your account</span><h1 className="mt-2 text-4xl font-bold">{mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : "Welcome back"}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "reset" ? "We’ll send you a password reset link." : "Sign in to your private event drafts. Rooms and bookings are still being built."}</p></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email address</label><Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
        {mode !== "reset" && <div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">Password</label>{mode === "signin" && <button type="button" onClick={()=>switchMode("reset")} className="text-xs text-muted-foreground underline-offset-4 hover:underline">Forgot password?</button>}</div><div className="relative"><Input id="password" type={show ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required className="pr-10" /><button type="button" onClick={()=>setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{mode === "signup" && <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>}</div>}
        {message && <p role={isError ? "alert" : "status"} className={`rounded-md border px-3 py-2.5 text-sm ${isError ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" : "bg-muted/40 text-muted-foreground"}`}>{message}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? <><Loader2 className="animate-spin" /> Please wait…</> : <><LogIn /> {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</>}</Button>
      </form>
      <div className="mt-5 text-sm text-muted-foreground">{mode === "signin" ? <>New here? <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={()=>switchMode("signup")}>Create an account</button></> : <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={()=>switchMode("signin")}>Back to sign in</button>}</div>
      <div className="mt-7 rounded-xl border bg-muted/30 p-4"><p className="text-sm font-semibold">Just exploring?</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Try the inventory planner with synthetic data. No account needed.</p><Button asChild variant="outline" size="sm" className="mt-3"><Link href="/inventory">Open synthetic demo</Link></Button></div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Email confirmation is in testing and currently limited to permitted project-team addresses. <Link href="/legacy-login" className="underline">Open the old shared dashboard</Link> (not private).</p>
      <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to home</Link>
    </div></div>
  </main>;
}
