"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { toggleCouponActive, deleteCoupon } from "@/actions/admin";
import { Power, Trash2 } from "lucide-react";

export function CouponActionsClient({
  couponId,
  isActive,
}: {
  couponId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState("");

  async function handleToggleActive() {
    setLoading("toggle");
    const result = await toggleCouponActive(couponId, !active);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setActive(!active);
      toast.success(active ? "Coupon deactivated" : "Coupon activated");
    }
    setLoading("");
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this coupon? This cannot be undone.")) {
      return;
    }
    setLoading("delete");
    const result = await deleteCoupon(couponId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Coupon deleted");
      router.push("/en/admin/coupons");
    }
    setLoading("");
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant={active ? "outline" : "default"}
        size="sm"
        onClick={handleToggleActive}
        disabled={loading === "toggle"}
      >
        <Power className="mr-1 h-4 w-4" />
        {active ? "Deactivate" : "Activate"}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={loading === "delete"}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        Delete
      </Button>
    </div>
  );
}
