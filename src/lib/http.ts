import { NextResponse } from "next/server";
import { AppError, ERROR_CODES, publicErrorPayload } from "@/lib/errors";
import { redactSensitiveText } from "@/lib/abuse/redact";

export function jsonError(error: unknown) {
  const payload = publicErrorPayload(error);
  return NextResponse.json(
    {
      error: redactSensitiveText(payload.error),
      code: payload.code,
      recovery: redactSensitiveText(payload.recovery),
    },
    { status: payload.status },
  );
}

export function jsonOk<T>(data: T, init?: { status?: number; cache?: string }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: init?.cache
      ? { "Cache-Control": init.cache }
      : { "Cache-Control": "no-store" },
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(ERROR_CODES.VALIDATION, "Invalid JSON body.");
  }
}
