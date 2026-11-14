"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function ResetPassword() {
  const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setMessage(""); try { const {error}=await supabaseBrowser().auth.updateUser({password}); if(error) throw error; setMessage("Password updated. You can return to your account."); } catch {setMessage("Could not update your password. Your link may have expired; request a new one.");} finally {setBusy(false);} }
  return <main className="min-h-screen grid place-items-center bg-background p-6"><div className="w-full max-w-sm rounded-2xl border bg-card p-6"><h1 className="text-3xl font-bold">Choose a new password</h1><p className="mt-2 text-sm text-muted-foreground">Use at least 8 characters.</p><form onSubmit={submit} className="mt-6 space-y-4"><label htmlFor="new-password" className="text-sm font-medium">New password</label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} />{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<Button disabled={busy} className="w-full">{busy ? "Updating…" : "Update password"}</Button></form><Link href="/login" className="mt-5 inline-block text-sm underline">Back to sign in</Link></div></main>;
}
