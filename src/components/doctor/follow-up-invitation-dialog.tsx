"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { createFollowUpInvitation } from "@/actions/follow-up";
import { formatCurrency, getBookingFeeCents } from "@/lib/utils/currency";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  consultation_type: string;
}

interface FollowUpInvitationDialogProps {
  patientId: string;
  patientName: string;
  doctorCurrency: string;
  services: Service[];
}

export function FollowUpInvitationDialog({
  patientId,
  patientName,
  doctorCurrency,
  services,
}: FollowUpInvitationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [serviceId, setServiceId] = useState<string>("");
  const [customServiceName, setCustomServiceName] = useState("");
  const [customPriceCents, setCustomPriceCents] = useState<number>(0);
  const [customPriceDisplay, setCustomPriceDisplay] = useState("");
  const [consultationType, setConsultationType] = useState<"in_person" | "video">("in_person");
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [totalSessions, setTotalSessions] = useState<number>(1);
  const [discountType, setDiscountType] = useState<string>("none");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountDisplay, setDiscountDisplay] = useState("");
  const [doctorNote, setDoctorNote] = useState("");

  const isCustom = serviceId === "custom";
  const selectedService = services.find((s) => s.id === serviceId);

  // Auto-fill from selected service
  const handleServiceChange = (value: string) => {
    setServiceId(value);
    if (value !== "custom") {
      const svc = services.find((s) => s.id === value);
      if (svc) {
        setConsultationType(svc.consultation_type === "both" ? "in_person" : svc.consultation_type as "in_person" | "video");
        setDurationMinutes(svc.duration_minutes);
      }
    }
  };

  // Price calculations
  const priceCalc = useMemo(() => {
    const unitPrice = isCustom
      ? customPriceCents
      : selectedService?.price_cents || 0;

    const subtotal = unitPrice * totalSessions;
    const platformFee = getBookingFeeCents(doctorCurrency) * totalSessions;

    let discountAmount = 0;
    if (discountType === "percentage" && discountValue > 0) {
      discountAmount = Math.round((subtotal * discountValue) / 100);
    } else if (discountType === "fixed_amount" && discountValue > 0) {
      discountAmount = discountValue;
    }

    const discountedTotal = Math.max(0, subtotal - discountAmount);
    const grandTotal = discountedTotal + platformFee;

    return { unitPrice, subtotal, platformFee, discountAmount, discountedTotal, grandTotal };
  }, [isCustom, customPriceCents, selectedService, totalSessions, discountType, discountValue, doctorCurrency]);

  const resetForm = () => {
    setServiceId("");
    setCustomServiceName("");
    setCustomPriceCents(0);
    setCustomPriceDisplay("");
    setConsultationType("in_person");
    setDurationMinutes(30);
    setTotalSessions(1);
    setDiscountType("none");
    setDiscountValue(0);
    setDiscountDisplay("");
    setDoctorNote("");
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createFollowUpInvitation({
        patient_id: patientId,
        service_id: isCustom ? null : serviceId || null,
        custom_service_name: isCustom ? customServiceName : null,
        custom_price_cents: isCustom ? customPriceCents : null,
        consultation_type: consultationType,
        duration_minutes: durationMinutes,
        total_sessions: totalSessions,
        discount_type: discountType === "none" ? null : discountType as "percentage" | "fixed_amount",
        discount_value: discountType === "none" ? null : discountValue,
        doctor_note: doctorNote || null,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Follow-up invitation sent successfully!");
        setOpen(false);
        resetForm();
      }
    });
  };

  const canSubmit =
    (isCustom ? customServiceName.length > 0 && customPriceCents >= 100 : !!serviceId) &&
    priceCalc.unitPrice > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          Follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Follow-Up Invitation</DialogTitle>
          <DialogDescription>
            Invite {patientName} for a follow-up consultation with pricing and treatment plan details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label>Service</Label>
            <Select value={serviceId} onValueChange={handleServiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a service..." />
              </SelectTrigger>
              <SelectContent>
                {services.map((svc) => (
                  <SelectItem key={svc.id} value={svc.id}>
                    {svc.name} — {formatCurrency(svc.price_cents, doctorCurrency)}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom service fields */}
          {isCustom && (
            <>
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input
                  placeholder="e.g. ECG Review, Follow-up Checkup"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>Price ({doctorCurrency})</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min={1}
                  step={0.01}
                  value={customPriceDisplay}
                  onChange={(e) => {
                    setCustomPriceDisplay(e.target.value);
                    setCustomPriceCents(Math.round(parseFloat(e.target.value || "0") * 100));
                  }}
                />
              </div>
            </>
          )}

          {/* Consultation Type */}
          <div className="space-y-2">
            <Label>Consultation Type</Label>
            <Select
              value={consultationType}
              onValueChange={(v) => setConsultationType(v as "in_person" | "video")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In-Person</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select
              value={String(durationMinutes)}
              onValueChange={(v) => setDurationMinutes(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Number of Sessions */}
          <div className="space-y-2">
            <Label>Number of Sessions</Label>
            <Select
              value={String(totalSessions)}
              onValueChange={(v) => setTotalSessions(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} session{n > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Discount</Label>
              <Select value={discountType} onValueChange={(v) => { setDiscountType(v); setDiscountValue(0); setDiscountDisplay(""); }}>
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
            {discountType !== "none" && (
              <div className="space-y-2">
                <Label>{discountType === "percentage" ? "Percentage" : `Amount (${doctorCurrency})`}</Label>
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
          </div>

          {/* Doctor Note */}
          <div className="space-y-2">
            <Label>Note to Patient (optional)</Label>
            <Textarea
              placeholder="e.g. Please book your follow-up ECG review within the next 2 weeks..."
              value={doctorNote}
              onChange={(e) => setDoctorNote(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>

          {/* Price Preview */}
          {priceCalc.unitPrice > 0 && (
            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-1.5">
              <p className="font-semibold text-base mb-2">Price Summary</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {formatCurrency(priceCalc.unitPrice, doctorCurrency)} × {totalSessions} session{totalSessions > 1 ? "s" : ""}
                </span>
                <span>{formatCurrency(priceCalc.subtotal, doctorCurrency)}</span>
              </div>
              {priceCalc.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−{formatCurrency(priceCalc.discountAmount, doctorCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Platform fee ({totalSessions}×)</span>
                <span>{formatCurrency(priceCalc.platformFee, doctorCurrency)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Total (patient pays)</span>
                <span>{formatCurrency(priceCalc.grandTotal, doctorCurrency)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit} className="gap-2">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
