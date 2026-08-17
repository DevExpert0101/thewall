import { siteUrl } from "@/lib/utils";

export function absoluteUrl(path: string, origin = siteUrl()): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const prefix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${prefix === "/" ? "" : prefix}`;
}

export function redditFriendlyUrl(path: string, origin = siteUrl()): string {
  return absoluteUrl(path, origin);
}

export function xShareUrl(text: string, url: string): string {
  const intent = new URL("https://twitter.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  return intent.toString();
}

export function telegramShareUrl(url: string, text: string): string {
  const share = new URL("https://t.me/share/url");
  share.searchParams.set("url", url);
  share.searchParams.set("text", text);
  return share.toString();
}

export function redditShareUrl(url: string, title: string): string {
  const submit = new URL("https://www.reddit.com/submit");
  submit.searchParams.set("url", url);
  submit.searchParams.set("title", title);
  return submit.toString();
}

const SHARE_PATH = /^\/(?:wall|watch|open|archive|about|how-it-works|records)?$/;
const MESSAGE_PATH = /^\/message\/(\d{1,8})(?:\/certificate)?$/;
const EDITION_PATH = /^\/archive\/\d{1,6}(?:\/(?:records|\d{1,8}))?$/;

export function parseShareableUrl(raw: string, origin = siteUrl()): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const allowed = new URL(origin);
  if (parsed.origin !== allowed.origin) return null;
  const path = parsed.pathname.replace(/\/$/, "") || "/";
  if (path === "/" || SHARE_PATH.test(path) || MESSAGE_PATH.test(path) || EDITION_PATH.test(path)) {
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = path;
    return parsed;
  }
  return null;
}

export function oembedEndpoint(canonicalUrl: string, origin = siteUrl()): string {
  const href = new URL("/api/oembed", origin);
  href.searchParams.set("url", canonicalUrl);
  href.searchParams.set("format", "json");
  return href.toString();
}

type CreativeImageInput = {
  kind: "countdown" | "milestone" | "message" | "certificate";
  ratio?: string;
  number?: number;
  edition?: number;
  mark?: number;
  fire?: number;
};

/** Same-origin path. Use this for <img> and downloads so Vercel never points at localhost. */
export function creativeImagePath(input: CreativeImageInput): string {
  const href = new URL("/api/creatives", "https://thewall.local");
  href.searchParams.set("kind", input.kind);
  href.searchParams.set("ratio", input.ratio ?? "1200x630");
  if (input.number) href.searchParams.set("number", String(input.number));
  if (input.edition) href.searchParams.set("edition", String(input.edition));
  if (input.mark) href.searchParams.set("mark", String(input.mark));
  if (input.fire) href.searchParams.set("fire", String(input.fire));
  return `${href.pathname}${href.search}`;
}

export function creativeImageUrl(input: CreativeImageInput & { origin?: string }): string {
  return `${input.origin ?? siteUrl()}${creativeImagePath(input)}`;
}

export function messageNumberFromSharePath(path: string): number | null {
  const message = path.match(/\/message\/(\d{1,8})(?:\/|$)/);
  if (message) return Number(message[1]);
  const edition = path.match(/\/archive\/\d{1,6}\/(\d{1,8})(?:\/|$)/);
  if (edition) return Number(edition[1]);
  return null;
}

export function editionNumberFromSharePath(path: string): number | null {
  const match = path.match(/^\/archive\/(\d{1,6})(?:\/|$)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}
