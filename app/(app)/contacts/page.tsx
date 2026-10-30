import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter, Plus, Search, Users } from "lucide-react";
import { Avatar, ButtonLink, buttonClass, contactName, cx, EmptyState, PageHeader, Select, swatch, TagChip } from "@/components/ui";
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

  const href = (next: { page?: number; tag?: string }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const t = next.tag ?? tag;
    if (t) sp.set("tag", t);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const qs = sp.toString();
    return qs ? `/contacts?${qs}` : "/contacts";
  };
  const topTags = [...tags].sort((a, b) => b._count.contacts - a._count.contacts).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${total.toLocaleString("en-US")} contact${total === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}${tag ? ` tagged ${tag}` : ""}`}
        actions={
          <ButtonLink href="/contacts/new">
            <Plus className="h-4 w-4" /> New contact
          </ButtonLink>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <form className="flex flex-1 flex-wrap items-center gap-2" role="search">
            <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name, email, phone, company"
                aria-label="Search contacts"
                className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
            <Select name="tag" defaultValue={tag} className="h-9 max-w-[12rem] py-1.5" aria-label="Filter by tag">
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name} ({t._count.contacts})
                </option>
              ))}
            </Select>
            <button className={buttonClass("secondary")}>
              <Filter className="h-4 w-4" /> Apply
            </button>
            {q || tag ? (
              <Link href="/contacts" className={buttonClass("ghost")}>
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        {topTags.length ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-slate-50/60 px-4 py-2.5">
            <span className="mr-1 text-xs text-slate-500">Quick filters:</span>
            {topTags.map((t) => (
              <Link
                key={t.id}
                href={href({ tag: t.name === tag ? "" : t.name })}
                className={cx(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-opacity",
                  swatch(t.name),
                  tag && t.name !== tag && "opacity-50 hover:opacity-100",
                )}
              >
                {t.name}
                <span className="opacity-60">{t._count.contacts}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Company</th>
                  <th className="px-4 py-2.5">Tags</th>
                  <th className="px-4 py-2.5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={contactName(c)} />
                        <div className="min-w-0">
                          <Link href={`/contacts/${c.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">
                            {contactName(c)}
                          </Link>
                          <p className="truncate text-xs text-slate-500">{c.email ?? "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{c.phone ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{c.company ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <TagChip key={t.id} name={t.tag.name} />
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-500">{formatDate(c.createdAt, subAccount.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState title="No contacts found" icon={Users}>
              {q || tag ? "Try a different search or filter." : "Add your first contact to get started."}
            </EmptyState>
          </div>
        )}

        <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <span className="text-slate-500">
            Page {Math.min(page, pageCount)} of {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link className={buttonClass("secondary", "sm")} href={href({ page: page - 1 })}>
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link className={buttonClass("secondary", "sm")} href={href({ page: page + 1 })}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </nav>
      </section>
    </>
  );
}
