"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  createClinicLocation,
  updateClinicLocation,
  deactivateClinicLocation,
  setDoctorLocations,
} from "@/actions/clinic-locations";

interface Props {
  org: any;
  locations: any[];
  orgDoctors: any[];
  assignments: { doctor_id: string; clinic_location_id: string; is_active: boolean }[];
  locale: string;
}

export function LocationsClient({ org, locations: initialLocations, orgDoctors, assignments: initialAssignments, locale }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locations, setLocations] = useState(initialLocations);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Location form dialog
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [locForm, setLocForm] = useState({
    name: "", address_line1: "", city: "", postal_code: "", phone: "", email: "", is_primary: false,
  });

  // Doctor assignment dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningDoctor, setAssigningDoctor] = useState<any | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  function openAddLocation() {
    setEditingLocation(null);
    setLocForm({ name: "", address_line1: "", city: "", postal_code: "", phone: "", email: "", is_primary: false });
    setShowLocationDialog(true);
  }

  function openEditLocation(loc: any) {
    setEditingLocation(loc);
    setLocForm({
      name: loc.name,
      address_line1: loc.address_line1 ?? "",
      city: loc.city ?? "",
      postal_code: loc.postal_code ?? "",
      phone: loc.phone ?? "",
      email: loc.email ?? "",
      is_primary: loc.is_primary,
    });
    setShowLocationDialog(true);
  }

  function openAssignDoctor(doctor: any) {
    const currentLocs = assignments
      .filter((a) => a.doctor_id === doctor.id && a.is_active)
      .map((a) => a.clinic_location_id);
    setAssigningDoctor(doctor);
    setSelectedLocationIds(currentLocs);
    setShowAssignDialog(true);
  }

  async function saveLocation() {
    setError(null);
    const fd = new FormData();
    Object.entries(locForm).forEach(([k, v]) => fd.set(k, String(v)));
    if (editingLocation) fd.set("location_id", editingLocation.id);

    const result = editingLocation
      ? await updateClinicLocation(fd)
      : await createClinicLocation(fd);

    if (result.error) { setError(result.error); return; }

    setShowLocationDialog(false);
    setSuccess(editingLocation ? "Location updated" : "Location added");
    router.refresh();
    setTimeout(() => setSuccess(null), 3000);
  }

  async function deactivate(locationId: string, locationName: string) {
    if (!confirm(`Deactivate "${locationName}"? This will also remove all doctor assignments to this location.`)) return;
    setError(null);
    const result = await deactivateClinicLocation(locationId);
    if (result.error) { setError(result.error); return; }
    setLocations((prev) => prev.filter((l) => l.id !== locationId));
    setSuccess("Location deactivated");
    setTimeout(() => setSuccess(null), 3000);
  }

  async function saveAssignments() {
    if (!assigningDoctor) return;
    setError(null);
    startTransition(async () => {
      const result = await setDoctorLocations(assigningDoctor.id, selectedLocationIds);
      if (result.error) { setError(result.error); return; }
      // Update local state
      setAssignments((prev) => {
        const filtered = prev.filter((a) => a.doctor_id !== assigningDoctor.id);
        const newAssignments = selectedLocationIds.map((lid) => ({
          doctor_id: assigningDoctor.id,
          clinic_location_id: lid,
          is_active: true,
        }));
        return [...filtered, ...newAssignments];
      });
      setShowAssignDialog(false);
      setSuccess("Doctor locations updated");
      setTimeout(() => setSuccess(null), 3000);
    });
  }

  function toggleLocationId(id: string) {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Helper: get location names for a doctor
  function getDoctorLocationNames(doctorId: string) {
    return assignments
      .filter((a) => a.doctor_id === doctorId && a.is_active)
      .map((a) => locations.find((l) => l.id === a.clinic_location_id)?.name)
      .filter(Boolean);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-muted-foreground text-sm">
            Manage your clinic branches and assign doctors to each location.
          </p>
        </div>
        <Button onClick={openAddLocation}>
          <Plus className="mr-2 h-4 w-4" />Add Location
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Locations grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {locations.length === 0 && (
          <div className="col-span-2 rounded-lg border border-dashed p-10 text-center">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No locations yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add your first clinic branch to get started.</p>
          </div>
        )}
        {locations.map((loc) => {
          const locDoctors = assignments
            .filter((a) => a.clinic_location_id === loc.id && a.is_active)
            .map((a) => orgDoctors.find((d: any) => {
              const doc = Array.isArray(d.doctor) ? d.doctor[0] : d.doctor;
              return doc?.id === a.doctor_id;
            }))
            .filter(Boolean);

          return (
            <Card key={loc.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <CardTitle className="text-base leading-tight">{loc.name}</CardTitle>
                      {loc.city && (
                        <CardDescription className="mt-0.5 text-xs">
                          {[loc.address_line1, loc.city, loc.postal_code].filter(Boolean).join(", ")}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {loc.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditLocation(loc)}>
                          <Edit className="mr-2 h-3.5 w-3.5" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deactivate(loc.id, loc.name)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loc.phone && <p className="text-xs text-muted-foreground mb-3">{loc.phone}</p>}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Doctors at this location ({locDoctors.length})
                  </p>
                  {locDoctors.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No doctors assigned yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {locDoctors.slice(0, 4).map((member: any) => {
                        const doc = Array.isArray(member.doctor) ? member.doctor[0] : member.doctor;
                        const profile = Array.isArray(doc?.profile) ? doc.profile[0] : doc?.profile;
                        return (
                          <Badge key={doc?.id} variant="outline" className="text-xs gap-1">
                            <Stethoscope className="h-2.5 w-2.5" />
                            Dr. {profile?.last_name}
                          </Badge>
                        );
                      })}
                      {locDoctors.length > 4 && (
                        <Badge variant="outline" className="text-xs">+{locDoctors.length - 4} more</Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Doctors section */}
      {orgDoctors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Doctor Location Assignments</CardTitle>
            <CardDescription>Configure which locations each doctor works at each week.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {orgDoctors.map((member: any) => {
                const doc = Array.isArray(member.doctor) ? member.doctor[0] : member.doctor;
                const profile = Array.isArray(doc?.profile) ? doc.profile[0] : doc?.profile;
                if (!doc) return null;
                const locNames = getDoctorLocationNames(doc.id);
                return (
                  <div key={doc.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Dr. {profile?.first_name} {profile?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {locNames.length > 0
                            ? locNames.join(", ")
                            : "No locations assigned"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAssignDoctor(doc)}
                      disabled={locations.length === 0}
                    >
                      <MapPin className="mr-1.5 h-3 w-3" />Assign Locations
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location form dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "Add Location"}</DialogTitle>
            <DialogDescription>Enter the details for this clinic branch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Branch Name *</Label>
              <Input
                value={locForm.name}
                onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. City Centre Branch"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={locForm.address_line1}
                onChange={(e) => setLocForm((p) => ({ ...p, address_line1: e.target.value }))}
                placeholder="123 High Street"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={locForm.city}
                  onChange={(e) => setLocForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="London"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Postcode</Label>
                <Input
                  value={locForm.postal_code}
                  onChange={(e) => setLocForm((p) => ({ ...p, postal_code: e.target.value }))}
                  placeholder="EC1A 1BB"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={locForm.phone}
                  onChange={(e) => setLocForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+44 20 1234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={locForm.email}
                  onChange={(e) => setLocForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="branch@clinic.com"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editPrimary"
                checked={locForm.is_primary}
                onChange={(e) => setLocForm((p) => ({ ...p, is_primary: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="editPrimary" className="cursor-pointer text-sm">Set as primary location</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLocationDialog(false)}>Cancel</Button>
            <Button onClick={saveLocation} disabled={!locForm.name}>
              {editingLocation ? "Save Changes" : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor assign dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Locations</DialogTitle>
            {assigningDoctor && (
              <DialogDescription>
                Select the locations Dr. {
                  (() => {
                    const p = Array.isArray(assigningDoctor?.profile) ? assigningDoctor.profile[0] : assigningDoctor?.profile;
                    return p?.last_name ?? "";
                  })()
                } works at.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-2">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a location first.</p>
            ) : (
              locations.map((loc) => (
                <label
                  key={loc.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/30"
                >
                  <input
                    type="checkbox"
                    checked={selectedLocationIds.includes(loc.id)}
                    onChange={() => toggleLocationId(loc.id)}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium">{loc.name}</p>
                    {loc.city && <p className="text-xs text-muted-foreground">{loc.city}</p>}
                  </div>
                  {loc.is_primary && <Badge variant="secondary" className="ml-auto text-xs">Primary</Badge>}
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={saveAssignments} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
