import type { FormAction } from "@/lib/action-state";
import { ActionForm, SubmitButton } from "./action-form";
import { Field, Input, Textarea } from "./ui";

export interface ContactFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  tags: string;
  customFields: string;
}

export function ContactForm({ action, values, submitLabel }: { action: FormAction; values?: Partial<ContactFormValues>; submitLabel: string }) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" aria-label="Contact form">
      <Field label="First name" htmlFor="firstName">
        <Input id="firstName" name="firstName" defaultValue={values?.firstName} required />
      </Field>
      <Field label="Last name" htmlFor="lastName">
        <Input id="lastName" name="lastName" defaultValue={values?.lastName} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={values?.email} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={values?.phone} />
      </Field>
      <Field label="Company" htmlFor="company">
        <Input id="company" name="company" defaultValue={values?.company} />
      </Field>
      <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. lead, vip">
        <Input id="tags" name="tags" defaultValue={values?.tags} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Custom fields" htmlFor="customFields" hint='One per line as "key: value". Use in templates as {{custom.key}}.'>
          <Textarea id="customFields" name="customFields" rows={3} defaultValue={values?.customFields} placeholder={"plan: Pro\nlead_source: Website"} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Saving...">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
