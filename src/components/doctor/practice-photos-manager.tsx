"use client";

import { useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Trash2,
  Star,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

interface Photo {
  id: string;
  storage_path: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

interface PracticePhotosManagerProps {
  doctorId: string;
  initialPhotos: Photo[];
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function getPhotoUrl(path: string) {
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return `${base}/storage/v1/object/public/${path}`;
}

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PracticePhotosManager({
  doctorId,
  initialPhotos,
}: PracticePhotosManagerProps) {
  const [photos, setPhotos] = useState<Photo[]>(
    [...initialPhotos].sort((a, b) => a.display_order - b.display_order)
  );
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed.`);
      return;
    }

    setUploading(true);
    const supabase = createSupabase();

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Only JPEG, PNG, and WebP files are accepted.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File must be under 5MB.`);
        continue;
      }

      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `doctor-photos/${doctorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("public")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}.`);
        continue;
      }

      const storagePath = `public/${filePath}`;
      const { data: photoRecord, error: insertError } = await supabase
        .from("doctor_photos")
        .insert({
          doctor_id: doctorId,
          storage_path: storagePath,
          alt_text: null,
          display_order: photos.length,
          is_primary: photos.length === 0,
        })
        .select()
        .single();

      if (insertError || !photoRecord) {
        toast.error(`Failed to save ${file.name}.`);
        continue;
      }

      setPhotos((prev) => [...prev, photoRecord as Photo]);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Photos uploaded.");
  }

  async function handleDelete(photo: Photo) {
    setDeletingId(photo.id);
    const supabase = createSupabase();

    // Delete from storage
    const bucketPath = photo.storage_path.replace(/^public\//, "");
    await supabase.storage.from("public").remove([bucketPath]);

    // Delete DB record
    await supabase.from("doctor_photos").delete().eq("id", photo.id);

    const remaining = photos.filter((p) => p.id !== photo.id);

    // If we deleted the primary, make the first remaining photo primary
    if (photo.is_primary && remaining.length > 0) {
      remaining[0].is_primary = true;
      await supabase
        .from("doctor_photos")
        .update({ is_primary: true })
        .eq("id", remaining[0].id);
    }

    setPhotos(remaining);
    setDeletingId(null);
    toast.success("Photo deleted.");
  }

  async function handleSetPrimary(photo: Photo) {
    const supabase = createSupabase();

    // Unset current primary
    await supabase
      .from("doctor_photos")
      .update({ is_primary: false })
      .eq("doctor_id", doctorId);

    // Set new primary
    await supabase
      .from("doctor_photos")
      .update({ is_primary: true })
      .eq("id", photo.id);

    setPhotos((prev) =>
      prev.map((p) => ({ ...p, is_primary: p.id === photo.id }))
    );
    toast.success("Primary photo updated.");
  }

  async function handleUpdateAltText(photoId: string, altText: string) {
    const supabase = createSupabase();
    await supabase
      .from("doctor_photos")
      .update({ alt_text: altText || null })
      .eq("id", photoId);

    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, alt_text: altText || null } : p))
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Practice Photos
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {photos.length}/{MAX_PHOTOS}
          </span>
          {photos.length < MAX_PHOTOS && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <ImageIcon className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium">Upload clinic photos</p>
            <p className="text-xs mt-1">JPEG, PNG, or WebP up to 5MB each</p>
          </button>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative rounded-lg border overflow-hidden">
                <div className="aspect-video relative bg-muted">
                  <img
                    src={getPhotoUrl(photo.storage_path)}
                    alt={photo.alt_text || "Practice photo"}
                    className="h-full w-full object-cover"
                  />
                  {photo.is_primary && (
                    <Badge className="absolute left-2 top-2 gap-1 bg-amber-500 hover:bg-amber-600">
                      <Star className="h-3 w-3 fill-white" />
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Alt text</Label>
                    <Input
                      placeholder="Describe this photo..."
                      defaultValue={photo.alt_text || ""}
                      className="h-8 text-xs"
                      onBlur={(e) =>
                        handleUpdateAltText(photo.id, e.target.value)
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    {!photo.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={() => handleSetPrimary(photo)}
                      >
                        <Star className="mr-1 h-3 w-3" />
                        Set Primary
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(photo)}
                      disabled={deletingId === photo.id}
                    >
                      {deletingId === photo.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
