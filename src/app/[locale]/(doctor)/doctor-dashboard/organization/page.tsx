"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Crown,
  CreditCard,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  getMyOrganization,
  createOrganization,
  updateOrganization,
} from "@/actions/organization";

export default function OrganizationPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [license, setLicense] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Create org form state
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const result = await getMyOrganization();
    setOrg(result.org);
    setMembership(result.membership);
    setLicense(result.license);
    setMembers(result.members || []);
    setLoading(false);
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    const formData = new FormData();
    formData.set("name", orgName);

    startTransition(async () => {
      const result = await createOrganization(formData);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        await loadData();
        setSuccessMsg("Organization created successfully");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    });
  }

  async function handleUpdateOrg(formData: FormData) {
    setErrorMsg("");
    setSuccessMsg("");
    startTransition(async () => {
      const result = await updateOrganization(formData);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        await loadData();
        setSuccessMsg("Organization updated");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No org yet — show creation form
  if (!org) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Practice Settings</h1>
          <p className="text-muted-foreground">
            Set up your practice to manage your team and billing
          </p>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Create Your Practice
            </CardTitle>
            <CardDescription>
              Every doctor needs a practice profile. Solo practitioners and
              clinics alike use this to manage their platform presence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <Label htmlFor="org-name">Practice Name</Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Dr. Smith's Practice"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
              </div>
              {errorMsg && (
                <p className="text-sm text-red-500">{errorMsg}</p>
              )}
              <Button type="submit" disabled={isPending || !orgName.trim()}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Practice
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnerOrAdmin =
    membership?.role === "owner" || membership?.role === "admin";
  const activeMembers = members.filter((m: any) => m.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Practice Overview</h1>
        <p className="text-muted-foreground">
          Manage your practice details and team
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {errorMsg}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-blue-50 p-3 dark:bg-blue-950">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeMembers.length}</p>
              <p className="text-sm text-muted-foreground">Team Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-purple-50 p-3 dark:bg-purple-950">
              <Crown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold capitalize">
                {license?.tier || "No License"}
              </p>
              <p className="text-sm text-muted-foreground">Current Plan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-green-50 p-3 dark:bg-green-950">
              <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {license ? (
                  <Badge
                    variant={
                      license.status === "active" || license.status === "trialing"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {license.status}
                  </Badge>
                ) : (
                  "—"
                )}
              </p>
              <p className="text-sm text-muted-foreground">License Status</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Practice Details</CardTitle>
          <CardDescription>
            {isOwnerOrAdmin
              ? "Update your practice information"
              : "Your practice information"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOwnerOrAdmin ? (
            <form
              action={handleUpdateOrg}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="name">Practice Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={org.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={org.email || ""}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={org.phone || ""}
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  defaultValue={org.website || ""}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Practice Name</p>
                <p className="font-medium">{org.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{org.email || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{org.phone || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <p className="font-medium">{org.website || "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="cursor-pointer transition-colors hover:bg-accent/50">
          <Link href="/doctor-dashboard/organization/members">
            <CardContent className="flex items-center gap-3 p-5">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Team Members</p>
                <p className="text-sm text-muted-foreground">
                  Invite & manage your team
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-accent/50">
          <Link href="/doctor-dashboard/organization/billing">
            <CardContent className="flex items-center gap-3 p-5">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Billing & License</p>
                <p className="text-sm text-muted-foreground">
                  Plans, seats & payments
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-accent/50">
          <Link href="/doctor-dashboard/organization/settings">
            <CardContent className="flex items-center gap-3 p-5">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Practice Settings</p>
                <p className="text-sm text-muted-foreground">
                  Address, timezone, currency
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
        {/* Clinic-tier extras */}
        {license?.tier === "clinic" || license?.tier === "enterprise" ? (
          <>
            <Card className="cursor-pointer transition-colors hover:bg-accent/50">
              <Link href="/doctor-dashboard/organization/locations">
                <CardContent className="flex items-center gap-3 p-5">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Locations</p>
                    <p className="text-sm text-muted-foreground">
                      Manage clinic branches
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
            {isOwnerOrAdmin && (
              <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                <Link href="/doctor-dashboard/organization/bookings">
                  <CardContent className="flex items-center gap-3 p-5">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">All Appointments</p>
                      <p className="text-sm text-muted-foreground">
                        Manage clinic bookings
                      </p>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
