import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { Card, contactName, PageHeader } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { updateContactAction } from "@/modules/contacts/actions";
import { formatCustomFields } from "@/modules/contacts/service";

export const metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  const { id } = await params;
  const { db } = await requireTenant();
  const contact = await db.contact.findFirst({ where: { id }, include: { tags: { include: { tag: true } } } });
  if (!contact) notFound();
  return (
    <>
      <PageHeader title={`Edit ${contactName(contact)}`} />
      <Card className="max-w-3xl">
        <ContactForm
          action={updateContactAction.bind(null, contact.id)}
          submitLabel="Save changes"
          values={{
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            company: contact.company ?? "",
            tags: contact.tags.map((t) => t.tag.name).join(", "),
            customFields: formatCustomFields(contact.customFields),
          }}
        />
      </Card>
    </>
  );
}
