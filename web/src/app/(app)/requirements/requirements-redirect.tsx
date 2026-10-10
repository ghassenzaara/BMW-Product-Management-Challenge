"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api/hooks";
import { PageSkeleton } from "@/components/common/page";

/** Requirements live in the vehicle plan now; old links land there. */
export function RequirementsRedirect() {
  const me = useApi("me");
  const router = useRouter();
  const series = me.data?.workspace.series;
  useEffect(() => {
    if (series) router.replace(`/plan/${series}`);
  }, [series, router]);
  return <PageSkeleton />;
}
