/**
 * Canonical product language for The Wall.
 *
 * Use these strings on visitor surfaces. Code may keep event, editionNumber,
 * claimKey, and token as internal names — never as public copy.
 *
 * Prefer:
 *   The Wall          not event / wall instance
 *   The Wall №001     not edition / this event
 *   Message #004291   not post / submission / object
 *   Inscription       Monument/Victor surfaces for a paid sentence
 *   The Victor        the sealed #1 of a Wall
 *   The Monument      the permanent library of Victors
 *   Wall Key          not token / secret / password / claim key
 *   Ownership Receipt not private receipt / ownership card
 *   Certificate       not public object
 *   Archive           not history
 *   Record Book       not edition stats
 *   Rising / Most 🔥 / Random
 *   Leave your mark
 *   The Wall has closed
 */

export const BRAND = {
  name: "The Wall",
  wordmark: "THE WALL",
  message: "Message",
  inscription: "Inscription",
  victor: "The Victor",
  victorMark: "THE VICTOR",
  monument: "The Monument",
  monumentWordmark: "THE MONUMENT",
  wallKey: "Wall Key",
  wallKeyYours: "YOUR WALL KEY",
  wallKeyContains: "Contains Wall Key. Never share.",
  ownershipReceipt: "Ownership Receipt",
  ownershipReceiptMark: "OWNERSHIP RECEIPT",
  certificate: "Certificate",
  certificatePublic: "PUBLIC CERTIFICATE",
  archive: "Archive",
  recordBook: "Record Book",
  leaveYourMark: "Leave your mark",
  leaveYourMarkCta: "Leave your mark — $1",
  closed: "The Wall has closed",
  closedMark: "THE WALL HAS CLOSED.",
  closedSentence: "The Wall has closed.",
  enterArchive: "Enter the Archive",
  sorts: {
    rising: "Rising",
    hot: "Most 🔥",
    new: "New",
    random: "Random",
    gems: "Hidden gems",
    final: "Final hour",
  },
} as const;

export type BrandSortId = keyof typeof BRAND.sorts;
