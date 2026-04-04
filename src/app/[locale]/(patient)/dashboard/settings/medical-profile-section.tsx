"use client";

import { useState, useTransition, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HeartPulse, Loader2, X, ShieldCheck, Pill, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { updateMedicalProfile } from "./actions";
import { searchMedications } from "@/actions/medications";

interface MedicalProfileData {
  blood_type: string | null;
  allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  sharing_consent: boolean;
}

interface MedicalProfileSectionProps {
  medicalProfile: MedicalProfileData | null;
}

interface MedicationSuggestion {
  id: number;
  name: string;
  generic_name: string | null;
  category: string;
  form: string | null;
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Country codes for emergency contact phone
const COUNTRY_CODES = [
  { code: "+44", country: "GB", flag: "🇬🇧", label: "UK" },
  { code: "+353", country: "IE", flag: "🇮🇪", label: "Ireland" },
  { code: "+39", country: "IT", flag: "🇮🇹", label: "Italy" },
  { code: "+90", country: "TR", flag: "🇹🇷", label: "Turkey" },
  { code: "+34", country: "ES", flag: "🇪🇸", label: "Spain" },
  { code: "+49", country: "DE", flag: "🇩🇪", label: "Germany" },
  { code: "+33", country: "FR", flag: "🇫🇷", label: "France" },
  { code: "+48", country: "PL", flag: "🇵🇱", label: "Poland" },
  { code: "+351", country: "PT", flag: "🇵🇹", label: "Portugal" },
  { code: "+1", country: "US", flag: "🇺🇸", label: "USA" },
  { code: "+1", country: "CA", flag: "🇨🇦", label: "Canada" },
  { code: "+61", country: "AU", flag: "🇦🇺", label: "Australia" },
  { code: "+31", country: "NL", flag: "🇳🇱", label: "Netherlands" },
  { code: "+32", country: "BE", flag: "🇧🇪", label: "Belgium" },
  { code: "+41", country: "CH", flag: "🇨🇭", label: "Switzerland" },
  { code: "+43", country: "AT", flag: "🇦🇹", label: "Austria" },
  { code: "+46", country: "SE", flag: "🇸🇪", label: "Sweden" },
  { code: "+47", country: "NO", flag: "🇳🇴", label: "Norway" },
  { code: "+45", country: "DK", flag: "🇩🇰", label: "Denmark" },
  { code: "+358", country: "FI", flag: "🇫🇮", label: "Finland" },
  { code: "+30", country: "GR", flag: "🇬🇷", label: "Greece" },
  { code: "+420", country: "CZ", flag: "🇨🇿", label: "Czechia" },
  { code: "+36", country: "HU", flag: "🇭🇺", label: "Hungary" },
  { code: "+40", country: "RO", flag: "🇷🇴", label: "Romania" },
  { code: "+91", country: "IN", flag: "🇮🇳", label: "India" },
  { code: "+971", country: "AE", flag: "🇦🇪", label: "UAE" },
  { code: "+966", country: "SA", flag: "🇸🇦", label: "Saudi Arabia" },
  { code: "+27", country: "ZA", flag: "🇿🇦", label: "South Africa" },
  { code: "+55", country: "BR", flag: "🇧🇷", label: "Brazil" },
  { code: "+52", country: "MX", flag: "🇲🇽", label: "Mexico" },
];

function TagInput({
  label,
  placeholder,
  tags,
  onTagsChange,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = inputValue.trim();
      if (value && !tags.includes(value)) {
        onTagsChange([...tags, value]);
      }
      setInputValue("");
    }
  }

  function removeTag(index: number) {
    onTagsChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="mt-1.5"
      />
      <p className="text-xs text-muted-foreground">
        Press Enter to add
      </p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Medication Autocomplete Tag Input ── */

function MedicationTagInput({
  tags,
  onTagsChange,
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchMedications(query);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setHighlightedIndex(-1);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(inputValue);
    }, 250);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [inputValue, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addMedication(name: string) {
    const trimmed = name.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInputValue("");
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addMedication(suggestions[highlightedIndex].name);
      } else if (inputValue.trim()) {
        addMedication(inputValue);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  function removeTag(index: number) {
    onTagsChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Pill className="h-3.5 w-3.5" />
        Current Medications
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder="Start typing a medication name..."
          className="mt-1.5"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {/* Suggestions dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border bg-popover shadow-lg"
          >
            {suggestions.map((med, index) => (
              <button
                key={med.id}
                type="button"
                onClick={() => addMedication(med.name)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div>
                  <span className="font-medium">{med.name}</span>
                  {med.generic_name && med.generic_name !== med.name && (
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      ({med.generic_name})
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 ml-2">
                  {med.category}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Type to search or press Enter to add manually
      </p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="gap-1 pr-1">
              <Pill className="h-3 w-3" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Country Code Phone Input ── */

function CountryCodePhoneInput({
  value,
  onChange,
  id,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  placeholder?: string;
}) {
  const [countryCode, setCountryCode] = useState(() => {
    // Try to extract country code from existing value
    for (const cc of COUNTRY_CODES) {
      if (value.startsWith(cc.code + " ") || value.startsWith(cc.code)) {
        return cc.code;
      }
    }
    return "+44"; // Default to UK
  });

  const [phoneNumber, setPhoneNumber] = useState(() => {
    // Extract phone number after country code
    for (const cc of COUNTRY_CODES) {
      if (value.startsWith(cc.code + " ")) {
        return value.slice(cc.code.length + 1);
      }
      if (value.startsWith(cc.code)) {
        return value.slice(cc.code.length);
      }
    }
    // If no code matched, return the raw value (minus any leading +XX)
    return value.replace(/^\+\d{1,4}\s*/, "");
  });

  const [showCodes, setShowCodes] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const codeRef = useRef<HTMLDivElement>(null);

  // Combine and propagate
  useEffect(() => {
    const combined = phoneNumber
      ? `${countryCode} ${phoneNumber}`
      : "";
    onChange(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, phoneNumber]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (codeRef.current && !codeRef.current.contains(e.target as Node)) {
        setShowCodes(false);
        setCodeSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  const filteredCodes = codeSearch
    ? COUNTRY_CODES.filter(
        (c) =>
          c.label.toLowerCase().includes(codeSearch.toLowerCase()) ||
          c.code.includes(codeSearch) ||
          c.country.toLowerCase().includes(codeSearch.toLowerCase())
      )
    : COUNTRY_CODES;

  return (
    <div className="flex gap-0 mt-1.5">
      {/* Country code selector */}
      <div className="relative" ref={codeRef}>
        <button
          type="button"
          onClick={() => setShowCodes(!showCodes)}
          className="flex items-center gap-1 h-9 px-2.5 border border-r-0 rounded-l-md bg-muted/50 hover:bg-muted text-sm whitespace-nowrap transition-colors"
        >
          <span>{selectedCountry.flag}</span>
          <span className="text-xs text-muted-foreground">{countryCode}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {showCodes && (
          <div className="absolute z-50 mt-1 w-56 max-h-60 overflow-auto rounded-lg border bg-popover shadow-lg">
            <div className="sticky top-0 bg-popover border-b p-1.5">
              <Input
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="Search country..."
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            {filteredCodes.map((cc) => (
              <button
                key={`${cc.country}-${cc.code}`}
                type="button"
                onClick={() => {
                  setCountryCode(cc.code);
                  setShowCodes(false);
                  setCodeSearch("");
                }}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                  cc.code === countryCode && cc.country === selectedCountry.country
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span>{cc.flag}</span>
                <span className="flex-1">{cc.label}</span>
                <span className="text-xs text-muted-foreground">{cc.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Phone number input */}
      <Input
        id={id}
        type="tel"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder={placeholder || "Phone number"}
        className="rounded-l-none flex-1"
      />
    </div>
  );
}

/* ── Main Section ── */

export function MedicalProfileSection({
  medicalProfile,
}: MedicalProfileSectionProps) {
  const [bloodType, setBloodType] = useState(
    medicalProfile?.blood_type || ""
  );
  const [allergies, setAllergies] = useState<string[]>(
    medicalProfile?.allergies || []
  );
  const [chronicConditions, setChronicConditions] = useState<string[]>(
    medicalProfile?.chronic_conditions || []
  );
  const [currentMedications, setCurrentMedications] = useState<string[]>(
    medicalProfile?.current_medications || []
  );
  const [emergencyName, setEmergencyName] = useState(
    medicalProfile?.emergency_contact_name || ""
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    medicalProfile?.emergency_contact_phone || ""
  );
  const [notes, setNotes] = useState(medicalProfile?.notes || "");
  const [sharingConsent, setSharingConsent] = useState(
    medicalProfile?.sharing_consent || false
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      const result = await updateMedicalProfile({
        blood_type: bloodType || null,
        allergies,
        chronic_conditions: chronicConditions,
        current_medications: currentMedications,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        notes: notes.trim() || null,
        sharing_consent: sharingConsent,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Medical profile updated.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4" />
          Medical Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This information helps your doctor provide better care. It is only
          visible to you and your treating physicians.
        </p>

        <div>
          <Label>Blood Type</Label>
          <Select value={bloodType} onValueChange={setBloodType}>
            <SelectTrigger className="mt-1.5 w-full sm:w-48">
              <SelectValue placeholder="Select blood type" />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TagInput
          label="Allergies"
          placeholder="e.g., Penicillin, Peanuts"
          tags={allergies}
          onTagsChange={setAllergies}
        />

        <TagInput
          label="Chronic Conditions"
          placeholder="e.g., Diabetes, Hypertension"
          tags={chronicConditions}
          onTagsChange={setChronicConditions}
        />

        <MedicationTagInput
          tags={currentMedications}
          onTagsChange={setCurrentMedications}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="emergency-name">Emergency Contact Name</Label>
            <Input
              id="emergency-name"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="Full name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="emergency-phone">Emergency Contact Phone</Label>
            <CountryCodePhoneInput
              id="emergency-phone"
              value={emergencyPhone}
              onChange={setEmergencyPhone}
              placeholder="7911 123456"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="medical-notes">Additional Notes</Label>
          <Textarea
            id="medical-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional medical information your doctor should know..."
            rows={3}
            className="mt-1.5"
          />
        </div>

        {/* Sharing Consent */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sharing-consent" className="font-medium">
                  Share with my doctors
                </Label>
                <Switch
                  id="sharing-consent"
                  checked={sharingConsent}
                  onCheckedChange={setSharingConsent}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, doctors who have completed a consultation with you
                can view your medical profile to provide better care. You can
                revoke access at any time by toggling this off.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Medical Profile"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
