import { ContactForm } from "@/components/contact-form";
import { Card, PageHeader } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { createContactAction } from "@/modules/contacts/actions";

export const metadata = { title: "New contact" };

export default async function NewContactPage() {
  await requireTenant();
  return (
    <>
      <PageHeader title="New contact" />
      <Card className="max-w-3xl">
        <ContactForm action={createContactAction} submitLabel="Create contact" />
      </Card>
    </>
  );
}
