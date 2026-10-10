import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageSkeleton } from "@/components/common/page";

/** The app renders client-side data after hydration; navigations are not expected to be instant. */
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AppShell>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </AppShell>
    </Suspense>
  );
}
