/**
 * Maps database errors to "the feature isn't set up yet" so every Resources
 * page can fail soft. 42P01 is Postgres' undefined_table; PGRST205 is
 * PostgREST's "could not find the table in the schema cache" (what Supabase
 * actually returns for a table that doesn't exist).
 */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("schema cache") || (message.includes("relation") && message.includes("does not exist"));
}
