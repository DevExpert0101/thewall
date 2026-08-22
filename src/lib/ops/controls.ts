export type EventOpsControls = {
  publishEnabled: boolean;
  reactEnabled: boolean;
  strictBot: boolean;
};

export type AdminOpsAuditRow = {
  id: string;
  action: string;
  actorEmail: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
};

export const DEFAULT_EVENT_OPS: EventOpsControls = {
  publishEnabled: true,
  reactEnabled: true,
  strictBot: false,
};

export const OPS_CONFIRM_PHRASE = "OPS";
export const CLOCK_CONFIRM_PHRASE = "CLOCK";

export function defaultEventOps(): EventOpsControls {
  return { ...DEFAULT_EVENT_OPS };
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseEventOps(raw: unknown): EventOpsControls {
  const root =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const nested =
    root.ops && typeof root.ops === "object" && !Array.isArray(root.ops)
      ? (root.ops as Record<string, unknown>)
      : root;
  return {
    publishEnabled: asBoolean(nested.publishEnabled, true),
    reactEnabled: asBoolean(nested.reactEnabled, true),
    strictBot: asBoolean(nested.strictBot, false),
  };
}

export function mergeEventConfiguration(
  current: unknown,
  ops: EventOpsControls,
): Record<string, unknown> {
  const root =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  const previous =
    root.ops && typeof root.ops === "object" && !Array.isArray(root.ops)
      ? (root.ops as Record<string, unknown>)
      : {};
  root.ops = {
    ...previous,
    publishEnabled: ops.publishEnabled,
    reactEnabled: ops.reactEnabled,
    strictBot: ops.strictBot,
  };
  return root;
}

export function isPublishEnabled(ops: EventOpsControls = DEFAULT_EVENT_OPS): boolean {
  return ops.publishEnabled !== false;
}

export function isReactEnabled(ops: EventOpsControls = DEFAULT_EVENT_OPS): boolean {
  return ops.reactEnabled !== false;
}

export function isStrictBot(ops: EventOpsControls = DEFAULT_EVENT_OPS): boolean {
  return ops.strictBot === true;
}

export function opsEqual(left: EventOpsControls, right: EventOpsControls): boolean {
  return (
    left.publishEnabled === right.publishEnabled &&
    left.reactEnabled === right.reactEnabled &&
    left.strictBot === right.strictBot
  );
}
