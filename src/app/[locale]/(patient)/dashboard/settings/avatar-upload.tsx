"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadAvatar } from "./actions";

interface AvatarUploadProps {
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
}

export function AvatarUpload({
  avatarUrl,
  firstName,
  lastName,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const initials =
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";

  const displayUrl = preview || avatarUrl;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB).");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("avatar", file);

    startTransition(async () => {
      try {
        const result = await uploadAvatar(formData);

        if (result.error) {
          toast.error(result.error);
          setPreview(null);
          return;
        }

        toast.success("Profile photo updated.");
        setPreview(null);
        router.refresh();
      } catch (err) {
        console.error("Avatar upload failed:", err);
        toast.error("Failed to upload image. Please try again.");
        setPreview(null);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-6 p-6">
        <div className="relative">
          <Avatar className="h-20 w-20">
            {displayUrl ? (
              <AvatarImage src={displayUrl} alt={`${firstName} ${lastName}`} />
            ) : null}
            <AvatarFallback className="bg-muted text-xl font-semibold text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-medium">
            {firstName} {lastName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Upload a profile photo. JPEG, PNG or WebP, max 5MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <Camera className="mr-2 h-4 w-4" />
            {avatarUrl ? "Change Photo" : "Upload Photo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
