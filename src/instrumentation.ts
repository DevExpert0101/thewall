import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const {
    evaluateProductionEnv,
    isVercelProduction,
    productionEnvFromProcess,
  } = await import("@/lib/env/production");
  if (!isVercelProduction()) return;
  const problems = evaluateProductionEnv(productionEnvFromProcess());
  if (problems.length === 0) return;
  console.error(
    JSON.stringify({
      level: "error",
      source: "the-wall",
      code: "CONFIG",
      problems,
    }),
  );
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
