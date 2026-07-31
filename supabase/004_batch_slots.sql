-- French Punjabi — Batch seat/slot tracking
-- Run this once in the Supabase SQL Editor, after 001_schema.sql.
-- Safe to re-run (uses if not exists / or replace).
--
-- Lets admins set a total seat count per batch and track how many are
-- filled, so the Courses page can show "X spots left" instead of (or
-- alongside) the existing manual Available/Almost Full/Full status.
-- total_slots left null keeps a batch on the old manual-status-only
-- behavior (matches getPublicCourses.ts / PhasePanel.tsx fallback).

alter table public.batches
  add column if not exists total_slots int,
  add column if not exists filled_slots int not null default 0;

alter table public.batches
  drop constraint if exists batches_slots_check;

alter table public.batches
  add constraint batches_slots_check check (
    filled_slots >= 0 and (total_slots is null or (total_slots >= 0 and filled_slots <= total_slots))
  );
