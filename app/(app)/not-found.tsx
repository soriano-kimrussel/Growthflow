import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
      <h2 className="font-semibold text-slate-900">Not found</h2>
      <p className="mt-1 text-sm text-slate-500">That record doesn&apos;t exist in this sub-account.</p>
      <ButtonLink className="mt-4" href="/dashboard" variant="secondary">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
