import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { ogCopyForEvent, ogCopyForMessage } from "@/lib/share/copy";
import { creativeImageUrl, oembedEndpoint } from "@/lib/share/links";
import type { EventSnapshot, PublicMessage } from "@/lib/types";
import { siteUrl } from "@/lib/utils";
import { colors } from "@/lib/design/tokens";

const OG_SIZE = { width: 1200, height: 630 };

function imageField(url: string, alt: string) {
  return {
    url,
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    alt,
    type: "image/png" as const,
  };
}

export function publicPageMetadata(input: {
  event: EventSnapshot;
  path: string;
  kind?: "countdown" | "milestone";
}): Metadata {
  const origin = siteUrl();
  const canonical = input.path === "/" ? origin : `${origin}${input.path}`;
  const copy = ogCopyForEvent(input.event);
  const image = creativeImageUrl({
    kind: input.kind ?? (input.path === "/archive" ? "milestone" : "countdown"),
    ratio: "1200x630",
  });
  return {
    title: { absolute: copy.title },
    description: copy.description,
    applicationName: APP_NAME,
    alternates: {
      canonical,
      types: {
        "application/json+oembed": oembedEndpoint(canonical),
      },
    },
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: copy.title,
      description: copy.description,
      url: canonical,
      images: [imageField(image, copy.title)],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [image],
    },
    other: {
      "theme-color": colors.void,
      "event:start_time": input.event.startsAt,
      "event:end_time": input.event.endsAt,
    },
  };
}

export function publicMessageMetadata(input: {
  event: EventSnapshot;
  message: PublicMessage;
}): Metadata {
  const origin = siteUrl();
  const canonical = `${origin}/message/${input.message.publicNumber}`;
  const copy = ogCopyForMessage(input);
  const image = creativeImageUrl({
    kind: "message",
    ratio: "1200x630",
    number: input.message.publicNumber,
  });
  return {
    title: { absolute: copy.title },
    description: copy.description,
    alternates: {
      canonical,
      types: {
        "application/json+oembed": oembedEndpoint(canonical),
      },
    },
    openGraph: {
      type: "article",
      siteName: APP_NAME,
      title: copy.title,
      description: copy.description,
      url: canonical,
      images: [imageField(image, copy.title)],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [image],
    },
    other: {
      "theme-color": colors.ember,
    },
  };
}
