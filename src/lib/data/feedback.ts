import "server-only";

import { addSimulatedFeedback, listSimulatedFeedback } from "@/lib/data/simulation";
import { hasSupabaseConfig, isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { createServiceSupabase } from "@/lib/supabase/admin";
import type { FeedbackCategory } from "@/lib/constants";

export type VisitorFeedback = {
  id: string;
  body: string;
  category: FeedbackCategory;
  email: string | null;
  createdAt: string;
};

export async function submitVisitorFeedback(input: {
  body: string;
  category: FeedbackCategory;
  email?: string | null;
}): Promise<void> {
  const email = input.email?.trim() || null;
  if (isSimulation() || !hasSupabaseConfig()) {
    addSimulatedFeedback({ body: input.body, category: input.category, email });
    return;
  }
  const db = createServiceSupabase();
  const { error } = await db.from("visitor_feedback").insert({
    body: input.body,
    category: input.category,
    contact_email: email,
  });
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "The note could not be saved.", 503);
  }
}

export async function listVisitorFeedback(limit = 50): Promise<VisitorFeedback[]> {
  if (isSimulation() || !hasSupabaseConfig()) {
    return listSimulatedFeedback(limit);
  }
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("visitor_feedback")
    .select("id, body, category, contact_email, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new AppError(ERROR_CODES.UNAVAILABLE, "Notes could not be loaded.", 503);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    category: row.category,
    email: row.contact_email,
    createdAt: row.created_at,
  }));
}
