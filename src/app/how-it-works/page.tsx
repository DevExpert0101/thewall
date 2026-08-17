import type { Metadata } from "next";
import { HowItWorks } from "@/components/how-it-works";
import { siteUrl } from "@/lib/utils";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How a sentence is paid for, numbered, reacted to, frozen, sealed, and checked — without claiming more than the system can do.",
  alternates: { canonical: `${siteUrl()}/how-it-works` },
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
