"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { Eye, EyeOff, LogIn, Sparkles, Shield, Zap, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  // If already authenticated, redirect (in effect to avoid setState-during-render)
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    setTimeout(() => {
      const success = login(email, password);
      if (success) {
        router.push("/dashboard");
      } else {
        setError("Invalid email or password. Try the demo credentials below.");
        setIsLoading(false);
      }
    }, 300);
  };

  const fillDemo = () => {
    setEmail("rajesh@tbo.com");
    setPassword("tbo2026");
    setError("");
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel — destination photography */}
      <div className="relative hidden overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/udaipur.webp" alt="The City Palace on Lake Pichola, Udaipur" className="absolute inset-0 size-full object-cover" />
        <div className="photo-scrim-panel absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-9" />
            <span className="font-display text-xl font-bold">tbo assemble</span>
          </div>

          <div className="max-w-lg">
            <h2 className="text-5xl font-bold leading-[1.02]">
              The operating system for <span className="text-ill-yellow">group travel</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/80">
              AI-powered hotel room block management for MICE events, destination weddings, and corporate retreats across India.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {[
                { icon: Sparkles, text: "AI contract parsing in 60s" },
                { icon: Shield, text: "Attrition protection" },
                { icon: Zap, text: "QR check-in microsites" },
              ].map((item) => (
                <li key={item.text} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-sm font-medium backdrop-blur-md">
                  <item.icon className="size-4 text-ill-yellow" /> {item.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-end justify-between gap-6">
            <figure className="max-w-sm rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <blockquote className="text-sm leading-relaxed text-white/90">&ldquo;What used to take me hours on Excel took minutes here.&rdquo;</blockquote>
              <figcaption className="mt-2 text-xs text-white/60">Priya Sharma · Wedding Planner, Jaipur</figcaption>
            </figure>
            <p className="text-xs text-white/50">VOYAGEHACK 3.0 · Team IIITDards</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-8" />
            <span className="font-display text-lg font-bold">tbo assemble</span>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-bold">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Legacy shared dashboard — not private. Do not enter customer data.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email address</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <><Loader2 className="animate-spin" /> Signing in…</>
              ) : (
                <><LogIn /> Sign in</>
              )}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">Legacy shared-dashboard credentials</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-mono text-[13px]">rajesh@tbo.com</dd>
              <dt className="text-muted-foreground">Password</dt>
              <dd className="font-mono text-[13px]">tbo2026</dd>
            </dl>
            <Button type="button" variant="outline" size="sm" onClick={fillDemo} className="mt-3">
              Auto-fill demo credentials
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground">
            <Link href="/" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Back to home
            </Link>
            <span>VOYAGEHACK 3.0 Prototype</span>
          </div>
        </div>
      </div>
    </div>
  );
}
