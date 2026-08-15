import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPublicNumber(n: number): string {
  return `#${String(n).padStart(6, "0")}`;
}

export function wallTitle(event: { title?: string | null } | null | undefined): string {
  const title = event?.title?.trim();
  return title && title.length > 0 ? title : "THE WALL";
}

export function isDefaultWallTitle(title: string): boolean {
  return title.trim().toUpperCase() === "THE WALL";
}

export function formatEditionNumber(n: number): string {
  return `№${String(n).padStart(3, "0")}`;
}

export function parseEdition(value: string): number | null {
  const stripped = value.trim().replace(/^[№#]/, "");
  if (!/^\d{1,6}$/.test(stripped)) return null;
  const n = Number.parseInt(stripped, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function editionPath(n: number): string {
  return `/archive/${String(n).padStart(3, "0")}`;
}

export function editionMessagePath(edition: number, publicNumber: number): string {
  return `${editionPath(edition)}/${publicNumber}`;
}

export function editionNumberOf(event: { editionNumber?: number } | null | undefined): number {
  return event?.editionNumber && event.editionNumber > 0 ? event.editionNumber : 1;
}

export function formatEditionDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
    .format(new Date(iso))
    .toUpperCase();
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

function asOrigin(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function siteUrl(): string {
  const explicit = asOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;
  if (typeof window === "undefined") {
    const prod = asOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
    if (prod) return prod;
    const preview = asOrigin(process.env.VERCEL_URL);
    if (preview) return preview;
  }
  return "http://localhost:3000";
}
