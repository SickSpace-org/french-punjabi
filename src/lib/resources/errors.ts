/**
 * Maps database errors to "the feature isn't set up yet" so every Resources
 * page can fail soft.
 *
 * Table: 42P01 is Postgres' undefined_table; PGRST205 is PostgREST's "could not
 * find the table in the schema cache" (what Supabase actually returns for a
 * table that doesn't exist).
 *
 * Column: 42703 is Postgres' undefined_column (a select or filter naming a
 * column that doesn't exist); PGRST204 is PostgREST's "could not find the
 * column in the schema cache" (an insert or update naming one). This is what
 * the pages see until supabase/064 is applied.
 */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("does not exist") || message.includes("schema cache"));
}

export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  // "Could not find the 'x' column of 'resources' in the schema cache" also mentions the schema cache — it is NOT a missing table.
  if (isMissingColumnError(error)) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("schema cache") || (message.includes("relation") && message.includes("does not exist"));
}
