"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction, str } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { parseMoneyToCents } from "@/lib/money";
import { getPaymentsProvider } from "@/lib/providers/payments";
import { logActivity } from "@/modules/timeline/service";
import { formatCents } from "@/lib/money";
import { addNote, createContact, deleteContact, updateContact, type ContactInput } from "./service";

function contactInput(formData: FormData): ContactInput {
  return {
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    company: str(formData, "company"),
    tags: str(formData, "tags"),
    customFields: str(formData, "customFields"),
  };
}

export async function createContactAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const { db, user } = await requirePermission("contacts:write");
    id = (await createContact(db, contactInput(formData), { actor: user.name })).id;
  });
  if (result?.error) return result;
  revalidatePath("/", "layout");
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const { db, user } = await requirePermission("contacts:write");
    await updateContact(db, id, contactInput(formData), { actor: user.name });
  });
  if (result?.error) return result;
  revalidatePath("/", "layout");
  redirect(`/contacts/${id}`);
}

export async function deleteContactAction(id: string): Promise<ActionState> {
  const result = await runAction(async () => {
    const { db } = await requirePermission("contacts:delete");
    await deleteContact(db, id);
  });
  if (result?.error) return result;
  revalidatePath("/", "layout");
  redirect("/contacts");
}

export async function addNoteAction(contactId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db, user } = await requirePermission("notes:write");
    await addNote(db, contactId, str(formData, "body"), user.name);
    revalidatePath(`/contacts/${contactId}`);
  });
}

export async function collectPaymentAction(contactId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("payments:collect");
    const amount = parseMoneyToCents(str(formData, "amount"));
    if (!amount) throw new Error("Enter an amount like 250 or 99.50");
    const description = str(formData, "description").trim() || "Payment";
    const contact = await db.contact.findFirst({ where: { id: contactId }, select: { id: true } });
    if (!contact) throw new Error("Contact not found");
    const result = await getPaymentsProvider(db).charge({ contactId, amount, currency: "usd", description });
    await logActivity(db, contactId, "payment", `Payment of ${formatCents(amount)} ${result.status}`, `${description} (${result.provider}: ${result.externalId})`);
    revalidatePath(`/contacts/${contactId}`);
    return `Charged ${formatCents(amount)} (simulated)`;
  });
}
