"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Receipt, Loader2, X } from "lucide-react";
import { createInvoice } from "@/actions/invoices";
import { formatCurrency, getBookingFeeCents } from "@/lib/utils/currency";
import { toast } from "sonner";
import { MEDICAL_TEST_GROUPS } from "@/lib/constants/medical-tests";

const ALL_TESTS = MEDICAL_TEST_GROUPS.flatMap((g) => g.tests);

interface Service {
  id: string;
  name: string;
  price_cents: number;
}

interface PriceBookEntry {
  test_id: string;
  price_cents: number;
}

interface LineItem {
  key: number;
  name: string;
  priceCents: number;
  priceDisplay: string;
  quantity: number;
}

interface CreateInvoiceDialogProps {
  patientId: string;
  patientName: string;
  doctorCurrency: string;
  services: Service[];
  priceBook?: PriceBookEntry[];
}

let keyCounter = 0;

export function CreateInvoiceDialog({
  patientId,
  patientName,
  doctorCurrency,
  services,
  priceBook = [],
}: CreateInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<LineItem[]>([]);
  const [addSelection, setAddSelection] = useState("");
  const [discountType, setDiscountType] = useState<string>("none");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountDisplay, setDiscountDisplay] = useState("");
  const [dueDays, setDueDays] = useState("14");
  const [doctorNote, setDoctorNote] = useState("");

  const priceBookMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of priceBook) m.set(e.test_id, e.price_cents);
    return m;
  }, [priceBook]);

  function handleAddItem(value: string) {
    if (!value) return;
    setAddSelection("");
    const newKey = ++keyCounter;

    if (value === "custom") {
      setItems((prev) => [...prev, { key: newKey, name: "", priceCents: 0, priceDisplay: "", quantity: 1 }]);
      return;
    }

    const svc = services.find((s) => s.id === value);
    if (svc) {
      setItems((prev) => [...prev, { key: newKey, name: svc.name, priceCents: svc.price_cents, priceDisplay: String(svc.price_cents / 100), quantity: 1 }]);
      return;
    }

    if (value.startsWith("test_")) {
      const test = ALL_TESTS.find((t) => t.id === value);
      if (test) {
        const bookPrice = priceBookMap.get(value) ?? 0;
        setItems((prev) => [...prev, { key: newKey, name: test.name, priceCents: bookPrice, priceDisplay: bookPrice > 0 ? String(bookPrice / 100) : "", quantity: 1 }]);
      }
    }
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItemPrice(key: number, display: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, priceDisplay: display, priceCents: Math.round(parseFloat(display || "0") * 100) }
          : item
      )
    );
  }

  function updateItemName(key: number, name: string) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, name } : item)));
  }

  function updateItemQuantity(key: number, quantity: number) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, quantity } : item)));
  }

  const priceCalc = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    const platformFee = getBookingFeeCents(doctorCurrency);

    let discountAmount = 0;
    if (discountType === "percentage" && discountValue > 0) {
      discountAmount = Math.round((subtotal * discountValue) / 100);
    } else if (discountType === "fixed_amount" && discountValue > 0) {
      discountAmount = discountValue;
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const total = afterDiscount + platformFee;

    return { subtotal, platformFee, discountAmount, afterDiscount, total };
  }, [items, discountType, discountValue, doctorCurrency]);

  const resetForm = () => {
    setItems([]);
    setAddSelection("");
    setDiscountType("none");
    setDiscountValue(0);
    setDiscountDisplay("");
    setDueDays("14");
    setDoctorNote("");
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createInvoice({
        patient_id: patientId,
        items: items.map((i) => ({ name: i.name, price_cents: i.priceCents, quantity: i.quantity })),
        discount_type: discountType === "none" ? null : (discountType as "percentage" | "fixed_amount"),
        discount_value: discountType === "none" ? null : discountValue,
        due_days: parseInt(dueDays),
        doctor_note: doctorNote || null,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invoice sent successfully!");
        setOpen(false);
        resetForm();
      }
    });
  };

  const canSubmit = items.length > 0 && items.every((i) => i.name.length > 0 && i.priceCents >= 100) && priceCalc.subtotal > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Receipt className="h-3.5 w-3.5" />
          Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Send an invoice to {patientName} for services or tests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Items */}
          <div className="space-y-2">
            <Label>Add Services / Tests</Label>
            <Select value={addSelection} onValueChange={handleAddItem}>
              <SelectTrigger>
                <SelectValue placeholder="Select a service or test to add..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {services.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Your Services</SelectLabel>
                    {services.map((svc) => (
                      <SelectItem key={svc.id} value={svc.id}>
                        {svc.name} — {formatCurrency(svc.price_cents, doctorCurrency)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {MEDICAL_TEST_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.tests.map((test) => {
                      const bookPrice = priceBookMap.get(test.id);
                      return (
                        <SelectItem key={test.id} value={test.id}>
                          {test.name}
                          {bookPrice ? ` — ${formatCurrency(bookPrice, doctorCurrency)}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel>Other</SelectLabel>
                  <SelectItem value="custom">Custom Item</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Line Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Line Items</Label>
              {items.map((item) => (
                <div key={item.key} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Service / test name"
                        value={item.name}
                        onChange={(e) => updateItemName(item.key, e.target.value)}
                        maxLength={200}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeItem(item.key)}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{doctorCurrency}</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        min={0}
                        step={0.01}
                        className="h-8 pl-12 text-sm"
                        value={item.priceDisplay}
                        onChange={(e) => updateItemPrice(item.key, e.target.value)}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">×</span>
                    <Select value={String(item.quantity)} onValueChange={(v) => updateItemQuantity(item.key, parseInt(v))}>
                      <SelectTrigger className="h-8 w-16 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm font-medium w-20 text-right shrink-0">
                      {formatCurrency(item.priceCents * item.quantity, doctorCurrency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && <Separator />}

          {/* Due Date & Discount */}
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payment Due</Label>
                <Select value={dueDays} onValueChange={setDueDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount</Label>
                <Select
                  value={discountType}
                  onValueChange={(v) => { setDiscountType(v); setDiscountValue(0); setDiscountDisplay(""); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Discount</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {discountType !== "none" && (
            <div className="space-y-2">
              <Label>{discountType === "percentage" ? "Discount Percentage" : `Discount Amount (${doctorCurrency})`}</Label>
              <Input
                type="number"
                min={0}
                max={discountType === "percentage" ? 100 : undefined}
                value={discountDisplay}
                onChange={(e) => {
                  setDiscountDisplay(e.target.value);
                  const val = parseFloat(e.target.value || "0");
                  if (discountType === "percentage") {
                    setDiscountValue(Math.min(100, Math.max(0, Math.round(val))));
                  } else {
                    setDiscountValue(Math.round(val * 100));
                  }
                }}
              />
            </div>
          )}

          {/* Note */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Note to Patient (optional)</Label>
              <Textarea
                placeholder="e.g. Payment for lab tests conducted on..."
                value={doctorNote}
                onChange={(e) => setDoctorNote(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>
          )}

          {/* Price Summary */}
          {priceCalc.subtotal > 0 && (
            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-1.5">
              <p className="font-semibold text-base mb-2">Invoice Summary</p>
              {items.map((item) => (
                <div key={item.key} className="flex justify-between">
                  <span className="text-muted-foreground truncate mr-2">
                    {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </span>
                  <span className="shrink-0">{formatCurrency(item.priceCents * item.quantity, doctorCurrency)}</span>
                </div>
              ))}
              {priceCalc.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−{formatCurrency(priceCalc.discountAmount, doctorCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Platform fee</span>
                <span>{formatCurrency(priceCalc.platformFee, doctorCurrency)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Total (patient pays)</span>
                <span>{formatCurrency(priceCalc.total, doctorCurrency)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit} className="gap-2">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
            ) : (
              <><Receipt className="h-4 w-4" />Send Invoice</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
