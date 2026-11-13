"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Bell, Clock, IndianRupee, Send, Check, TrendingDown, Shield, MessageCircle, Zap } from "lucide-react";
import { WhatsAppSimulator } from "./whatsapp-simulator";

interface AttritionRule {
  id: string;
  releaseDate: string;
  releasePercent: number;
  description: string | null;
  isTriggered: boolean;
}

interface AttritionClientProps {
  eventId: string;
  eventSlug: string;
  eventName: string;
  rules: AttritionRule[];
  totalRooms: number;
  bookedRooms: number;
  ratePerRoom: number;
  pendingGuests: number;
}

export default function AttritionClient({
  eventId,
  eventSlug,
  eventName,
  rules,
  totalRooms,
  bookedRooms,
  ratePerRoom,
  pendingGuests,
}: AttritionClientProps) {
  const [nudgeSent, setNudgeSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppMessages, setWhatsAppMessages] = useState<{ text: string; isOutgoing?: boolean }[]>([]);
  const [autoTriggering, setAutoTriggering] = useState(false);

  const unsoldRooms = totalRooms - bookedRooms;
  const occupancyPct = totalRooms > 0 ? Math.round((bookedRooms / totalRooms) * 100) : 0;

  const getDaysUntil = (date: string) => {
    const now = new Date();
    const target = new Date(date);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const URGENCY_BORDER: Record<string, string> = {
    "bg-red-500": "border-red-500",
    "bg-amber-500": "border-amber-500",
    "bg-yellow-500": "border-yellow-500",
    "bg-green-500": "border-green-500",
  };

  const getUrgency = (daysLeft: number) => {
    if (daysLeft <= 0) return { color: "bg-red-500", text: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", label: "OVERDUE" };
    if (daysLeft <= 2) return { color: "bg-red-500", text: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", label: "CRITICAL" };
    if (daysLeft <= 7) return { color: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", label: "URGENT" };
    if (daysLeft <= 14) return { color: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/20", label: "WARNING" };
    return { color: "bg-green-500", text: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20", label: "ON TRACK" };
  };

  const handleNudge = async (ruleId: string) => {
    setSending(ruleId);
    try {
      await fetch(`/api/events/${eventId}/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      });
      setNudgeSent((prev) => new Set(prev).add(ruleId));
      
      // Show WhatsApp simulator preview
      const rule = rules.find((r) => r.id === ruleId);
      if (rule) {
        const daysLeft = getDaysUntil(rule.releaseDate);
        setWhatsAppMessages([
          {
            text: `🏨 *${eventName} — Room Booking Reminder*\n\nHi! This is a friendly reminder that the room block deadline is approaching.\n\n⏰ *${daysLeft} days left* before ${rule.releasePercent}% of unsold rooms are released.\n\n📋 Secure your room now to avoid missing out!`,
            isOutgoing: true,
          },
          {
            text: `💰 Current rate: ₹${ratePerRoom.toLocaleString("en-IN")}/night\n\n🔗 Book here: ${typeof window !== "undefined" ? window.location.origin : ""}/event/${eventSlug}`,
            isOutgoing: true,
          },
        ]);
        setShowWhatsApp(true);
      }
    } catch (e) {
      console.error(e);
    }
    setSending(null);
  };

  const handleAutoTrigger = async () => {
    setAutoTriggering(true);
    // Auto-trigger nudges for all rules with <= 3 days left
    const urgentRules = rules.filter((r) => {
      const daysLeft = getDaysUntil(r.releaseDate);
      return !r.isTriggered && daysLeft <= 3 && !nudgeSent.has(r.id);
    });
    for (const rule of urgentRules) {
      await handleNudge(rule.id);
    }
    setAutoTriggering(false);
  };

  return (
    <div className="animate-fade-in">
      {/* WhatsApp Simulator */}
      {showWhatsApp && (
        <WhatsAppSimulator
          recipientName="Pending Guests"
          recipientPhone={`${pendingGuests} recipients`}
          messages={whatsAppMessages}
          onClose={() => setShowWhatsApp(false)}
        />
      )}

      {/* Auto-Trigger Banner */}
      {rules.some((r) => !r.isTriggered && getDaysUntil(r.releaseDate) <= 3) && (
        <div className="mb-6 p-4 border rounded-xl flex items-center justify-between flex-wrap gap-3 bg-muted/40">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Critical deadlines approaching!</p>
              <p className="text-xs text-red-600 dark:text-red-400">Auto-trigger nudges for all urgent rules</p>
            </div>
          </div>
          <Button
            onClick={handleAutoTrigger}
            disabled={autoTriggering}
            size="sm"
            className="gap-1.5 bg-red-600 hover:bg-red-700"
          >
            <Zap className="h-3.5 w-3.5" />
            {autoTriggering ? "Triggering..." : "Auto-Trigger All"}
          </Button>
        </div>
      )}

      {/* Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Occupancy</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{occupancyPct}%</p>
            <Progress value={occupancyPct} className="mt-3 h-2" indicatorClassName={occupancyPct > 80 ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-amber-500 to-orange-500"} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Unsold Rooms</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-amber-600">{unsoldRooms}</p>
            <p className="text-xs text-muted-foreground mt-4">of {totalRooms} total</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">At-Risk Revenue</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-red-600">
              ₹{(unsoldRooms * ratePerRoom).toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-muted-foreground mt-4">Potential attrition liability</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Pending Guests</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <Bell className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-purple-600">{pendingGuests}</p>
            <p className="text-xs text-muted-foreground mt-4">Can be nudged to book</p>
          </CardContent>
        </Card>
      </div>

      {/* Attrition Timeline */}
      <Card className="mb-8 overflow-hidden">
        <CardHeader className="border-b bg-muted/40">
          <CardTitle className="flex items-center gap-3 text-base font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
              <Clock className="h-4 w-4" />
            </div>
            Attrition Release Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-amber-200 dark:from-amber-800 to-gray-200 dark:to-zinc-700" />

            <div className="space-y-6">
              {rules.map((rule, index) => {
                const daysLeft = getDaysUntil(rule.releaseDate);
                const urgency = getUrgency(daysLeft);
                const roomsAtRisk = Math.ceil(unsoldRooms * (rule.releasePercent / 100));
                const revenueAtRisk = roomsAtRisk * ratePerRoom;
                const wasSent = nudgeSent.has(rule.id);

                return (
                  <div key={rule.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className={`relative z-10 h-12 w-12 rounded-xl ${urgency.bg} flex items-center justify-center shrink-0 border ${rule.isTriggered ? "border-border" : URGENCY_BORDER[urgency.color] || "border-gray-500"}`}>
                      <div className={`h-4 w-4 rounded-full ${urgency.color}`} />
                    </div>

                    {/* Content */}
                    <div className={`flex-1 p-4 rounded-xl border transition-all ${rule.isTriggered ? "bg-gray-50/50 dark:bg-zinc-800/30 border-border opacity-60" : `${urgency.bg} border-gray-200/80 dark:border-zinc-700/80 shadow-sm`}`}>
                      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground">
                              Release {rule.releasePercent}% of Unsold Rooms
                            </h3>
                            <Badge variant={rule.isTriggered ? "secondary" : daysLeft <= 7 ? "destructive" : "warning"}>
                              {rule.isTriggered ? "TRIGGERED" : urgency.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(rule.releaseDate).toLocaleDateString("en-IN", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                            {!rule.isTriggered && (
                              <span className={`ml-2 font-semibold ${urgency.text}`}>
                                {daysLeft > 0 ? `(${daysLeft} days left)` : daysLeft === 0 ? "(Today!)" : `(${Math.abs(daysLeft)} days overdue)`}
                              </span>
                            )}
                          </p>
                        </div>

                        {!rule.isTriggered && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                const daysLeft = getDaysUntil(rule.releaseDate);
                                setWhatsAppMessages([
                                  {
                                    text: `🏨 *${eventName} — Preview*\n\nHi! Deadline in *${daysLeft} days*.\n${rule.releasePercent}% rooms at risk.\n\n₹${ratePerRoom.toLocaleString("en-IN")}/night`,
                                    isOutgoing: true,
                                  },
                                ]);
                                setShowWhatsApp(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> Preview
                            </Button>
                            <Button
                              onClick={() => handleNudge(rule.id)}
                              disabled={sending === rule.id || wasSent}
                              variant={wasSent ? "secondary" : "default"}
                              size="sm"
                              className="gap-1.5"
                            >
                            {wasSent ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> Nudges Sent
                              </>
                            ) : sending === rule.id ? (
                              "Sending..."
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5" /> Send Nudges
                              </>
                            )}
                          </Button>
                          </div>
                        )}
                      </div>

                      {!rule.isTriggered && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 pt-3 border-t border-border">
                          <div className="bg-card rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Rooms at Risk</p>
                            <p className="text-lg font-bold text-amber-600">{roomsAtRisk}</p>
                          </div>
                          <div className="bg-card rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Revenue at Risk</p>
                            <p className="text-lg font-bold text-red-600">
                              ₹{revenueAtRisk.toLocaleString("en-IN")}
                            </p>
                          </div>
                          <div className="bg-card rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Action</p>
                            <p className="text-sm font-medium text-foreground">{rule.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Risk Meter */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/40">
          <CardTitle className="flex items-center gap-3 text-base font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
              <Shield className="h-4 w-4" />
            </div>
            Revenue Protection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-muted-foreground font-medium">Secured Revenue</span>
                <span className="font-bold text-emerald-600">
                  ₹{(bookedRooms * ratePerRoom).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="h-8 bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden flex shadow-inner">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-l-xl transition-all flex items-center justify-center"
                  style={{ width: `${occupancyPct}%` }}
                >
                  <span className="text-xs text-white font-semibold">
                    {occupancyPct}% Booked
                  </span>
                </div>
                <div
                  className="bg-gradient-to-r from-amber-400 to-orange-400 transition-all flex items-center justify-center"
                  style={{ width: `${100 - occupancyPct}%` }}
                >
                  <span className="text-xs text-white font-semibold">
                    {100 - occupancyPct}% At Risk
                  </span>
                </div>
              </div>
              <div className="flex justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                  <span className="text-xs text-muted-foreground">Secured</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                  <span className="text-xs text-muted-foreground">At Risk</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
