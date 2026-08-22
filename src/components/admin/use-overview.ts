"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminOverview } from "@/lib/admin/types";

export function useAdminOverview(initial: AdminOverview) {
  const router = useRouter();
  const [source, setSource] = useState(initial);
  const [overview, setOverview] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  if (initial !== source) {
    setSource(initial);
    setOverview(initial);
  }

  async function refresh() {
    const res = await fetch("/api/admin/stats");
    if (res.status === 401 || res.status === 403) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.recovery ?? data.error ?? "Could not refresh.");
      return;
    }
    setOverview(data);
  }

  return { overview, error, setError, refresh };
}
