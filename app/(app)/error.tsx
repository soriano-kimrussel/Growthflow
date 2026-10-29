"use client";

import { Button } from "@/components/ui";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
      <h2 className="font-semibold text-slate-900">Something went wrong</h2>
      <p className="mt-1 text-sm text-slate-500">{process.env.NODE_ENV === "development" ? error.message : "Please try again."}</p>
      <Button className="mt-4" variant="secondary" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
