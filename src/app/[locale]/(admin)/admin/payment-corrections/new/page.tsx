import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { NewCorrectionForm } from "./new-correction-form";

export default async function NewPaymentCorrectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdminPage(locale);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Flag a payment correction</h1>
      <p className="text-sm text-muted-foreground">
        Any admin can flag. Only a named approver who did not create the row can approve it. Nothing here charges a patient card.
      </p>
      <NewCorrectionForm />
    </div>
  );
}
