import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  other: {
    "Cache-Control": "private, no-store",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
