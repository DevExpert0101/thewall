export const ADMIN_PHASE_LABEL: Record<string, string> = {
  upcoming: "Not yet open",
  live: "The day is open",
  finalizing: "Under review",
  archived: "Sealed",
};

export const ADMIN_HEALTH_LABEL: Record<string, string> = {
  database: "Working copy",
  privilegedDb: "Service role",
  payments: "Treasury",
  turnstile: "Visitor gate",
  network: "Network",
  eventStatus: "Current phase",
  moderation: "Moderation",
};
