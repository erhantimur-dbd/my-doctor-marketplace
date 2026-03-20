"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Stethoscope, ShieldCheck, ArrowRight } from "lucide-react";

interface Props {
  locale: string;
  tier?: string;
}

export function ClinicGetStartedButton({ locale, tier = "clinic" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function choose(role: "doctor" | "admin") {
    setOpen(false);
    router.push(`/${locale}/register-doctor?tier=${tier}&owner_role=${role}`);
  }

  return (
    <>
      <Button
        className="w-full rounded-full"
        variant="default"
        onClick={() => setOpen(true)}
      >
        Get Started
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>What&apos;s your role?</DialogTitle>
            <DialogDescription>
              This helps us set up the right experience for you. You can always add
              doctors and admin users after signing up.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <button
              onClick={() => choose("doctor")}
              className="w-full rounded-xl border-2 border-transparent p-4 text-left transition-all hover:border-sky-400 hover:bg-sky-50 focus:outline-none focus:border-sky-400"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                  <Stethoscope className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">I&apos;m a Doctor</p>
                  <p className="text-sm text-muted-foreground">
                    I&apos;ll see patients and manage my own schedule
                  </p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
              </div>
            </button>

            <button
              onClick={() => choose("admin")}
              className="w-full rounded-xl border-2 border-transparent p-4 text-left transition-all hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:border-purple-400"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                  <ShieldCheck className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold">I&apos;m a Clinic Manager / Admin</p>
                  <p className="text-sm text-muted-foreground">
                    I manage the clinic and will invite doctors to join
                  </p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
              </div>
            </button>
          </div>

          <p className="mt-2 text-xs text-center text-muted-foreground">
            Not sure? You can change this later.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
