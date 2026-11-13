"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Percent, Plus, Loader2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface DiscountRule {
  id: string;
  minRooms: number;
  discountPct: number;
  description: string | null;
  isActive: boolean;
}

interface DiscountRulesClientProps {
  eventId: string;
  initialRules: DiscountRule[];
}

export function DiscountRulesClient({ eventId, initialRules }: DiscountRulesClientProps) {
  const [rules, setRules] = useState<DiscountRule[]>(initialRules);
  const [minRooms, setMinRooms] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirmDeleteId !== ruleId) {
      setConfirmDeleteId(ruleId);
      setTimeout(() => setConfirmDeleteId(null), 3000); // auto-cancel after 3s
      return;
    }
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/events/${eventId}/discount?id=${ruleId}`, { method: "DELETE" });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        showToast("Discount rule deleted");
      }
    } catch {
      showToast("Failed to delete rule");
    }
  };

  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/events/${eventId}/discount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId, isActive: !currentActive }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, isActive: !currentActive } : r))
        );
        showToast(`Rule ${!currentActive ? "activated" : "deactivated"}`);
      }
    } catch {
      showToast("Failed to update rule");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minRooms || !discountPct) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minRooms: parseInt(minRooms),
          discountPct: parseInt(discountPct),
          description: description || null,
        }),
      });
      if (res.ok) {
        const newRule = await res.json();
        setRules((prev) => [...prev, newRule]);
        setMinRooms("");
        setDiscountPct("");
        setDescription("");
        showToast("Discount rule created successfully");
      } else {
        showToast("Failed to create discount rule");
      }
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
              <Percent className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Discount Rules</CardTitle>
              <p className="text-[10px] text-muted-foreground">Volume-based discounts for group bookings</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {/* Existing Rules */}
          {rules.length > 0 ? (
            <div className="space-y-2 mb-5">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-foreground">
                      <Percent className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Book {rule.minRooms}+ rooms &rarr; {rule.discountPct}% off
                      </p>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={rule.isActive ? "success" : "secondary"}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleToggleRule(rule.id, rule.isActive)}
                      className="text-muted-foreground hover:text-violet-600 transition-colors p-1"
                      title={rule.isActive ? "Deactivate rule" : "Activate rule"}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className={`transition-colors p-1 ${confirmDeleteId === rule.id ? "text-red-600 dark:text-red-400" : "text-muted-foreground hover:text-red-600"}`}
                      title={confirmDeleteId === rule.id ? "Click again to confirm" : "Delete rule"}
                    >
                      {confirmDeleteId === rule.id ? (
                        <span className="text-xs font-semibold">Confirm?</span>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 mb-5">
              <Percent className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No discount rules configured</p>
            </div>
          )}

          {/* Add New Rule Form */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Add New Rule
            </h4>
            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-muted-foreground mb-1 block">Min Rooms</label>
                <input
                  type="number"
                  min="1"
                  value={minRooms}
                  onChange={(e) => setMinRooms(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-muted-foreground mb-1 block">Discount %</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Early bird group discount"
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <Button type="submit" disabled={saving || !minRooms || !discountPct} size="sm" className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Rule
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-green-600 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </>
  );
}
