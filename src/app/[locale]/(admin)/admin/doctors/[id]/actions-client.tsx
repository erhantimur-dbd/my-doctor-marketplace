"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  updateDoctorVerification,
  toggleDoctorActive,
  toggleDoctorFeatured,
  sendUpgradeInvite,
} from "@/actions/admin";
import { CheckCircle, XCircle, Star, Ban, Shield, Mail } from "lucide-react";

export function AdminDoctorActions({
  doctorId,
  currentStatus,
  isActive,
  isFeatured,
  currentPlan,
}: {
  doctorId: string;
  currentStatus: string;
  isActive: boolean;
  isFeatured: boolean;
  currentPlan: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [active, setActive] = useState(isActive);
  const [featured, setFeatured] = useState(isFeatured);
  const [loading, setLoading] = useState("");

  async function handleVerify(newStatus: string) {
    setLoading(newStatus);
    const result = await updateDoctorVerification(doctorId, newStatus);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setStatus(newStatus);
      toast.success(`Doctor ${newStatus}`);
    }
    setLoading("");
  }

  async function handleToggleActive() {
    setLoading("active");
    const result = await toggleDoctorActive(doctorId, !active);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setActive(!active);
      toast.success(active ? "Doctor deactivated" : "Doctor activated");
    }
    setLoading("");
  }

  async function handleToggleFeatured() {
    setLoading("featured");
    const result = await toggleDoctorFeatured(doctorId, !featured);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setFeatured(!featured);
      toast.success(
        featured ? "Featured status removed" : "Doctor featured"
      );
    }
    setLoading("");
  }

  async function handleSendUpgradeInvite() {
    setLoading("invite");
    const result = await sendUpgradeInvite(doctorId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Upgrade invite sent successfully");
    }
    setLoading("");
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Verification</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={status === "verified" ? "default" : "outline"}
            size="sm"
            onClick={() => handleVerify("verified")}
            disabled={loading === "verified" || status === "verified"}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Verify
          </Button>
          <Button
            variant={status === "under_review" ? "default" : "outline"}
            size="sm"
            onClick={() => handleVerify("under_review")}
            disabled={loading === "under_review" || status === "under_review"}
          >
            <Shield className="mr-1 h-4 w-4" />
            Under Review
          </Button>
          <Button
            variant={status === "rejected" ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleVerify("rejected")}
            disabled={loading === "rejected" || status === "rejected"}
          >
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
          <Button
            variant={status === "suspended" ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleVerify("suspended")}
            disabled={loading === "suspended" || status === "suspended"}
          >
            <Ban className="mr-1 h-4 w-4" />
            Suspend
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div>
          <p className="mb-2 text-sm font-medium">Active Status</p>
          <Button
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={handleToggleActive}
            disabled={loading === "active"}
          >
            {active ? "Active" : "Inactive"} - Click to{" "}
            {active ? "Deactivate" : "Activate"}
          </Button>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Featured Status</p>
          <Button
            variant={featured ? "default" : "outline"}
            size="sm"
            onClick={handleToggleFeatured}
            disabled={loading === "featured"}
          >
            <Star className="mr-1 h-4 w-4" />
            {featured ? "Featured" : "Not Featured"} - Click to{" "}
            {featured ? "Remove" : "Feature"}
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Subscription</p>
        {currentPlan === "free" ? (
          <div className="flex items-center gap-3">
            <Badge variant="outline">Free Plan</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendUpgradeInvite}
              disabled={loading === "invite"}
            >
              <Mail className="mr-1 h-4 w-4" />
              {loading === "invite" ? "Sending..." : "Send Upgrade Invite"}
            </Button>
          </div>
        ) : (
          <Badge
            className={
              currentPlan === "professional"
                ? "bg-blue-600"
                : "capitalize"
            }
            variant={currentPlan === "professional" ? "default" : "secondary"}
          >
            {currentPlan}
          </Badge>
        )}
      </div>
    </div>
  );
}
