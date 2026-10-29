import Link from "next/link";
import { Badge, ButtonLink, buttonClass, Card, contactName, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { requireTenant } from "@/lib/auth/context";
import { formatDate } from "@/lib/time";
import { listContacts } from "@/modules/contacts/service";
import { listTags } from "@/modules/tags/service";

export const metadata = { title: "Contacts" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const params = await searchParams;
  const q = one(params.q) ?? "";
  const tag = one(params.tag) ?? "";
  const page = Number(one(params.page) ?? "1") || 1;
  const { db, subAccount } = await requireTenant();
  const [{ rows, total, pageCount }, tags] = await Promise.all([listContacts(db, { q, tag, page }), listTags(db)]);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (tag) sp.set("tag", tag);
    sp.set("page", String(p));
    return `/contacts?${sp}`;
  };

  return (
    <>
      <PageHeader title="Contacts" description={`${total} contact${total === 1 ? "" : "s"}`} actions={<ButtonLink href="/contacts/new">New contact</ButtonLink>} />
      <Card>
        <form className="mb-4 flex flex-wrap gap-2" role="search">
          <Input name="q" defaultValue={q} placeholder="Search name, email, phone, company" className="max-w-xs" aria-label="Search contacts" />
          <Select name="tag" defaultValue={tag} className="max-w-[12rem]" aria-label="Filter by tag">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} ({t._count.contacts})
              </option>
            ))}
          </Select>
          <button className={buttonClass("secondary")}>Filter</button>
          {q || tag ? (
            <Link href="/contacts" className={buttonClass("ghost")}>
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Phone</th>
                  <th className="py-2 pr-4 font-medium">Company</th>
                  <th className="py-2 pr-4 font-medium">Tags</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-indigo-700 hover:underline">
                        {contactName(c)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{c.email}</td>
                    <td className="py-2 pr-4 text-slate-600">{c.phone}</td>
                    <td className="py-2 pr-4 text-slate-600">{c.company}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <Badge key={t.id} tone="indigo">
                            {t.tag.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-slate-500">{formatDate(c.createdAt, subAccount.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No contacts found">{q || tag ? "Try a different search." : "Add your first contact."}</EmptyState>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Page {Math.min(page, pageCount)} of {pageCount}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link className={buttonClass("secondary", "sm")} href={pageHref(page - 1)}>
                  Previous
                </Link>
              ) : null}
              {page < pageCount ? (
                <Link className={buttonClass("secondary", "sm")} href={pageHref(page + 1)}>
                  Next
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </Card>
    </>
  );
}
