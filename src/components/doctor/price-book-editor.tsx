"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import { MEDICAL_TEST_GROUPS } from "@/lib/constants/medical-tests";
import {
  getPriceBook,
  savePriceBookEntries,
  deletePriceBookEntry,
  type PriceBookEntry,
} from "@/actions/price-book";
import { centsToAmount, amountToCents, formatCurrency } from "@/lib/utils/currency";
import { toast } from "sonner";

// Flat lookup for test names
const ALL_TESTS = MEDICAL_TEST_GROUPS.flatMap((g) =>
  g.tests.map((t) => ({ ...t, group: g.label }))
);

interface PriceBookEditorProps {
  doctorCurrency: string;
}

interface LocalEntry {
  test_id: string;
  price_cents: number;
  displayPrice: string;
}

export function PriceBookEditor({ doctorCurrency }: PriceBookEditorProps) {
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addTestId, setAddTestId] = useState("");

  useEffect(() => {
    loadPriceBook();
  }, []);

  async function loadPriceBook() {
    const result = await getPriceBook();
    if (result.entries) {
      setEntries(
        result.entries.map((e) => ({
          test_id: e.test_id,
          price_cents: e.price_cents,
          displayPrice: String(centsToAmount(e.price_cents)),
        }))
      );
    }
    setLoading(false);
  }

  const usedTestIds = useMemo(() => new Set(entries.map((e) => e.test_id)), [entries]);

  function handleAddTest(testId: string) {
    if (!testId || usedTestIds.has(testId)) return;
    setEntries((prev) => [
      ...prev,
      { test_id: testId, price_cents: 0, displayPrice: "" },
    ]);
    setAddTestId("");
  }

  function handlePriceChange(index: number, value: string) {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        displayPrice: value,
        price_cents: amountToCents(parseFloat(value) || 0),
      };
      return updated;
    });
  }

  async function handleRemove(index: number) {
    const entry = entries[index];
    // If it was saved, delete from DB
    await deletePriceBookEntry(entry.test_id);
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const validEntries = entries.filter((e) => e.price_cents > 0);
    if (validEntries.length === 0) {
      toast.error("Please set at least one price.");
      return;
    }

    setSaving(true);
    setSaved(false);
    const result = await savePriceBookEntries(
      validEntries.map((e) => ({ test_id: e.test_id, price_cents: e.price_cents }))
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      setSaved(true);
      toast.success("Price book saved.");
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  function getTestName(testId: string) {
    return ALL_TESTS.find((t) => t.id === testId)?.name ?? testId;
  }

  function getTestGroup(testId: string) {
    return ALL_TESTS.find((t) => t.id === testId)?.group ?? "";
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Price Book
          </CardTitle>
          <CardDescription>
            Set default prices for medical tests and procedures. These auto-fill
            when creating follow-up invitations.
          </CardDescription>
        </div>
        {entries.length > 0 && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? "Saved" : "Save Prices"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add test selector */}
        <div className="flex gap-2">
          <Select value={addTestId} onValueChange={handleAddTest}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Add a test or procedure..." />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {MEDICAL_TEST_GROUPS.map((group) => {
                const available = group.tests.filter((t) => !usedTestIds.has(t.id));
                if (available.length === 0) return null;
                return (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {available.map((test) => (
                      <SelectItem key={test.id} value={test.id}>
                        {test.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Entries list */}
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No prices set yet. Add tests above to build your price book.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div
                key={entry.test_id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {getTestName(entry.test_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getTestGroup(entry.test_id)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {doctorCurrency}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="h-8 pl-12 text-sm"
                      placeholder="0.00"
                      value={entry.displayPrice}
                      onChange={(e) => handlePriceChange(index, e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleRemove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saved ? "Saved" : "Save Prices"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
