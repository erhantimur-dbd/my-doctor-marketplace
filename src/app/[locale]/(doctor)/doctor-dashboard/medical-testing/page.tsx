"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import {
  FlaskConical,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  MapPin,
  Crown,
  Building2,
  Phone,
  Pencil,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { MEDICAL_TEST_GROUPS } from "@/lib/constants/medical-tests";
import {
  getPriceBook,
  savePriceBookEntries,
  deletePriceBookEntry,
  type PriceBookEntry,
} from "@/actions/price-book";
import {
  getTestingLocations,
  saveTestingLocation,
  deleteTestingLocation,
  toggleTestingLocation,
  type TestingLocation,
} from "@/actions/testing-locations";
import { centsToAmount, amountToCents } from "@/lib/utils/currency";
import { AVAILABLE_MODULES, formatPrice } from "@/lib/constants/license-tiers";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

// Flat lookup for test names
const ALL_TESTS = MEDICAL_TEST_GROUPS.flatMap((g) =>
  g.tests.map((t) => ({ ...t, group: g.label }))
);

interface LocalEntry {
  test_id: string;
  price_cents: number;
  displayPrice: string;
  custom_name: string | null;
}

interface LocationForm {
  id?: string;
  name: string;
  address: string;
  city: string;
  country_code: string;
  postal_code: string;
  phone: string;
}

const emptyLocationForm: LocationForm = {
  name: "",
  address: "",
  city: "",
  country_code: "GB",
  postal_code: "",
  phone: "",
};

