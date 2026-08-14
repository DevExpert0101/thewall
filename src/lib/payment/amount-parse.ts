import { PRICE_USDC_ATOMIC } from "@/lib/constants";

const USDC_PATTERN = /^(\d+)(?:\.(\d{1,6}))?$/;

export function parseUsdcAtomic(amount: string): bigint | null {
  const trimmed = amount.trim();
  const match = USDC_PATTERN.exec(trimmed);
  if (!match) return null;
  const whole = BigInt(match[1] ?? "0");
  const frac = (match[2] ?? "").padEnd(6, "0");
  return whole * BigInt(1_000_000) + BigInt(frac);
}

export function usdcAtomicEquals(
  amount: string,
  expectedAtomic: bigint = PRICE_USDC_ATOMIC,
): boolean {
  const parsed = parseUsdcAtomic(amount);
  return parsed !== null && parsed === expectedAtomic;
}
