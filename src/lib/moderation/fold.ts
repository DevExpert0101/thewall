const INVISIBLE =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u180E\uFE00-\uFE0F]/g;

/** Common lookalikes used to evade phrase checks. Stored text is not rewritten. */
const HOMOGLYPHS: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  ј: "j",
  ѕ: "s",
  ї: "i",
  α: "a",
  ο: "o",
  ρ: "p",
  τ: "t",
  ν: "v",
  κ: "k",
  η: "n",
  ω: "w",
};

export function foldForModeration(text: string): string {
  const nfkc = text.normalize("NFKC").toLowerCase().replace(INVISIBLE, "");
  return [...nfkc].map((ch) => HOMOGLYPHS[ch] ?? ch).join("");
}
