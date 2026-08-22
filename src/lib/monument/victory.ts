import { BRAND } from "@/lib/brand";
import {
  formatInscriptionMark,
  formatMonumentEntryMark,
  formatMonumentNumber,
  formatVictorOfWall,
} from "@/lib/monument/format";
import type { MonumentEntry } from "@/lib/monument/types";
import { formatCount, formatPublicDate, formatWallPlace } from "@/lib/utils";

export function proofOfVictoryText(entry: MonumentEntry): string {
  const lines = [
    BRAND.monumentWordmark,
    "PROOF OF VICTORY",
    "",
    formatMonumentNumber(entry.monumentNumber),
    `Victor of:`,
    entry.themeTitle,
    "",
    "Original Inscription:",
    formatInscriptionMark(entry.originalPublicNumber),
    "",
    entry.isRemoved ? entry.text : `“${entry.text}”`,
    "",
    `${formatCount(entry.wallTotalMessages)} inscriptions competed.`,
    `${formatCount(entry.finalReactionCount)} 🔥`,
    `Winning margin: ${formatCount(entry.winningMargin)} 🔥`,
    formatVictorOfWall(entry.editionNumber),
    "",
    "This inscription ranked first when the Wall was sealed.",
    "It now occupies:",
    formatMonumentEntryMark(entry.monumentNumber),
    "permanently.",
    "",
    `Sealed ${formatPublicDate(entry.sealedAt)}.`,
  ];
  if (entry.archiveHash) {
    lines.push(`Archive ${entry.archiveHash.slice(0, 16)}…`);
  }
  lines.push("", "This is not a public identity.", "The Monument remains anonymous.");
  return `${lines.join("\n")}\n`;
}

export function optionalOwnershipStatement(entry: MonumentEntry): string {
  return [
    `I wrote ${formatMonumentNumber(entry.monumentNumber)}.`,
    `I wrote the sentence that became Victor of ${formatWallPlace(entry.editionNumber)}.`,
  ].join("\n") + "\n";
}
