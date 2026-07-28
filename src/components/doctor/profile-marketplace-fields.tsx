"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  User,
  Video,
  Loader2,
  Upload,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { INSURERS } from "@/lib/constants/insurers";
import { DOCTOR_GENDERS } from "@/lib/constants/gender";
import {
  updateAcceptedInsurers,
  updateDoctorGender,
  submitProfileVideo,
  removeProfileVideo,
  listOwnFaqs,
  upsertDoctorFaq,
  deleteDoctorFaq,
} from "@/actions/doctor-profile-extras";

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

interface Props {
  doctorId: string;
  initialInsurers: string[];
  initialGender: string | null;
  initialVideoPath: string | null;
  initialVideoStatus: string | null;
  initialVideoRejectionReason: string | null;
}

const MAX_VIDEO_MB = 50;
const ACCEPTED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function publicUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return `${base}/storage/v1/object/public/${path}`;
}

export function ProfileMarketplaceFields({
  doctorId,
  initialInsurers,
  initialGender,
  initialVideoPath,
  initialVideoStatus,
  initialVideoRejectionReason,
}: Props) {
  const [insurers, setInsurers] = useState<string[]>(initialInsurers);
  const [gender, setGender] = useState<string>(initialGender || "prefer_not_to_say");
  const [savingInsurers, setSavingInsurers] = useState(false);
  const [savingGender, setSavingGender] = useState(false);

  const [videoPath, setVideoPath] = useState(initialVideoPath);
  const [videoStatus, setVideoStatus] = useState(initialVideoStatus);
  const [rejectionReason, setRejectionReason] = useState(initialVideoRejectionReason);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [savingFaq, setSavingFaq] = useState(false);

  useEffect(() => {
    listOwnFaqs().then((res) => {
      if (res.faqs) setFaqs(res.faqs as FaqRow[]);
    });
  }, []);

  async function saveInsurers() {
    setSavingInsurers(true);
    const res = await updateAcceptedInsurers(insurers);
    setSavingInsurers(false);
    if (res.error) toast.error(res.error);
    else toast.success("Insurers updated");
  }

  async function saveGender() {
    setSavingGender(true);
    const value = gender === "prefer_not_to_say" ? "prefer_not_to_say" : gender;
    const res = await updateDoctorGender(value);
    setSavingGender(false);
    if (res.error) toast.error(res.error);
    else toast.success("Gender preference updated");
  }

  function toggleInsurer(value: string) {
    setInsurers((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_VIDEO.includes(file.type)) {
      toast.error("Only MP4, WebM, or MOV videos are accepted.");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Video must be under ${MAX_VIDEO_MB}MB.`);
      return;
    }

    setUploading(true);
    const supabase = createSupabase();
    const ext = file.name.split(".").pop() || "mp4";
    const filePath = `doctor-videos/${doctorId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("public")
      .upload(filePath, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      setUploading(false);
      toast.error("Upload failed. Please try again.");
      return;
    }

    const storagePath = `public/${filePath}`;
    const res = await submitProfileVideo(storagePath);
    setUploading(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    setVideoPath(storagePath);
    setVideoStatus("pending");
    setRejectionReason(null);
    toast.success("Video submitted for MyDoctors360 approval");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemoveVideo() {
    setRemoving(true);
    const res = await removeProfileVideo();
    setRemoving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setVideoPath(null);
    setVideoStatus(null);
    setRejectionReason(null);
    toast.success("Video removed");
  }

  async function handleAddFaq() {
    setSavingFaq(true);
    const res = await upsertDoctorFaq({
      question: faqQuestion,
      answer: faqAnswer,
    });
    setSavingFaq(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setFaqQuestion("");
    setFaqAnswer("");
    const refreshed = await listOwnFaqs();
    setFaqs((refreshed.faqs || []) as FaqRow[]);
    toast.success("FAQ added");
  }

  async function handleDeleteFaq(id: string) {
    const res = await deleteDoctorFaq(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setFaqs((prev) => prev.filter((f) => f.id !== id));
    toast.success("FAQ deleted");
  }

  const videoUrl = publicUrl(videoPath);

  return (
    <div className="space-y-6">
      {/* Insurers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Accepted insurance
          </CardTitle>
          <CardDescription>
            Select private medical insurers you accept. Patients can filter search results by insurer.
            Editable after verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {INSURERS.map((ins) => (
              <label
                key={ins.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={insurers.includes(ins.value)}
                  onCheckedChange={() => toggleInsurer(ins.value)}
                />
                {ins.label}
              </label>
            ))}
          </div>
          <Button onClick={saveInsurers} disabled={savingInsurers} size="sm">
            {savingInsurers ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save insurers
          </Button>
        </CardContent>
      </Card>

      {/* Gender */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Gender
          </CardTitle>
          <CardDescription>
            Optional. Used only so patients can filter by preference. “Prefer not to say” is never shown publicly.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2 min-w-[200px]">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCTOR_GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveGender} disabled={savingGender} size="sm">
            {savingGender ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Profile video */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" />
            Profile intro video
          </CardTitle>
          <CardDescription>
            Upload a short introduction (MP4/WebM/MOV, max {MAX_VIDEO_MB}MB). Videos stay private until the
            MyDoctors360 team approves them for your public profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {videoStatus && (
            <div className="flex flex-wrap items-center gap-2">
              {videoStatus === "pending" && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" /> Pending approval
                </Badge>
              )}
              {videoStatus === "approved" && (
                <Badge className="gap-1 bg-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Live on profile
                </Badge>
              )}
              {videoStatus === "rejected" && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Rejected
                </Badge>
              )}
              {rejectionReason && (
                <p className="w-full text-sm text-muted-foreground">Reason: {rejectionReason}</p>
              )}
            </div>
          )}

          {videoUrl && (
            <video
              src={videoUrl}
              controls
              className="max-h-64 w-full rounded-lg border bg-black"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_VIDEO.join(",")}
              className="hidden"
              onChange={handleVideoUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {videoPath ? "Replace video" : "Upload video"}
            </Button>
            {videoPath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removing}
                onClick={handleRemoveVideo}
              >
                {removing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4" />
            Profile FAQs
          </CardTitle>
          <CardDescription>
            Common questions shown on your public profile (max 12). Great for SEO and patient trust.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.length > 0 && (
            <ul className="space-y-3">
              {faqs.map((faq) => (
                <li key={faq.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{faq.question}</p>
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                        {faq.answer}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteFaq(faq.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label>Question</Label>
            <Input
              value={faqQuestion}
              onChange={(e) => setFaqQuestion(e.target.value)}
              placeholder="e.g. Do you accept new patients?"
              maxLength={300}
            />
            <Label>Answer</Label>
            <Textarea
              value={faqAnswer}
              onChange={(e) => setFaqAnswer(e.target.value)}
              placeholder="Your answer…"
              rows={3}
              maxLength={2000}
            />
            <Button
              type="button"
              size="sm"
              disabled={savingFaq || !faqQuestion.trim() || !faqAnswer.trim()}
              onClick={handleAddFaq}
            >
              {savingFaq ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add FAQ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
