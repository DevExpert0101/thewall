import { AppError, ERROR_CODES } from "@/lib/errors";
import { PRICE_USDC, PRICE_USDC_ATOMIC } from "@/lib/constants";
import { parseUsdcAtomic, usdcAtomicEquals } from "@/lib/payment/amount-parse";

export { parseUsdcAtomic, usdcAtomicEquals };

export function requireUsdcAtomic(amount: string): bigint {
  const parsed = parseUsdcAtomic(amount);
  if (parsed === null) {
    throw new AppError(ERROR_CODES.WRONG_AMOUNT, "Invalid USDC amount.");
  }
  return parsed;
}

export function assertExactUsdcAmount(total: bigint, expectedAtomic: bigint = PRICE_USDC_ATOMIC): void {
  if (total !== expectedAtomic) {
    throw new AppError(
      ERROR_CODES.WRONG_AMOUNT,
      "Paid amount does not equal 1.00 USDC.",
    );
  }
}

export function assertCanonicalPrice(amount: string): void {
  if (!usdcAtomicEquals(amount, PRICE_USDC_ATOMIC)) {
    throw new AppError(ERROR_CODES.WRONG_AMOUNT, "Price must be 1.00 USDC.");
  }
}

export function canonicalUsdcAmount(): string {
  return PRICE_USDC;
}
