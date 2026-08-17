import { BRAND } from "@/lib/brand";
import type { MessageSort } from "@/lib/constants";
import { resolveMessageSort } from "@/lib/constants";
import { RISING_FORMULA, RISING_FORMULA_VARS } from "@/lib/ranking";

export const DISCOVERY_TABS: { id: MessageSort; label: string; hint: string; liveOnly?: boolean }[] = [
  { id: "rising", label: BRAND.sorts.rising, hint: "Alive now, mixed with new, quiet, and a shared wander set", liveOnly: true },
  { id: "hot", label: BRAND.sorts.hot, hint: "Highest lifetime 🔥" },
  { id: "new", label: BRAND.sorts.new, hint: "Latest messages" },
  { id: "random", label: BRAND.sorts.random, hint: "Open another human from the capsule" },
  { id: "gems", label: BRAND.sorts.gems, hint: "Meaningful 🔥, not the loudest" },
  { id: "final", label: BRAND.sorts.final, hint: "Published in the last hour of this Wall" },
];

export const DISCOVERY_METHODS: { id: MessageSort; title: string; body: string }[] = [
  {
    id: "rising",
    title: BRAND.sorts.rising,
    body: `The default stream interleaves four public lists — Rising, New, Hidden gems, and a wander set shared by every visitor this hour — so one ranking mood cannot fill the wall. We do not read the sentence for mood or any other trait. Rising cards still use ${RISING_FORMULA}. ${RISING_FORMULA_VARS} Abuse signals do not change this score.`,
  },
  {
    id: "hot",
    title: BRAND.sorts.hot,
    body: "Highest lifetime 🔥, then earliest published, then lowest number. The all-time board — one tab, not the default.",
  },
  {
    id: "new",
    title: BRAND.sorts.new,
    body: "Newest published_at first, then highest public number.",
  },
  {
    id: "random",
    title: BRAND.sorts.random,
    body: "Random Mode draws uniformly from public numbers 1..N that you have not opened in this session, then loads those rows by number. No full-table shuffle. SHOW ME ANOTHER HUMAN opens the next sentence. The walk is not a hidden profile.",
  },
  {
    id: "gems",
    title: BRAND.sorts.gems,
    body: "At least 3 🔥, and not in the top 20% by lifetime 🔥. Ranked by 🔥 ÷ (hours since publish + 2).",
  },
  {
    id: "final",
    title: BRAND.sorts.final,
    body: "Published in the last 60 minutes before this Wall’s ends_at. Newest first. After close, that window stays frozen.",
  },
];

export function discoveryTabs(live: boolean) {
  return DISCOVERY_TABS.filter((tab) => live || !tab.liveOnly);
}

export function discoveryMethodsFor(live: boolean) {
  const ids = new Set(discoveryTabs(live).map((tab) => tab.id));
  return DISCOVERY_METHODS.filter((method) => ids.has(method.id));
}

export function canonicalDiscoverySort(sort: string): MessageSort {
  return resolveMessageSort(sort);
}
