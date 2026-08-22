import { BRAND } from "@/lib/brand";
import { formatPublicNumber, formatWallEdition, formatWallPlace, monumentPath } from "@/lib/utils";

export { monumentPath };

export function formatMonumentNumber(n: number): string {
  return `M-${String(n).padStart(4, "0")}`;
}

export function parseMonumentNumber(value: string): number | null {
  const stripped = value.trim().replace(/^m-?/i, "");
  if (!/^\d{1,6}$/.test(stripped)) return null;
  const n = Number.parseInt(stripped, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function formatInscriptionMark(publicNumber: number): string {
  return `${BRAND.inscription.toUpperCase()} ${formatPublicNumber(publicNumber)}`;
}

export function formatVictorOfWall(editionNumber: number): string {
  return `Victor of ${formatWallPlace(editionNumber)}`;
}

export function formatMonumentEntryMark(n: number): string {
  return `MONUMENT ENTRY ${formatMonumentNumber(n)}`;
}

export function monumentCapacityLine(sealed: number, capacity: number | null): string | null {
  if (capacity == null) return null;
  return `${sealed} OF ${capacity} POSITIONS SEALED`;
}

export function themeTitleOf(event: { title?: string | null }): string {
  const title = event.title?.trim();
  return title && title.length > 0 ? title : BRAND.wordmark;
}

export function formatVictorIdentity(publicNumber: number, editionNumber: number): string {
  return `${formatWallEdition(editionNumber)} / ${formatInscriptionMark(publicNumber)}`;
}
