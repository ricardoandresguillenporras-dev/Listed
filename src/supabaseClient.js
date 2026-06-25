import { createClient } from '@supabase/supabase-js';

// ── SuperLista — Supabase client ──────────────────────────────────────────────
// These are the project-level keys for the dev/test instance.
// For production, move these to .env and reference via import.meta.env
const SUPABASE_URL  = 'https://tvfkmvattmlfruajwdibg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZmttdmF0dG1sZnJ1YWp3ZGliZyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgxMzk3ODI3LCJleHAiOjIwOTY5NzM4Mjd9.GL075MqrA1c1n1EfQfuT8gkYImkP7GrdFLZRTLhvE9I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },   // anonymous — no user session needed
});
