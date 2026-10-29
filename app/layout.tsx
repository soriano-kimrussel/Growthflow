import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GrowthFlow", template: "%s · GrowthFlow" },
  description: "CRM and marketing automation for agencies. A local-first portfolio build.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (autofill, password managers) inject attributes into
    // <html>/<body> before hydration. This silences attribute mismatches on
    // these two elements only; their children are still checked.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-slate-50 text-slate-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
