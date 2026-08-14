import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { assertProductionEnv } = await import("@/lib/env/production");
  assertProductionEnv();
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const { reportServerError } = await import("@/lib/observability/report");
  await reportServerError(error, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    digest:
      typeof error === "object" && error && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : undefined,
  });
};
