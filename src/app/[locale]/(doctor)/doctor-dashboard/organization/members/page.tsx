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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Loader2,
  MoreHorizontal,
  Crown,
  Shield,
  Stethoscope,
  User,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getMyOrganization,
  inviteMember,
  removeMember,
  updateMemberRole,
  transferOwnership,
} from "@/actions/organization";

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  doctor: Stethoscope,
  staff: User,
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  doctor: "Doctor",
  staff: "Staff",
};

export default function MembersPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [license, setLicense] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

  function showMessage(msg: string, isError = false) {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  }

  async function handleInvite(formData: FormData) {
    startTransition(async () => {
      const result = await inviteMember(formData);
      if (result.error) {
        showMessage(result.error, true);
      } else {
        setInviteOpen(false);
        await loadData();
        showMessage("Invitation sent");
      }
    });
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    const formData = new FormData();
    formData.set("member_id", memberId);
    startTransition(async () => {
      const result = await removeMember(formData);
      if (result.error) {
        showMessage(result.error, true);
      } else {
        await loadData();
        showMessage("Member removed");
      }
    });
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    const formData = new FormData();
    formData.set("member_id", memberId);
    formData.set("role", newRole);
    startTransition(async () => {
      const result = await updateMemberRole(formData);
      if (result.error) {
        showMessage(result.error, true);
      } else {
        await loadData();
        showMessage("Role updated");
      }
    });
  }

  async function handleTransfer() {
    if (!transferTarget) return;
    const formData = new FormData();
    formData.set("new_owner_id", transferTarget);
    startTransition(async () => {
      const result = await transferOwnership(formData);
      if (result.error) {
        showMessage(result.error, true);
      } else {
        setTransferOpen(false);
        await loadData();
        showMessage("Ownership transferred");
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

  if (!org) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        No organization found. Please set up your practice first.
      </div>
    );
  }

  const isOwner = membership?.role === "owner";
  const isOwnerOrAdmin =
    membership?.role === "owner" || membership?.role === "admin";
  const activeMembers = members.filter(
    (m: any) => m.status === "active" || m.status === "invited"
  );
  const seatInfo = license
    ? `${license.used_seats} / ${license.max_seats} seats used`
    : "No license";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">{seatInfo}</p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Members List */}
      <Card>
        <CardContent className="divide-y p-0">
          {activeMembers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Users className="mr-2 h-5 w-5" />
              No team members yet
            </div>
          ) : (
            activeMembers.map((member: any) => {
              const profile = Array.isArray(member.profile)
                ? member.profile[0]
                : member.profile;
              const RoleIcon = ROLE_ICONS[member.role] || User;
              const name =
                profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : profile?.email || "Unknown";

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <RoleIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        member.status === "active" ? "default" : "secondary"
                      }
                    >
                      {member.status === "invited"
                        ? "Pending"
                        : ROLE_LABELS[member.role] || member.role}
                    </Badge>
                    {isOwnerOrAdmin && member.role !== "owner" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isOwner && member.status === "active" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(
                                    member.id,
                                    member.role === "admin" ? "doctor" : "admin"
                                  )
                                }
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                {member.role === "admin"
                                  ? "Demote to Doctor"
                                  : "Promote to Admin"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setTransferTarget(member.user_id);
                                  setTransferOpen(true);
                                }}
                              >
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Transfer Ownership
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleRemove(member.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <form action={handleInvite} className="space-y-4">
            <div>
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="doctor@example.com"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The user must already have an account on MyDoctors360
              </p>
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select name="role" defaultValue="doctor">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will transfer full ownership of the organization to the
            selected member. You will be demoted to Admin. This action cannot be
            easily undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleTransfer}
              disabled={isPending}
            >
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
