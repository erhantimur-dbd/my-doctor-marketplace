"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

export function UnsubscribeClient({
  status,
  message,
}: {
  status: "success" | "error" | "invalid";
  message: string;
}) {
  const ok = status === "success";
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      {ok ? (
        <CheckCircle2 className="h-12 w-12 text-green-600" />
      ) : (
        <XCircle className="h-12 w-12 text-muted-foreground" />
      )}
      <h1 className="mt-4 text-2xl font-bold">
        {ok ? "Unsubscribed" : "Unable to unsubscribe"}
      </h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <Button className="mt-6" asChild>
        <Link href="/doctors">Find a doctor</Link>
      </Button>
    </div>
  );
}
