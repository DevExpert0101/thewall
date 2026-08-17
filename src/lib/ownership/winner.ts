import type { EditionHighlight } from "@/lib/types";

/** Public winner plaque. Never includes ownership, payment, or identity. */
export type PublicWinner = {
  editionNumber: number;
  publicNumber: number;
  text: string;
  reactionCount: number;
  isRemoved: boolean;
};

export function publicWinnerFrom(
  editionNumber: number,
  winning: EditionHighlight | null | undefined,
): PublicWinner | null {
  if (!winning) return null;
  return {
    editionNumber,
    publicNumber: winning.publicNumber,
    text: winning.text,
    reactionCount: winning.reactionCount,
    isRemoved: winning.isRemoved,
  };
}
