"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Pencil, Trash2, Loader2, Baby, Heart, UserCircle, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import {
  getDependents,
  addDependent,
  updateDependent,
  removeDependent,
  getDependentMedicalProfile,
  type DependentInput,
} from "@/actions/family";
import { DependentMedicalDialog } from "./dependent-medical-dialog";

const RELATIONSHIP_LABELS: Record<string, string> = {
  child: "Child",
  spouse: "Spouse/Partner",
  parent: "Parent",
  sibling: "Sibling",
  other: "Other",
};

const RELATIONSHIP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  child: Baby,
  spouse: Heart,
  parent: UserCircle,
  sibling: Users,
  other: UserCircle,
};

interface Dependent {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  relationship: string;
  notes: string | null;
  created_at: string;
}

export default function FamilyPage() {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Medical dialog state
  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false);
  const [medicalDependentId, setMedicalDependentId] = useState<string | null>(null);
  const [medicalDependentName, setMedicalDependentName] = useState("");
  const [dependentsWithMedical, setDependentsWithMedical] = useState<Set<string>>(new Set());

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [relationship, setRelationship] = useState<string>("child");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadDependents();
  }, []);

  async function loadDependents() {
    const data = await getDependents();
    setDependents(data);
    // Check which dependents have medical profiles
    const medicalSet = new Set<string>();
    await Promise.all(
      data.map(async (dep: Dependent) => {
        const profile = await getDependentMedicalProfile(dep.id);
        if (profile) medicalSet.add(dep.id);
      })
    );
    setDependentsWithMedical(medicalSet);
    setLoading(false);
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setDob("");
    setRelationship("child");
    setNotes("");
    setEditingId(null);
  }

  function openMedicalDialog(dep: Dependent) {
    setMedicalDependentId(dep.id);
    setMedicalDependentName(`${dep.first_name} ${dep.last_name}`);
    setMedicalDialogOpen(true);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(dep: Dependent) {
    setFirstName(dep.first_name);
    setLastName(dep.last_name);
    setDob(dep.date_of_birth || "");
    setRelationship(dep.relationship);
    setNotes(dep.notes || "");
    setEditingId(dep.id);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Name is required");
      return;
    }

    startTransition(async () => {
      const input: DependentInput = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob || null,
        relationship: relationship as DependentInput["relationship"],
        notes: notes.trim() || null,
      };

      if (editingId) {
        const result = await updateDependent(editingId, input);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Family member updated");
        }
      } else {
        const result = await addDependent(input);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Family member added");
        }
      }

      setDialogOpen(false);
      resetForm();
      loadDependents();
    });
  }

  function handleRemove(id: string) {
    if (!confirm("Remove this family member?")) return;

    startTransition(async () => {
      const result = await removeDependent(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Family member removed");
        loadDependents();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Family Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage dependents you can book appointments for
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Family Member" : "Add Family Member"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>First Name *</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Relationship *</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RELATIONSHIP_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any allergies, medical conditions, etc."
                  maxLength={500}
                  rows={3}
                />
              </div>
              <Button onClick={handleSave} disabled={isPending} className="w-full">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Update"
                ) : (
                  "Add Member"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {dependents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No family members yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your dependents to book appointments on their behalf
            </p>
            <Button className="mt-4" onClick={openAddDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Family Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dependents.map((dep) => {
            const Icon = RELATIONSHIP_ICONS[dep.relationship] || UserCircle;
            return (
              <Card key={dep.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2.5">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {dep.first_name} {dep.last_name}
                        </p>
                        <Badge variant="secondary" className="mt-0.5 text-xs">
                          {RELATIONSHIP_LABELS[dep.relationship] || dep.relationship}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openMedicalDialog(dep)}
                        title="Medical profile"
                      >
                        <HeartPulse className={`h-3.5 w-3.5 ${dependentsWithMedical.has(dep.id) ? "text-rose-500" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(dep)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemove(dep.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {dependentsWithMedical.has(dep.id) && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[10px] gap-1 text-rose-600 border-rose-200 bg-rose-50">
                        <HeartPulse className="h-3 w-3" />
                        Medical info
                      </Badge>
                    </div>
                  )}
                  {dep.date_of_birth && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Born: {new Date(dep.date_of_birth + "T00:00:00").toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {dep.notes && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {dep.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Medical Profile Dialog */}
      {medicalDependentId && (
        <DependentMedicalDialog
          dependentId={medicalDependentId}
          dependentName={medicalDependentName}
          open={medicalDialogOpen}
          onOpenChange={setMedicalDialogOpen}
          onSaved={() => {
            // Refresh to update badge
            setDependentsWithMedical((prev) => new Set([...prev, medicalDependentId]));
          }}
        />
      )}
    </div>
  );
}
