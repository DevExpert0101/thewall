import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPublicNumber(n: number): string {
  return `#${String(n).padStart(6, "0")}`;
}

export function parsePublicNumber(value: string): number | null {
  const stripped = value.trim().replace(/^#/, "");
  if (!/^\d{1,8}$/.test(stripped)) return null;
  const n = Number.parseInt(stripped, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

export function formatUtcDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (typeof window === "undefined") {
    const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^https?:\/\//, "");
    if (prod) return `https://${prod.replace(/\/$/, "")}`;
    const preview = process.env.VERCEL_URL?.replace(/^https?:\/\//, "");
    if (preview) return `https://${preview.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
