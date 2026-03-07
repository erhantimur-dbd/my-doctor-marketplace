"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Loader2 } from "lucide-react";
import { getPatientPaymentMethods } from "@/actions/patient";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

function brandDisplayName(brand: string) {
  const brands: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    diners: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return brands[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function SavedPaymentsSection() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await getPatientPaymentMethods();
        setMethods(result.methods);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Saved Payment Methods
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading payment methods...
          </div>
        ) : methods.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No saved payment methods. Payment methods are saved when you
            complete a booking.
          </p>
        ) : (
          <div className="space-y-3">
            {methods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {brandDisplayName(pm.brand)} ending in {pm.last4}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires{" "}
                    {String(pm.expMonth).padStart(2, "0")}/{pm.expYear}
                  </p>
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Payment methods are managed through Stripe. For security, editing
              is not available through this interface.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
