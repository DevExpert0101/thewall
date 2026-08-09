#!/usr/bin/env node
// Dev helper: force the current Wall to freeze so you can test the artifact,
// certificate, and frozen UI. Run: npm run endwall
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error } = await supabase
  .from("walls")
  .update({ frozen: true, ends_at: new Date().toISOString() })
  .eq("frozen", false);

if (error) {
  console.error("Failed to freeze the wall:", error.message);
  process.exit(1);
}
console.log("The Wall has frozen.");