export default function MedicalTestingPage() {
  const [loading, setLoading] = useState(true);
  const [hasAddon, setHasAddon] = useState(false);
  const [doctorCurrency, setDoctorCurrency] = useState("GBP");

  // Test catalog state
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [addTestId, setAddTestId] = useState("");
  const [customTestName, setCustomTestName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Locations state
  const [locations, setLocations] = useState<TestingLocation[]>([]);
  const [locationForm, setLocationForm] = useState<LocationForm>(emptyLocationForm);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id, has_testing_addon, base_currency")
      .eq("profile_id", user.id)
      .single();

    if (!doctor) return;

    setHasAddon(doctor.has_testing_addon);
    setDoctorCurrency(doctor.base_currency || "GBP");

    if (doctor.has_testing_addon) {
      const [priceBookResult, locationsResult] = await Promise.all([
        getPriceBook(),
        getTestingLocations(),
      ]);

      if (priceBookResult.entries) {
        setEntries(
          priceBookResult.entries.map((e) => ({
            test_id: e.test_id,
            price_cents: e.price_cents,
            displayPrice: String(centsToAmount(e.price_cents)),
            custom_name: e.custom_name,
          }))
        );
      }

      if (locationsResult.locations) {
        setLocations(locationsResult.locations);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usedTestIds = useMemo(
    () => new Set(entries.map((e) => e.test_id)),
    [entries]
  );

  // ── Test catalog handlers ──

  function handleAddTest(testId: string) {
    if (!testId || usedTestIds.has(testId)) return;
    setEntries((prev) => [
      ...prev,
      { test_id: testId, price_cents: 0, displayPrice: "", custom_name: null },
    ]);
    setAddTestId("");
  }

  function handleAddCustomTest() {
    const name = customTestName.trim();
    if (!name) {
      toast.error("Please enter a test name.");
      return;
    }
    const customId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setEntries((prev) => [
      ...prev,
      { test_id: customId, price_cents: 0, displayPrice: "", custom_name: name },
    ]);
    setCustomTestName("");
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
    await deletePriceBookEntry(entry.test_id);
    setEntries((prev) => prev.filter((_, i) => i !== index));
    toast.success("Test removed.");
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
      validEntries.map((e) => ({
        test_id: e.test_id,
        price_cents: e.price_cents,
        custom_name: e.custom_name,
      }))
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      setSaved(true);
      toast.success("Test catalog saved.");
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  function getTestName(testId: string, customName?: string | null) {
    if (customName) return customName;
    return ALL_TESTS.find((t) => t.id === testId)?.name ?? testId;
  }

  function getTestGroup(testId: string) {
    return ALL_TESTS.find((t) => t.id === testId)?.group ?? "";
  }

  // ── Location handlers ──

  function handleEditLocation(loc: TestingLocation) {
    setEditingLocationId(loc.id);
    setLocationForm({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      country_code: loc.country_code,
      postal_code: loc.postal_code || "",
      phone: loc.phone || "",
    });
    setShowLocationForm(true);
  }

  function handleCancelLocationForm() {
    setShowLocationForm(false);
    setEditingLocationId(null);
    setLocationForm(emptyLocationForm);
  }

  async function handleSaveLocation() {
    if (!locationForm.name.trim() || !locationForm.address.trim() || !locationForm.city.trim()) {
      toast.error("Name, address, and city are required.");
      return;
    }

    setSavingLocation(true);
    const result = await saveTestingLocation({
      id: editingLocationId || undefined,
      name: locationForm.name,
      address: locationForm.address,
      city: locationForm.city,
      country_code: locationForm.country_code,
      postal_code: locationForm.postal_code || undefined,
      phone: locationForm.phone || undefined,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editingLocationId ? "Location updated." : "Location added.");
      handleCancelLocationForm();
      // Reload locations
      const locResult = await getTestingLocations();
      if (locResult.locations) setLocations(locResult.locations);
    }
    setSavingLocation(false);
  }

  async function handleDeleteLocation(id: string) {
    const result = await deleteTestingLocation(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setLocations((prev) => prev.filter((l) => l.id !== id));
      toast.success("Location deleted.");
    }
  }

  async function handleToggleLocation(id: string, currentActive: boolean) {
    const result = await toggleTestingLocation(id, !currentActive);
    if (result.error) {
      toast.error(result.error);
    } else {
      setLocations((prev) =>
        prev.map((l) => (l.id === id ? { ...l, is_active: !currentActive } : l))
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Gate: no add-on ──
  if (!hasAddon) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Medical Testing Services</h1>
          <p className="text-muted-foreground">
            Manage your in-person diagnostic test catalog and service locations
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-teal-100 p-4">
              <FlaskConical className="h-8 w-8 text-teal-600" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">
              Medical Testing Add-on Required
            </h2>
            <p className="mb-6 max-w-md text-sm text-muted-foreground">
              Subscribe to the Medical Testing add-on ({formatPrice(AVAILABLE_MODULES.find((m) => m.key === "medical_testing")!.priceMonthlyPence, "GBP")}/month with a Professional or Clinic plan) to list in-person
              diagnostic services, set your own prices, and manage service locations.
            </p>
            <Link href="/doctor-dashboard/subscription">
              <Button>
                <Crown className="mr-2 h-4 w-4" />
                Go to Subscription
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main content ──
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-teal-600" />
          Medical Testing Services
        </h1>
        <p className="text-muted-foreground">
          Manage your in-person diagnostic test catalog and service locations. All
          services listed here are in-person only.
        </p>
      </div>

      {/* ── Test Catalog ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Test Catalog & Pricing
              </CardTitle>
              <CardDescription>
                Select from our predefined tests or add your own custom tests.
                Set your own prices for each.
              </CardDescription>
            </div>
            {entries.length > 0 && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saved ? "Saved" : "Save All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add from predefined tests */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Add from predefined tests
            </Label>
            <Select value={addTestId} onValueChange={handleAddTest}>
              <SelectTrigger>
                <SelectValue placeholder="Select a test or procedure..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {MEDICAL_TEST_GROUPS.map((group) => {
                  const available = group.tests.filter(
                    (t) => !usedTestIds.has(t.id)
                  );
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

          {/* Add custom test */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Add a custom test
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Full Body Health Check"
                value={customTestName}
                onChange={(e) => setCustomTestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTest();
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={handleAddCustomTest}
                disabled={!customTestName.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* Entries list */}
          {entries.length === 0 ? (
            <div className="py-8 text-center">
              <FlaskConical className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No tests added yet. Select from predefined tests or add your
                own custom tests above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-3">
                <span>{entries.length} test{entries.length !== 1 ? "s" : ""}</span>
                <span>Price ({doctorCurrency})</span>
              </div>
              {entries.map((entry, index) => (
                <div
                  key={entry.test_id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {getTestName(entry.test_id, entry.custom_name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.custom_name ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Custom
                        </Badge>
                      ) : (
                        getTestGroup(entry.test_id)
                      )}
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
                        onChange={(e) =>
                          handlePriceChange(index, e.target.value)
                        }
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
                {saved ? "Saved" : "Save All"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Service Locations ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Service Locations
              </CardTitle>
              <CardDescription>
                Add the locations where you offer testing services. Each location
                will appear as a unique listing in search results.
              </CardDescription>
            </div>
            {!showLocationForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLocationForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location form */}
          {showLocationForm && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {editingLocationId ? "Edit Location" : "New Location"}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCancelLocationForm}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="loc-name" className="text-xs">
                    Location Name *
                  </Label>
                  <Input
                    id="loc-name"
                    placeholder="e.g. Main Clinic, City Centre Lab"
                    value={locationForm.name}
                    onChange={(e) =>
                      setLocationForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="loc-phone" className="text-xs">
                    Phone
                  </Label>
                  <Input
                    id="loc-phone"
                    placeholder="+44 20 1234 5678"
                    value={locationForm.phone}
                    onChange={(e) =>
                      setLocationForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="loc-address" className="text-xs">
                    Address *
                  </Label>
                  <Input
                    id="loc-address"
                    placeholder="123 Harley Street"
                    value={locationForm.address}
                    onChange={(e) =>
                      setLocationForm((f) => ({
                        ...f,
                        address: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="loc-city" className="text-xs">
                    City *
                  </Label>
                  <Input
                    id="loc-city"
                    placeholder="London"
                    value={locationForm.city}
                    onChange={(e) =>
                      setLocationForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="loc-postal" className="text-xs">
                    Postal Code
                  </Label>
                  <Input
                    id="loc-postal"
                    placeholder="W1G 6AB"
                    value={locationForm.postal_code}
                    onChange={(e) =>
                      setLocationForm((f) => ({
                        ...f,
                        postal_code: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="loc-country" className="text-xs">
                    Country
                  </Label>
                  <Select
                    value={locationForm.country_code}
                    onValueChange={(v) =>
                      setLocationForm((f) => ({ ...f, country_code: v }))
                    }
                  >
                    <SelectTrigger id="loc-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="DE">Germany</SelectItem>
                      <SelectItem value="TR">Turkey</SelectItem>
                      <SelectItem value="FR">France</SelectItem>
                      <SelectItem value="IE">Ireland</SelectItem>
                      <SelectItem value="NL">Netherlands</SelectItem>
                      <SelectItem value="BE">Belgium</SelectItem>
                      <SelectItem value="ES">Spain</SelectItem>
                      <SelectItem value="IT">Italy</SelectItem>
                      <SelectItem value="AT">Austria</SelectItem>
                      <SelectItem value="CH">Switzerland</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelLocationForm}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveLocation}
                  disabled={savingLocation}
                >
                  {savingLocation && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingLocationId ? "Update Location" : "Add Location"}
                </Button>
              </div>
            </div>
          )}

          {/* Locations list */}
          {locations.length === 0 && !showLocationForm ? (
            <div className="py-8 text-center">
              <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No service locations added yet. Add at least one location where
                patients can visit for testing.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    !loc.is_active ? "opacity-60 bg-muted/30" : ""
                  }`}
                >
                  <div className="mt-0.5 rounded-full bg-teal-100 p-2">
                    <Building2 className="h-4 w-4 text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{loc.name}</p>
                      {!loc.is_active && (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {loc.address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {loc.city}
                      {loc.postal_code ? `, ${loc.postal_code}` : ""} &middot;{" "}
                      {loc.country_code}
                    </p>
                    {loc.phone && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {loc.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={loc.is_active ? "Deactivate" : "Activate"}
                      onClick={() => handleToggleLocation(loc.id, loc.is_active)}
                    >
                      {loc.is_active ? (
                        <ToggleRight className="h-4 w-4 text-teal-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditLocation(loc)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteLocation(loc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
