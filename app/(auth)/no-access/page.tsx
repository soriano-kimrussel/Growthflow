import { Button } from "@/components/ui";
import { logoutAction } from "@/modules/auth/actions";

export const metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">No sub-account yet</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Your account isn&apos;t a member of any sub-account. Ask an admin to invite you.
      </p>
      <form action={logoutAction}>
        <Button variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </>
  );
}
