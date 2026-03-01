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
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { centsToAmount, amountToCents } from "@/lib/utils/currency";
import { LANGUAGES } from "@/lib/constants/countries";
import type { Education, Certification, Doctor } from "@/types";

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

  // Form state
  const [title, setTitle] = useState("Dr.");
  const [bio, setBio] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(0);
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [consultationTypes, setConsultationTypes] = useState<string[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [consultationFeeCents, setConsultationFeeCents] = useState(0);
  const [videoConsultationFeeCents, setVideoConsultationFeeCents] = useState(0);
  const [cancellationPolicy, setCancellationPolicy] = useState("flexible");
  const [cancellationHours, setCancellationHours] = useState(24);
  const [isWheelchairAccessible, setIsWheelchairAccessible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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
    setTitle(data.title || "Dr.");
    setBio(data.bio || "");
    setYearsOfExperience(data.years_of_experience || 0);
    setClinicName(data.clinic_name || "");
    setAddress(data.address || "");
    setLanguages(data.languages || []);
    setConsultationTypes(data.consultation_types || []);
    setEducation((data.education as Education[]) || []);
    setCertifications((data.certifications as Certification[]) || []);
    setConsultationFeeCents(data.consultation_fee_cents || 0);
    setVideoConsultationFeeCents(data.video_consultation_fee_cents || 0);
    setCancellationPolicy(data.cancellation_policy || "flexible");
    setCancellationHours(data.cancellation_hours || 24);
    setIsWheelchairAccessible(data.is_wheelchair_accessible || false);
    setLoading(false);
  }

  async function handleSave() {
    if (!doctor) return;
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
        languages,
        consultation_types: consultationTypes,
        education,
        certifications,
        consultation_fee_cents: consultationFeeCents,
        video_consultation_fee_cents: videoConsultationFeeCents || null,
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
        </div>
      </div>

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
              <Select value={title} onValueChange={setTitle}>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Clinic Name</Label>
              <Input
                placeholder="e.g., City Medical Center"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="Full clinic address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
                  className="cursor-pointer"
                  onClick={() => toggleLanguage(lang.code)}
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
                />
                <span className="text-sm">In Person</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={consultationTypes.includes("video")}
                  onCheckedChange={() => toggleConsultationType("video")}
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
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Education
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addEducation}>
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
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeEducation(index)}
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
          <Button variant="outline" size="sm" onClick={addCertification}>
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
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeCertification(index)}
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
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <Select value={cancellationPolicy} onValueChange={setCancellationPolicy}>
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
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save */}
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
    </div>
  );
}
