"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import type { ParsedAddress } from "@/components/shared/address-autocomplete";
import {
  User,
  Briefcase,
  GraduationCap,
  Award,
  DollarSign,
  FileText,
  Save,
  Plus,
  X,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Accessibility,
  Stethoscope,
  Clock,
  Pencil,
  Trash2,
  Lock,
  CreditCard,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { centsToAmount, amountToCents, formatCurrency, RECOMMENDED_DEPOSIT_PERCENTAGE, PLATFORM_COMMISSION_PERCENT, calculateDepositCents, getCommissionCents } from "@/lib/utils/currency";
import { LANGUAGES } from "@/lib/constants/countries";
import {
  createDoctorService,
  updateDoctorService,
  deleteDoctorService,
} from "@/actions/doctor-services";
import {
  getDoctorSkillsAndSpecialties,
  setDoctorSkills,
} from "@/actions/doctor-skills";
import {
  MAX_DOCTOR_SKILLS,
  doctorDeclarableSkillsForSpecialties,
} from "@/lib/constants/skills";
import { PriceBookEditor } from "@/components/doctor/price-book-editor";
import { PracticePhotosManager } from "@/components/doctor/practice-photos-manager";
import type { Education, Certification, Doctor, DoctorService } from "@/types";

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; storage_path: string; alt_text: string | null; display_order: number; is_primary: boolean }[]>([]);

  // Form state
  const [title, setTitle] = useState("Dr.");
  const [bio, setBio] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(0);
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [consultationTypes, setConsultationTypes] = useState<string[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [consultationFeeCents, setConsultationFeeCents] = useState(0);
  const [videoConsultationFeeCents, setVideoConsultationFeeCents] = useState(0);
  const [cancellationPolicy, setCancellationPolicy] = useState("flexible");
  const [cancellationHours, setCancellationHours] = useState(24);
  const [isWheelchairAccessible, setIsWheelchairAccessible] = useState(false);
  const [inPersonDepositType, setInPersonDepositType] = useState<"none" | "percentage" | "flat">("none");
  const [inPersonDepositValue, setInPersonDepositValue] = useState<number | null>(null);

  // Skills state
  const [doctorSpecialties, setDoctorSpecialties] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const [savedSkills, setSavedSkills] = useState(false);
  const [skillsError, setSkillsError] = useState("");

  // Services state
  const [services, setServices] = useState<DoctorService[]>([]);
  const [editingService, setEditingService] = useState<DoctorService | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [svcDescription, setSvcDescription] = useState("");
  const [svcPriceCents, setSvcPriceCents] = useState(0);
  const [svcDuration, setSvcDuration] = useState("30");
  const [svcType, setSvcType] = useState("in_person");
  const [svcDepositType, setSvcDepositType] = useState<string | null>(null);
  const [svcDepositValue, setSvcDepositValue] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  function resetServiceForm() {
    setSvcName("");
    setSvcDescription("");
    setSvcPriceCents(0);
    setSvcDuration("30");
    setSvcType("in_person");
    setSvcDepositType(null);
    setSvcDepositValue(null);
    setEditingService(null);
    setShowServiceForm(false);
  }

  function startEditService(svc: DoctorService) {
    setSvcName(svc.name);
    setSvcDescription(svc.description || "");
    setSvcPriceCents(svc.price_cents);
    setSvcDuration(String(svc.duration_minutes));
    setSvcType(svc.consultation_type);
    setSvcDepositType(svc.deposit_type ?? null);
    setSvcDepositValue(svc.deposit_value ?? null);
    setEditingService(svc);
    setShowServiceForm(true);
  }

  async function handleSaveService() {
    setSavingService(true);
    const input = {
      name: svcName,
      description: svcDescription || null,
      price_cents: svcPriceCents,
      duration_minutes: parseInt(svcDuration),
      consultation_type: svcType as "in_person" | "video" | "both",
      is_active: true,
      display_order: editingService?.display_order ?? services.length,
      deposit_type: svcDepositType as "none" | "percentage" | "flat" | null,
      deposit_value: svcDepositValue,
    };

    if (editingService) {
      const result = await updateDoctorService(editingService.id, input);
      if (result.service) {
        setServices((prev) =>
          prev.map((s) => (s.id === editingService.id ? result.service! : s))
        );
      }
    } else {
      const result = await createDoctorService(input);
      if (result.service) {
        setServices((prev) => [...prev, result.service!]);
      }
    }

    setSavingService(false);
    resetServiceForm();
  }

  async function handleDeleteService(serviceId: string) {
    const result = await deleteDoctorService(serviceId);
    if (result.success) {
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    }
  }

  async function loadData() {
    const supabase = createSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("doctors")
      .select("*")
      .eq("profile_id", user.id)
      .single();

    if (!data) return;

    setDoctor(data as Doctor);
    setIsVerified(data.verification_status === "verified");
    setTitle(data.title || "Dr.");
    setBio(data.bio || "");
    setYearsOfExperience(data.years_of_experience || 0);
    setClinicName(data.clinic_name || "");
    setAddress(data.address || "");
    setCity(data.city || "");
    setPostalCode(data.postal_code || "");
    setLanguages(data.languages || []);
    setConsultationTypes(data.consultation_types || []);
    setEducation((data.education as Education[]) || []);
    setCertifications((data.certifications as Certification[]) || []);
    setConsultationFeeCents(data.consultation_fee_cents || 0);
    setVideoConsultationFeeCents(data.video_consultation_fee_cents || 0);
    setCancellationPolicy(data.cancellation_policy || "flexible");
    setCancellationHours(data.cancellation_hours || 24);
    setIsWheelchairAccessible(data.is_wheelchair_accessible || false);
    const dt = data.in_person_deposit_type || "none";
    setInPersonDepositType(dt as "none" | "percentage" | "flat");
    setInPersonDepositValue(data.in_person_deposit_value ?? null);

    // Load services
    const { data: svcData } = await supabase
      .from("doctor_services")
      .select("*")
      .eq("doctor_id", data.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (svcData) setServices(svcData as DoctorService[]);

    // Load practice photos
    const { data: photoData } = await supabase
      .from("doctor_photos")
      .select("id, storage_path, alt_text, display_order, is_primary")
      .eq("doctor_id", data.id)
      .order("display_order", { ascending: true });

    if (photoData) setPhotos(photoData);

    // Load current skills + specialties (for the skills picker filter)
    const skillsResult = await getDoctorSkillsAndSpecialties();
    setSkills(skillsResult.skills);
    setDoctorSpecialties(skillsResult.specialties);

    setLoading(false);
  }

  function toggleSkill(slug: string) {
    setSkills((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_DOCTOR_SKILLS) return prev;
      return [...prev, slug];
    });
    setSavedSkills(false);
  }

  async function handleSaveSkills() {
    setSavingSkills(true);
    setSkillsError("");
    const result = await setDoctorSkills(skills);
    setSavingSkills(false);
    if (result.error) {
      setSkillsError(result.error);
      return;
    }
    setSavedSkills(true);
    setTimeout(() => setSavedSkills(false), 3000);
  }

  async function handleSave() {
    if (!doctor || isVerified) return;
    setSaving(true);
    setSaved(false);

    const supabase = createSupabase();
    await supabase
      .from("doctors")
      .update({
        title,
        bio,
        years_of_experience: yearsOfExperience,
        clinic_name: clinicName || null,
        address: address || null,
        city: city || null,
        postal_code: postalCode || null,
        languages,
        consultation_types: consultationTypes,
        education,
        certifications,
        consultation_fee_cents: consultationFeeCents,
        video_consultation_fee_cents: videoConsultationFeeCents || null,
        in_person_deposit_type: inPersonDepositType,
        in_person_deposit_value: inPersonDepositType === "none" ? null : inPersonDepositValue,
        cancellation_policy: cancellationPolicy,
        cancellation_hours: cancellationHours,
        is_wheelchair_accessible: isWheelchairAccessible,
      })
      .eq("id", doctor.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function addEducation() {
    setEducation([...education, { degree: "", institution: "", year: new Date().getFullYear() }]);
  }

  function removeEducation(index: number) {
    setEducation(education.filter((_, i) => i !== index));
  }

  function updateEducation(index: number, field: keyof Education, value: string | number) {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    setEducation(updated);
  }

  function addCertification() {
    setCertifications([
      ...certifications,
      { name: "", issuer: "", year: new Date().getFullYear() },
    ]);
  }

  function removeCertification(index: number) {
    setCertifications(certifications.filter((_, i) => i !== index));
  }

  function updateCertification(
    index: number,
    field: keyof Certification,
    value: string | number
  ) {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    setCertifications(updated);
  }

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }

  function toggleConsultationType(type: string) {
    setConsultationTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
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
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <p className="text-muted-foreground">
            Update your professional profile information
          </p>
        </div>
        <div className="flex items-center gap-3">
          {doctor?.slug && (
            <Button variant="outline" asChild>
              <Link href={`/doctors/${doctor.slug}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Public Profile
              </Link>
            </Button>
          )}
          {!isVerified && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saved ? "Saved" : "Save All Changes"}
            </Button>
          )}
        </div>
      </div>

      {isVerified && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2.5 dark:bg-amber-900/50">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Profile Locked
                </p>
                <p className="text-sm text-amber-800/80 dark:text-amber-200/70">
                  Your profile details are locked after GMC verification. To request changes, please open a support ticket.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/doctor-dashboard/support/new">
                Open Ticket
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Select value={title} onValueChange={setTitle} disabled={isVerified}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dr.">Dr.</SelectItem>
                  <SelectItem value="Prof.">Prof.</SelectItem>
                  <SelectItem value="Prof. Dr.">Prof. Dr.</SelectItem>
                  <SelectItem value="Assoc. Prof.">Assoc. Prof.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Years of Experience</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={yearsOfExperience}
                onChange={(e) =>
                  setYearsOfExperience(parseInt(e.target.value) || 0)
                }
                disabled={isVerified}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              placeholder="Tell patients about yourself, your approach to care, and your experience..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              disabled={isVerified}
            />
            <p className="text-xs text-muted-foreground">
              {bio.length}/2000 characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Practice Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Practice Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Clinic Name</Label>
            <Input
              placeholder="e.g., City Medical Center"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              disabled={isVerified}
            />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onPlaceSelect={(parsed: ParsedAddress) => {
                setAddress(parsed.addressLine1);
                if (parsed.city) setCity(parsed.city);
                if (parsed.postalCode) setPostalCode(parsed.postalCode);
              }}
              placeholder="Start typing your clinic address..."
              disabled={isVerified}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isVerified}
              />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input
                placeholder="Postcode / ZIP"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={isVerified}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <Badge
                  key={lang.code}
                  variant={languages.includes(lang.code) ? "default" : "outline"}
                  className={isVerified ? "opacity-60" : "cursor-pointer"}
                  onClick={() => !isVerified && toggleLanguage(lang.code)}
                >
                  {lang.name}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Consultation Types</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={consultationTypes.includes("in_person")}
                  onCheckedChange={() => toggleConsultationType("in_person")}
                  disabled={isVerified}
                />
                <span className="text-sm">In Person</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={consultationTypes.includes("video")}
                  onCheckedChange={() => toggleConsultationType("video")}
                  disabled={isVerified}
                />
                <span className="text-sm">Video Consultation</span>
              </label>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Clinic Accessibility</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Accessibility className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Wheelchair Accessible</p>
                  <p className="text-xs text-muted-foreground">
                    Indicate if your clinic is accessible for wheelchair users
                  </p>
                </div>
              </div>
              <Switch
                checked={isWheelchairAccessible}
                onCheckedChange={setIsWheelchairAccessible}
                disabled={isVerified}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Skills */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Key Skills
            </CardTitle>
            <CardDescription>
              Procedures and conditions you treat. Patients use these to find
              you for specific needs. Up to {MAX_DOCTOR_SKILLS}.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleSaveSkills}
            disabled={savingSkills}
          >
            {savingSkills ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : savedSkills ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {savedSkills ? "Saved" : "Save Skills"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {doctorSpecialties.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Set your specialties first (contact support) — skills are filtered
              to match the procedures and conditions within your specialty.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {skills.length} / {MAX_DOCTOR_SKILLS} selected
              </p>
              <div className="flex flex-wrap gap-2">
                {doctorDeclarableSkillsForSpecialties(doctorSpecialties).map(
                  (skill) => {
                    const isSelected = skills.includes(skill.slug);
                    const atLimit =
                      !isSelected && skills.length >= MAX_DOCTOR_SKILLS;
                    return (
                      <Badge
                        key={skill.slug}
                        variant={isSelected ? "default" : "outline"}
                        className={`px-3 py-1.5 ${
                          atLimit
                            ? "cursor-not-allowed opacity-40"
                            : "cursor-pointer"
                        }`}
                        onClick={() => !atLimit && toggleSkill(skill.slug)}
                      >
                        {skill.label}
                      </Badge>
                    );
                  }
                )}
              </div>
              {skillsError && (
                <p className="text-xs text-destructive">{skillsError}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Practice Photos */}
      {doctor && (
        <PracticePhotosManager
          doctorId={doctor.id}
          initialPhotos={photos}
        />
      )}

      {/* Education */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Education
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addEducation} disabled={isVerified}>
            <Plus className="mr-2 h-4 w-4" />
            Add Education
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {education.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No education entries yet. Add your academic qualifications.
            </p>
          ) : (
            education.map((edu, index) => (
              <div key={index} className="flex items-start gap-4 rounded-lg border p-4">
                <div className="grid flex-1 grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Degree</Label>
                    <Input
                      placeholder="e.g., M.D."
                      value={edu.degree}
                      onChange={(e) =>
                        updateEducation(index, "degree", e.target.value)
                      }
                      disabled={isVerified}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Institution</Label>
                    <Input
                      placeholder="University name"
                      value={edu.institution}
                      onChange={(e) =>
                        updateEducation(index, "institution", e.target.value)
                      }
                      disabled={isVerified}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Year</Label>
                    <Input
                      type="number"
                      min={1950}
                      max={new Date().getFullYear()}
                      value={edu.year}
                      onChange={(e) =>
                        updateEducation(index, "year", parseInt(e.target.value) || 0)
                      }
                      disabled={isVerified}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeEducation(index)}
                  disabled={isVerified}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certifications
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addCertification} disabled={isVerified}>
            <Plus className="mr-2 h-4 w-4" />
            Add Certification
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {certifications.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No certifications yet. Add your professional certifications.
            </p>
          ) : (
            certifications.map((cert, index) => (
              <div key={index} className="flex items-start gap-4 rounded-lg border p-4">
                <div className="grid flex-1 grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="Certification name"
                      value={cert.name}
                      onChange={(e) =>
                        updateCertification(index, "name", e.target.value)
                      }
                      disabled={isVerified}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Issuer</Label>
                    <Input
                      placeholder="Issuing organization"
                      value={cert.issuer}
                      onChange={(e) =>
                        updateCertification(index, "issuer", e.target.value)
                      }
                      disabled={isVerified}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Year</Label>
                    <Input
                      type="number"
                      min={1950}
                      max={new Date().getFullYear()}
                      value={cert.year}
                      onChange={(e) =>
                        updateCertification(
                          index,
                          "year",
                          parseInt(e.target.value) || 0
                        )
                      }
                      disabled={isVerified}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeCertification(index)}
                  disabled={isVerified}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing
          </CardTitle>
          <CardDescription>
            Set your consultation fees. Amounts are displayed in{" "}
            {doctor?.base_currency || "EUR"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>In-Person Consultation Fee</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {doctor?.base_currency || "EUR"}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="pl-14"
                  value={centsToAmount(consultationFeeCents)}
                  onChange={(e) =>
                    setConsultationFeeCents(
                      amountToCents(parseFloat(e.target.value) || 0)
                    )
                  }
                  disabled={isVerified}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Video Consultation Fee</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {doctor?.base_currency || "EUR"}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="pl-14"
                  value={centsToAmount(videoConsultationFeeCents)}
                  onChange={(e) =>
                    setVideoConsultationFeeCents(
                      amountToCents(parseFloat(e.target.value) || 0)
                    )
                  }
                  disabled={isVerified}
                />
              </div>
            </div>
          </div>

          {/* In-Person Deposit Settings */}
          {consultationTypes.includes("in_person") && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium">In-Person Deposit Settings</Label>
                <p className="text-xs text-muted-foreground">
                  Choose how patients pay for in-person appointments. Video consultations always require full payment.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { setInPersonDepositType("none"); setInPersonDepositValue(null); }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      inPersonDepositType === "none"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:bg-accent"
                    } cursor-pointer`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Full Payment</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Patient pays entire fee upfront
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInPersonDepositType("percentage"); setInPersonDepositValue(inPersonDepositValue || RECOMMENDED_DEPOSIT_PERCENTAGE); }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      inPersonDepositType === "percentage"
                        ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                        : "border-muted hover:bg-accent"
                    } cursor-pointer`}
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Percentage</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deposit as % of fee (recommended)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInPersonDepositType("flat"); setInPersonDepositValue(inPersonDepositValue || 0); }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      inPersonDepositType === "flat"
                        ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                        : "border-muted hover:bg-accent"
                    } cursor-pointer`}
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Flat Fee</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fixed deposit amount
                    </p>
                  </button>
                </div>

                {/* Percentage input */}
                {inPersonDepositType === "percentage" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Deposit Percentage</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={PLATFORM_COMMISSION_PERCENT}
                        max={100}
                        step={1}
                        value={inPersonDepositValue ?? RECOMMENDED_DEPOSIT_PERCENTAGE}
                        onChange={(e) => setInPersonDepositValue(parseInt(e.target.value) || RECOMMENDED_DEPOSIT_PERCENTAGE)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <span className="text-xs text-muted-foreground">(Recommended: {RECOMMENDED_DEPOSIT_PERCENTAGE}%, Min: {PLATFORM_COMMISSION_PERCENT}%)</span>
                    </div>
                  </div>
                )}

                {/* Flat fee input */}
                {inPersonDepositType === "flat" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Deposit Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {doctor?.base_currency || "EUR"}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="pl-14 w-40"
                        value={centsToAmount(inPersonDepositValue ?? 0)}
                        onChange={(e) => setInPersonDepositValue(amountToCents(parseFloat(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                )}

                {/* Commission reminder */}
                {inPersonDepositType !== "none" && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>{PLATFORM_COMMISSION_PERCENT}% of the total consultation fee</strong> is held as platform commission.
                      This is deducted from the deposit payment via Stripe.
                    </p>
                    {consultationFeeCents > 0 && (() => {
                      const previewDeposit = calculateDepositCents(consultationFeeCents, inPersonDepositType, inPersonDepositValue);
                      const commission = getCommissionCents(consultationFeeCents);
                      if (!previewDeposit) return null;
                      return (
                        <div className="mt-2 space-y-1 text-xs text-blue-600 dark:text-blue-400">
                          <p>Preview for {formatCurrency(consultationFeeCents, doctor?.base_currency || "EUR")} consultation:</p>
                          <p>• Deposit: {formatCurrency(previewDeposit, doctor?.base_currency || "EUR")}</p>
                          <p>• Patient pays: {formatCurrency(previewDeposit, doctor?.base_currency || "EUR")}</p>
                          <p>• Commission: {formatCurrency(commission, doctor?.base_currency || "EUR")} | Remainder due on day: {formatCurrency(consultationFeeCents - previewDeposit, doctor?.base_currency || "EUR")}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Services
            </CardTitle>
            <CardDescription>
              Add services you offer. Returning patients can select these when booking.
            </CardDescription>
          </div>
          {!showServiceForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetServiceForm();
                setShowServiceForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Inline add / edit form */}
          {showServiceForm && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Service Name</Label>
                  <Input
                    placeholder="e.g., ECG Review, Follow-up Consultation"
                    value={svcName}
                    onChange={(e) => setSvcName(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price ({doctor?.base_currency || "EUR"})</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {doctor?.base_currency || "EUR"}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="pl-14"
                      value={centsToAmount(svcPriceCents)}
                      onChange={(e) =>
                        setSvcPriceCents(amountToCents(parseFloat(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Duration</Label>
                  <Select value={svcDuration} onValueChange={setSvcDuration}>
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
                <div className="space-y-1">
                  <Label className="text-xs">Consultation Type</Label>
                  <Select value={svcType} onValueChange={setSvcType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In-Person</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Textarea
                  placeholder="Brief description of this service..."
                  value={svcDescription}
                  onChange={(e) => setSvcDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                />
              </div>
              {/* Service Deposit Override (only for in-person/both services) */}
              {(svcType === "in_person" || svcType === "both") && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Deposit Override</Label>
                    <Select
                      value={svcDepositType ?? "inherit"}
                      onValueChange={(v) => {
                        if (v === "inherit") {
                          setSvcDepositType(null);
                          setSvcDepositValue(null);
                        } else {
                          setSvcDepositType(v);
                          if (v === "percentage") setSvcDepositValue(RECOMMENDED_DEPOSIT_PERCENTAGE);
                          else if (v === "flat") setSvcDepositValue(0);
                          else setSvcDepositValue(null);
                        }
                      }}
                    >
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Use doctor default</SelectItem>
                        <SelectItem value="none">No deposit</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="flat">Flat fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {svcDepositType === "percentage" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={PLATFORM_COMMISSION_PERCENT}
                        max={100}
                        step={1}
                        value={svcDepositValue ?? RECOMMENDED_DEPOSIT_PERCENTAGE}
                        onChange={(e) => setSvcDepositValue(parseInt(e.target.value) || RECOMMENDED_DEPOSIT_PERCENTAGE)}
                        className="w-20 h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  )}
                  {svcDepositType === "flat" && (
                    <div className="relative w-32">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {doctor?.base_currency || "EUR"}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="pl-12 h-8 text-xs"
                        value={centsToAmount(svcDepositValue ?? 0)}
                        onChange={(e) => setSvcDepositValue(amountToCents(parseFloat(e.target.value) || 0))}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={resetServiceForm}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveService}
                  disabled={savingService || !svcName.trim() || svcPriceCents <= 0}
                >
                  {savingService ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {editingService ? "Update Service" : "Save Service"}
                </Button>
              </div>
            </div>
          )}

          {/* Service list */}
          {services.length === 0 && !showServiceForm ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No services configured. Patients will book using your default consultation fee.
            </p>
          ) : (
            services.map((svc) => (
              <div
                key={svc.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{svc.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      {svc.duration_minutes} min
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {svc.consultation_type === "both"
                        ? "In-Person & Video"
                        : svc.consultation_type === "video"
                          ? "Video"
                          : "In-Person"}
                    </Badge>
                  </div>
                  {svc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {svc.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-semibold">
                      {formatCurrency(svc.price_cents, doctor?.base_currency || "EUR")}
                    </p>
                    {svc.deposit_type && svc.deposit_type !== "none" && (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        {svc.deposit_type === "percentage" ? `${svc.deposit_value}% deposit` : `${formatCurrency(svc.deposit_value || 0, doctor?.base_currency || "EUR")} deposit`}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEditService(svc)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteService(svc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Price Book */}
      <PriceBookEditor doctorCurrency={doctor?.base_currency || "EUR"} />

      {/* Cancellation Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cancellation Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Policy Type</Label>
              <Select value={cancellationPolicy} onValueChange={setCancellationPolicy} disabled={isVerified}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flexible">Flexible</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="strict">Strict</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Minimum Cancellation Hours</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={cancellationHours}
                onChange={(e) =>
                  setCancellationHours(parseInt(e.target.value) || 24)
                }
                disabled={isVerified}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save */}
      {!isVerified && (
        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? "Changes Saved" : "Save All Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
