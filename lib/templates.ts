export interface MergeContact {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  customFields?: string | Record<string, string>;
}

function parseCustom(value: MergeContact["customFields"]): Record<string, string> {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Renders `{{merge_field}}` placeholders. Supported fields: first_name,
 * last_name, full_name, email, phone, company, and custom.<key>. Unknown
 * fields render as an empty string.
 */
export function renderTemplate(template: string, contact: MergeContact): string {
  const custom = parseCustom(contact.customFields);
  const fields: Record<string, string> = {
    first_name: contact.firstName,
    last_name: contact.lastName,
    full_name: `${contact.firstName} ${contact.lastName}`.trim(),
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    company: contact.company ?? "",
  };
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    if (key.startsWith("custom.")) return custom[key.slice(7)] ?? "";
    return fields[key] ?? "";
  });
}

export const MERGE_FIELDS = ["first_name", "last_name", "full_name", "email", "phone", "company", "custom.<key>"];
