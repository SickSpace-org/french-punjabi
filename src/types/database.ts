/**
 * Hand-written types matching supabase/001_schema.sql. Kept minimal (no
 * generated Functions/Enums noise) — regenerate with the Supabase CLI later
 * if the schema grows enough to warrant it.
 */

export type AvailabilityStatus = "available" | "almost_full" | "full" | "hidden";
export type PaymentMode = "full" | "monthly";
export type ProgramOfferKey = "complete_program" | "redo_month" | "one_on_one_testing";
export type EnrollmentStatus = "NEW" | "CONTACTED" | "ENROLLED" | "NOT_INTERESTED";
export type EnrollmentEmailStatus = "pending" | "sent" | "failed";
export type PreferredContactMethod = "WhatsApp" | "Phone Call" | "Email";
export type PaymentStatus = "PENDING" | "PAID";
export type StudentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type ContentStatus = "DRAFT" | "PUBLISHED";
export type AccessStatus = "ACTIVE" | "REVOKED";
export type TeacherStatus = "ACTIVE" | "DEACTIVATED";

export type PhaseRow = {
  id: string;
  slug: string;
  phase_number: number;
  code: string;
  title: string;
  months_label: string;
  badge: string | null;
  description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LevelRow = {
  id: string;
  phase_id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  teacher_name: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BatchRow = {
  id: string;
  phase_id: string | null;
  level_id: string | null;
  slug: string | null;
  name: string | null;
  teacher_name: string | null;
  time_label: string;
  timezone: string;
  note: string | null;
  is_tbd: boolean;
  availability_status: AvailabilityStatus;
  total_slots: number | null;
  filled_slots: number;
  display_order: number;
  is_active: boolean;
  /** Admin-pasted class meeting link for this batch (e.g. Zoom/Meet). Null until set. */
  meeting_link: string | null;
  /** Weekdays this batch meets — 0=Sunday..6=Saturday, matching JS Date#getDay(). Empty until the admin sets a schedule. */
  class_days: number[];
  /** Exact local (America/Toronto) class start time — the ±30min auto-Present check-in window is centered on this. Null until the admin sets it. */
  class_time: string | null;
  /** The real, logged-in teacher account assigned to this batch (see supabase/029_teachers.sql) — distinct from the free-text teacher_name above, which is just a display label. Null until an admin assigns one. */
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceRow = {
  id: string;
  student_id: string;
  batch_id: string;
  /** "YYYY-MM-DD" — the scheduled class date this row marks Present for. */
  class_date: string;
  joined_at: string;
};

export type QuizMode = "free" | "read-aloud";

export type QuizAttemptRow = {
  id: string;
  student_id: string;
  mode: QuizMode;
  prompt: string;
  transcript: string;
  pronunciation_score: number;
  fluency_score: number;
  grammar_score: number;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  feedback: string;
  created_at: string;
};

export type TestSlotRow = {
  id: string;
  title: string;
  /** Exact local (America/Toronto) start time, "HH:MM:SS" — always a Friday. */
  start_time: string;
  duration_minutes: number;
  meeting_link: string | null;
  note: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type StudentTestSlotRow = {
  student_id: string;
  /** Exact local (America/Toronto) start time, "HH:MM:SS" — always a Friday. */
  start_time: string;
  meeting_link: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingRow = {
  id: string;
  phase_id: string;
  payment_mode: PaymentMode;
  base_price: number;
  tax_rate: number;
  display_total: number;
  currency: string;
  duration_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProgramOfferRow = {
  id: string;
  key: ProgramOfferKey;
  label: string;
  base_price: number;
  tax_rate: number | null;
  display_total: number | null;
  duration_label: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminUserRow = {
  id: string;
  email: string;
  created_at: string;
};

export type EnrollmentRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  current_french_level: string | null;
  phase_id: string | null;
  level_id: string | null;
  batch_id: string | null;
  program_offer_key: ProgramOfferKey | null;
  phase_name: string;
  level_name: string | null;
  batch_timing: string;
  /** The (deduplicated, by-email) student account this enrollment belongs to — set on every confirmed payment. */
  student_id: string | null;
  preferred_contact_method: PreferredContactMethod;
  message: string | null;
  status: EnrollmentStatus;
  confirmation_email_status: EnrollmentEmailStatus;

  /** Unique student-facing reference, e.g. "FP-2026-A7K4P2". */
  enrollment_ref: string;
  /** PENDING until an admin manually confirms the Interac e-Transfer arrived. */
  payment_status: PaymentStatus;
  /** Only set for phase/batch enrollments (full phase vs monthly); null for program offers. */
  payment_mode: PaymentMode | null;
  amount_due: number;
  currency: string;
  paid_at: string | null;
  confirmed_by: string | null;

  created_at: string;
  updated_at: string;
};

/**
 * The deduplicated person/account record — one row per email, spanning
 * however many courses/enrollments that person ends up with. Per-course
 * fields live on StudentCourseAccessRow instead (see below), not here.
 */
export type StudentRow = {
  id: string;
  /** References the FIRST enrollment only — later enrollments for the same person point back via EnrollmentRow.student_id instead. */
  enrollment_id: string;
  full_name: string;
  email: string;
  /** Generated column: lower(trim(email)) — the actual dedupe/identity key. */
  email_key: string;
  phone: string;
  country: string;
  /** Set once the student accepts their portal invite / logs in for the first time. */
  auth_user_id: string | null;
  enrollment_ref: string;
  status: StudentStatus;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
};

export type CourseContentRow = {
  id: string;
  phase_id: string;
  level_id: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: ContentStatus;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CourseWeekRow = {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  description: string | null;
  display_order: number;
  status: ContentStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CourseLessonRow = {
  id: string;
  week_id: string;
  /** Denormalized from week_id -> course_weeks.course_id, trigger-maintained — never set this by hand. */
  course_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  video_url: string | null;
  video_provider: string | null;
  display_order: number;
  status: ContentStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LessonResourceRow = {
  id: string;
  lesson_id: string;
  title: string;
  storage_path: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type StudentCourseAccessRow = {
  id: string;
  student_id: string;
  course_id: string;
  enrollment_id: string | null;
  status: AccessStatus;
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentLessonProgressRow = {
  student_id: string;
  lesson_id: string;
  completed_at: string;
};

export type LessonCommentRow = {
  id: string;
  lesson_id: string;
  /** Exactly one of student_id/admin_id is set. */
  student_id: string | null;
  admin_id: string | null;
  /** Null for a top-level question; replies point at a top-level comment only (one level of nesting, enforced by trigger). */
  parent_comment_id: string | null;
  body: string;
  created_at: string;
};

export type StudentNotificationRow = {
  id: string;
  student_id: string;
  lesson_id: string;
  comment_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

/** Admin-only, never joined into any student-facing query — see
 * supabase/011_student_portal_credentials.sql for why this is a separate
 * table rather than a column on students. */
export type StudentPortalCredentialRow = {
  student_id: string;
  password: string;
  updated_at: string;
};

/** See supabase/013_student_portal_access_link.sql — same "separate table,
 * not a column on students" reasoning as StudentPortalCredentialRow. */
export type StudentPortalAccessRow = {
  student_id: string;
  access_token: string;
  updated_at: string;
};

/** See supabase/028_batch_change_history.sql — a durable log of every batch/level change a confirmed student's enrollment goes through. */
export type BatchChangeHistoryRow = {
  id: string;
  student_id: string;
  enrollment_id: string;
  from_label: string;
  to_label: string;
  changed_at: string;
};

/** See supabase/029_teachers.sql. Mirrors StudentRow's shape/reasoning. */
export type TeacherRow = {
  id: string;
  full_name: string;
  email: string;
  /** Generated column: lower(trim(email)) — the actual dedupe/identity key. */
  email_key: string;
  /** Set once the teacher accepts their portal invite / logs in for the first time. */
  auth_user_id: string | null;
  status: TeacherStatus;
  created_at: string;
  updated_at: string;
};

/** Admin-only, never joined into any teacher-facing query — same reasoning as StudentPortalCredentialRow. */
export type TeacherPortalCredentialRow = {
  teacher_id: string;
  password: string;
  updated_at: string;
};

/** Admin-only, never joined into any teacher-facing query — same reasoning as StudentPortalAccessRow. */
export type TeacherPortalAccessRow = {
  teacher_id: string;
  access_token: string;
  updated_at: string;
};

/** Admin's own bookkeeping about a teacher — deliberately unreachable by that teacher's own session (no self-select RLS policy at all, see supabase/029_teachers.sql). */
export type TeacherPaymentRow = {
  id: string;
  /** Null once the teacher behind this row is hard-deleted — see teacher_name_snapshot for a name that survives that. */
  teacher_id: string | null;
  /** Frozen at write time so this row stays readable by name even after the teacher is gone. */
  teacher_name_snapshot: string;
  amount: number;
  currency: string;
  /** "YYYY-MM-DD" */
  paid_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Same admin-only visibility as TeacherPaymentRow. */
export type TeacherHoursRow = {
  id: string;
  /** Null once the teacher behind this row is hard-deleted — see teacher_name_snapshot for a name that survives that. */
  teacher_id: string | null;
  /** Frozen at write time so this row stays readable by name even after the teacher is gone. */
  teacher_name_snapshot: string;
  /** "YYYY-MM-DD" — the week this row's hours are for. */
  week_start: string;
  hours: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** See supabase/034_teacher_recordings.sql. A teacher's session never writes this table directly — only through teacher_add_recording()/teacher_update_recording()/teacher_delete_recording(). */
export type ClassRecordingRow = {
  id: string;
  batch_id: string;
  /** Null once the teacher behind this row is hard-deleted — see teacher_name_snapshot for a name that survives that. */
  teacher_id: string | null;
  /** Frozen at write time so this row stays readable by name even after the teacher is gone. */
  teacher_name_snapshot: string;
  /** "YYYY-MM-DD" — which session this recording is for, if given. */
  class_date: string | null;
  url: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

/** See supabase/035_batch_materials.sql. A teacher's session never writes this table directly — only through teacher_add_material()/teacher_update_material()/teacher_delete_material(). The underlying file lives in the private batch-materials Storage bucket at storage_path. */
export type BatchMaterialRow = {
  id: string;
  batch_id: string;
  /** Null once the teacher behind this row is hard-deleted — see teacher_name_snapshot for a name that survives that. */
  teacher_id: string | null;
  /** Frozen at write time so this row stays readable by name even after the teacher is gone. */
  teacher_name_snapshot: string;
  title: string;
  /** Path within the batch-materials bucket, "{batch_id}/{filename}". */
  storage_path: string;
  created_at: string;
  updated_at: string;
};

/** See supabase/036_teacher_messages.sql. A teacher's session never writes this table directly — only through teacher_send_message(). An admin's session never writes it directly either — only through admin_send_message() (supabase/038_admin_messages.sql). One row per RECIPIENT; a whole-batch send shares one broadcast_id across every row it created. */
export type TeacherMessageRow = {
  id: string;
  broadcast_id: string;
  batch_id: string;
  /** Null once the teacher behind this row is hard-deleted (see teacher_name_snapshot for a name that survives that) — OR when is_admin_message is true, which also always carries teacher_id null. Check is_admin_message to tell the two cases apart; never infer sender kind from teacher_id alone. */
  teacher_id: string | null;
  /** Frozen at send time so this row stays readable by name even after the teacher is gone. Always the literal string "Admin" when is_admin_message is true. */
  teacher_name_snapshot: string;
  student_id: string;
  body: string;
  is_read: boolean;
  /** See supabase/038_admin_messages.sql. True = sent by admin via admin_send_message(), never audited (see that migration's header comment for why). False = an ordinary teacher message. */
  is_admin_message: boolean;
  created_at: string;
};

/** See supabase/037_student_feedback_notes.sql. A root note (parent_note_id null) is teacher-authored, written only through teacher_add_feedback_note()/teacher_update_feedback_note()/teacher_delete_feedback_note(). A reply (parent_note_id set) is student-authored, inserted directly (RLS-gated) — its batch_id/teacher_id/teacher_name_snapshot/student_id are derived from the parent by a DB trigger, never trusted from the client. */
export type StudentFeedbackNoteRow = {
  id: string;
  batch_id: string;
  /** Null once the teacher behind this row is hard-deleted — see teacher_name_snapshot for a name that survives that. */
  teacher_id: string | null;
  /** Frozen at write time (or copied from the parent, for a reply) so this row stays readable by name even after the teacher is gone. */
  teacher_name_snapshot: string;
  student_id: string;
  /** Null = a top-level note (teacher-authored). Set = a reply (student-authored) to that note. */
  parent_note_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type TicketStatus = "OPEN" | "RESOLVED";
export type TicketSenderType = "student" | "admin";

/** See supabase/039_student_support_tickets.sql. A student's session never inserts this directly — only through student_open_ticket(). Admin may create/update directly (full access via is_admin()). */
export type StudentSupportTicketRow = {
  id: string;
  student_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  /** Bumped on every new message via touch_ticket_on_new_message() — sort admin's ticket list by this, not created_at, so an old ticket with a fresh reply surfaces to the top. */
  updated_at: string;
};

/** Flat per-ticket message list — no nesting at all (contrast with StudentFeedbackNoteRow's parent_note_id), since a real support conversation needs genuine back-and-forth from both sides. */
export type SupportTicketMessageRow = {
  id: string;
  ticket_id: string;
  sender_type: TicketSenderType;
  body: string;
  /** "Has the OTHER party seen this" — for a student-authored row, has admin read it; for an admin-authored row, has the student read it. */
  is_read: boolean;
  created_at: string;
};

export type TeacherContentType = "recording" | "material" | "message" | "feedback_note";
export type TeacherContentAction = "created" | "updated" | "deleted";

/** Permanent history log, admin-only (see supabase/034_teacher_recordings.sql) — mirrors BatchChangeHistoryRow's role but for teacher-uploaded content. */
export type TeacherContentAuditRow = {
  id: string;
  content_type: TeacherContentType;
  /** Not a foreign key — the live class_recordings/batch_materials/teacher_messages/student_feedback_notes row(s) this refers to may since be gone; for 'message' this is the broadcast_id, not a single message row's id. */
  content_id: string;
  batch_id: string;
  teacher_id: string | null;
  teacher_name_snapshot: string;
  action: TeacherContentAction;
  /** Snapshot of the relevant fields at the time of this event. url/class_date are 'recording'-only; storage_path is 'material'-only; title on a 'message' row holds a short recipient summary, and on a 'feedback_note' row holds "For {student name}", not a title. */
  title: string | null;
  url: string | null;
  storage_path: string | null;
  class_date: string | null;
  /** 'message'/'feedback_note'-only: the full text that was sent/written. A student's reply to a feedback note is never audited (see supabase/037_student_feedback_notes.sql) — only the teacher's own note is. */
  body: string | null;
  created_at: string;
};

/** See supabase/030_batch_waitlist.sql — students waiting for a seat in a full batch. */
export type BatchWaitlistRow = {
  id: string;
  batch_id: string;
  full_name: string;
  email: string;
  phone: string;
  message: string | null;
  notified_at: string | null;
  created_at: string;
};

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      phases: TableDef<
        PhaseRow,
        Omit<PhaseRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<Omit<PhaseRow, "id" | "created_at" | "updated_at">>
      >;
      levels: TableDef<
        LevelRow,
        Omit<LevelRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<Omit<LevelRow, "id" | "created_at" | "updated_at">>
      >;
      batches: TableDef<
        BatchRow,
        Omit<
          BatchRow,
          "id" | "created_at" | "updated_at" | "slug" | "meeting_link" | "class_days" | "class_time" | "teacher_id"
        > & {
          id?: string;
          slug?: string | null;
          meeting_link?: string | null;
          class_days?: number[];
          class_time?: string | null;
          teacher_id?: string | null;
        },
        Partial<Omit<BatchRow, "id" | "created_at" | "updated_at">>
      >;
      pricing: TableDef<
        PricingRow,
        Omit<PricingRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<Omit<PricingRow, "id" | "created_at" | "updated_at">>
      >;
      program_offers: TableDef<
        ProgramOfferRow,
        Omit<ProgramOfferRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<Omit<ProgramOfferRow, "id" | "created_at" | "updated_at">>
      >;
      admin_users: TableDef<
        AdminUserRow,
        Omit<AdminUserRow, "created_at">,
        Partial<Omit<AdminUserRow, "id" | "created_at">>
      >;
      enrollments: TableDef<
        EnrollmentRow,
        Omit<
          EnrollmentRow,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "confirmation_email_status"
          | "payment_status"
          | "paid_at"
          | "confirmed_by"
          | "student_id"
        > & {
          id?: string;
          status?: EnrollmentStatus;
          confirmation_email_status?: EnrollmentEmailStatus;
          payment_status?: PaymentStatus;
          student_id?: string | null;
        },
        Partial<Omit<EnrollmentRow, "id" | "created_at" | "updated_at">>
      >;
      students: TableDef<
        StudentRow,
        Omit<
          StudentRow,
          "id" | "created_at" | "updated_at" | "enrolled_at" | "status" | "email_key" | "auth_user_id"
        > & {
          id?: string;
          enrolled_at?: string;
          status?: StudentStatus;
          auth_user_id?: string | null;
        },
        Partial<Omit<StudentRow, "id" | "created_at" | "updated_at" | "email_key">>
      >;
      course_content: TableDef<
        CourseContentRow,
        Omit<CourseContentRow, "id" | "created_at" | "updated_at" | "status" | "is_active"> & {
          id?: string;
          status?: ContentStatus;
          is_active?: boolean;
        },
        Partial<Omit<CourseContentRow, "id" | "created_at" | "updated_at">>
      >;
      course_weeks: TableDef<
        CourseWeekRow,
        Omit<CourseWeekRow, "id" | "created_at" | "updated_at" | "status" | "is_active"> & {
          id?: string;
          status?: ContentStatus;
          is_active?: boolean;
        },
        Partial<Omit<CourseWeekRow, "id" | "created_at" | "updated_at">>
      >;
      course_lessons: TableDef<
        CourseLessonRow,
        Omit<
          CourseLessonRow,
          "id" | "created_at" | "updated_at" | "status" | "is_active" | "course_id"
        > & {
          id?: string;
          status?: ContentStatus;
          is_active?: boolean;
          /** Ignored by the DB (trigger-derived from week_id) — included so callers don't need to strip it. */
          course_id?: string;
        },
        Partial<Omit<CourseLessonRow, "id" | "created_at" | "updated_at" | "course_id">>
      >;
      lesson_resources: TableDef<
        LessonResourceRow,
        Omit<LessonResourceRow, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<Omit<LessonResourceRow, "id" | "created_at" | "updated_at">>
      >;
      student_course_access: TableDef<
        StudentCourseAccessRow,
        Omit<
          StudentCourseAccessRow,
          "id" | "created_at" | "updated_at" | "status" | "granted_at" | "revoked_at"
        > & {
          id?: string;
          status?: AccessStatus;
          granted_at?: string;
          revoked_at?: string | null;
        },
        Partial<Omit<StudentCourseAccessRow, "id" | "created_at" | "updated_at">>
      >;
      student_lesson_progress: TableDef<
        StudentLessonProgressRow,
        Omit<StudentLessonProgressRow, "completed_at"> & { completed_at?: string },
        Partial<StudentLessonProgressRow>
      >;
      lesson_comments: TableDef<
        LessonCommentRow,
        Omit<LessonCommentRow, "id" | "created_at"> & { id?: string },
        Partial<Omit<LessonCommentRow, "id" | "created_at">>
      >;
      student_notifications: TableDef<
        StudentNotificationRow,
        Omit<StudentNotificationRow, "id" | "created_at" | "is_read"> & {
          id?: string;
          is_read?: boolean;
        },
        Partial<Omit<StudentNotificationRow, "id" | "created_at">>
      >;
      student_portal_credentials: TableDef<
        StudentPortalCredentialRow,
        Omit<StudentPortalCredentialRow, "updated_at"> & { updated_at?: string },
        Partial<Omit<StudentPortalCredentialRow, "student_id">>
      >;
      student_portal_access: TableDef<
        StudentPortalAccessRow,
        Omit<StudentPortalAccessRow, "updated_at"> & { updated_at?: string },
        Partial<Omit<StudentPortalAccessRow, "student_id">>
      >;
      attendance: TableDef<
        AttendanceRow,
        Omit<AttendanceRow, "id" | "joined_at"> & { id?: string; joined_at?: string },
        Partial<Omit<AttendanceRow, "id">>
      >;
      batch_waitlist: TableDef<
        BatchWaitlistRow,
        Omit<BatchWaitlistRow, "id" | "created_at" | "notified_at"> & { id?: string },
        Partial<Pick<BatchWaitlistRow, "notified_at">>
      >;
      batch_change_history: TableDef<
        BatchChangeHistoryRow,
        Omit<BatchChangeHistoryRow, "id" | "changed_at"> & { id?: string; changed_at?: string },
        Partial<Omit<BatchChangeHistoryRow, "id">>
      >;
      quiz_attempts: TableDef<
        QuizAttemptRow,
        Omit<QuizAttemptRow, "id" | "created_at" | "strengths" | "improvements" | "mode"> & {
          id?: string;
          created_at?: string;
          strengths?: string[];
          improvements?: string[];
          mode?: QuizMode;
        },
        Partial<Omit<QuizAttemptRow, "id" | "student_id" | "created_at">>
      >;
      test_slots: TableDef<
        TestSlotRow,
        Omit<TestSlotRow, "id" | "created_at" | "updated_at" | "title" | "duration_minutes" | "is_active" | "display_order"> & {
          id?: string;
          title?: string;
          duration_minutes?: number;
          is_active?: boolean;
          display_order?: number;
        },
        Partial<Omit<TestSlotRow, "id" | "created_at" | "updated_at">>
      >;
      student_test_slots: TableDef<
        StudentTestSlotRow,
        Omit<StudentTestSlotRow, "created_at" | "updated_at">,
        Partial<Omit<StudentTestSlotRow, "student_id" | "created_at" | "updated_at">>
      >;
      teachers: TableDef<
        TeacherRow,
        Omit<TeacherRow, "id" | "created_at" | "updated_at" | "status" | "auth_user_id" | "email_key"> & {
          id?: string;
          status?: TeacherStatus;
          auth_user_id?: string | null;
        },
        Partial<Omit<TeacherRow, "id" | "created_at" | "updated_at" | "email_key">>
      >;
      teacher_portal_credentials: TableDef<
        TeacherPortalCredentialRow,
        Omit<TeacherPortalCredentialRow, "updated_at"> & { updated_at?: string },
        Partial<Omit<TeacherPortalCredentialRow, "teacher_id">>
      >;
      teacher_portal_access: TableDef<
        TeacherPortalAccessRow,
        Omit<TeacherPortalAccessRow, "updated_at"> & { updated_at?: string },
        Partial<Omit<TeacherPortalAccessRow, "teacher_id">>
      >;
      teacher_payments: TableDef<
        TeacherPaymentRow,
        Omit<
          TeacherPaymentRow,
          "id" | "created_at" | "updated_at" | "currency" | "paid_at" | "teacher_id" | "created_by"
        > & {
          id?: string;
          currency?: string;
          paid_at?: string;
          teacher_id?: string | null;
          created_by?: string | null;
        },
        Partial<Omit<TeacherPaymentRow, "id" | "created_at" | "updated_at">>
      >;
      teacher_hours: TableDef<
        TeacherHoursRow,
        Omit<TeacherHoursRow, "id" | "created_at" | "updated_at" | "teacher_id"> & {
          id?: string;
          teacher_id?: string | null;
        },
        Partial<Omit<TeacherHoursRow, "id" | "created_at" | "updated_at">>
      >;
      class_recordings: TableDef<
        ClassRecordingRow,
        Omit<ClassRecordingRow, "id" | "created_at" | "updated_at" | "teacher_id" | "class_date" | "title"> & {
          id?: string;
          teacher_id?: string | null;
          class_date?: string | null;
          title?: string | null;
        },
        Partial<Omit<ClassRecordingRow, "id" | "created_at" | "updated_at">>
      >;
      batch_materials: TableDef<
        BatchMaterialRow,
        Omit<BatchMaterialRow, "id" | "created_at" | "updated_at" | "teacher_id"> & {
          id?: string;
          teacher_id?: string | null;
        },
        Partial<Omit<BatchMaterialRow, "id" | "created_at" | "updated_at">>
      >;
      teacher_content_audit: TableDef<
        TeacherContentAuditRow,
        Omit<TeacherContentAuditRow, "id" | "created_at" | "teacher_id" | "title" | "url" | "storage_path" | "class_date" | "body"> & {
          id?: string;
          teacher_id?: string | null;
          title?: string | null;
          url?: string | null;
          storage_path?: string | null;
          class_date?: string | null;
          body?: string | null;
        },
        Partial<Omit<TeacherContentAuditRow, "id" | "created_at">>
      >;
      teacher_messages: TableDef<
        TeacherMessageRow,
        Omit<TeacherMessageRow, "id" | "created_at" | "broadcast_id" | "teacher_id" | "is_read" | "is_admin_message"> & {
          id?: string;
          broadcast_id?: string;
          teacher_id?: string | null;
          is_read?: boolean;
          is_admin_message?: boolean;
        },
        Partial<Omit<TeacherMessageRow, "id" | "created_at">>
      >;
      student_feedback_notes: TableDef<
        StudentFeedbackNoteRow,
        // A root note is only ever inserted inside teacher_add_feedback_note()
        // (plain SQL, not through this client type). The only direct
        // client-side insert this app ever performs is a student's reply —
        // enforce_feedback_note_reply() (supabase/037_student_feedback_notes.sql)
        // derives batch_id/teacher_id/teacher_name_snapshot/student_id from
        // the parent row before any constraint is checked, so only body +
        // parent_note_id need to be supplied.
        Omit<StudentFeedbackNoteRow, "id" | "created_at" | "updated_at" | "teacher_id" | "parent_note_id" | "batch_id" | "teacher_name_snapshot" | "student_id"> & {
          id?: string;
          teacher_id?: string | null;
          parent_note_id?: string | null;
          batch_id?: string;
          teacher_name_snapshot?: string;
          student_id?: string;
        },
        Partial<Omit<StudentFeedbackNoteRow, "id" | "created_at">>
      >;
      student_support_tickets: TableDef<
        StudentSupportTicketRow,
        // Never inserted via this client type at all — a ticket is only
        // ever created inside student_open_ticket() (plain SQL). Admin's
        // own writes (e.g. setting status) go through this type for
        // Update, but Insert has no real caller.
        Omit<StudentSupportTicketRow, "id" | "created_at" | "updated_at" | "status"> & {
          id?: string;
          status?: TicketStatus;
        },
        Partial<Omit<StudentSupportTicketRow, "id" | "created_at">>
      >;
      support_ticket_messages: TableDef<
        SupportTicketMessageRow,
        // A student's direct insert (a reply) only ever needs to supply
        // ticket_id + body — sender_type is required too (always the
        // literal 'student', enforced by RLS's with check, not derived by
        // a trigger the way feedback-note replies are). Admin's own reply
        // additionally supplies sender_type: 'admin' explicitly.
        Omit<SupportTicketMessageRow, "id" | "created_at" | "is_read"> & {
          id?: string;
          is_read?: boolean;
        },
        Partial<Omit<SupportTicketMessageRow, "id" | "created_at">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      enrollment_recent_duplicate: {
        Args: { p_email: string; p_batch_id: string | null; p_program_offer_key: string | null };
        Returns: {
          id: string;
          enrollment_ref: string;
          amount_due: number;
          currency: string;
          full_name: string;
        } | null;
      };
      mark_enrollment_email_status: {
        Args: { p_id: string; p_status: "sent" | "failed" };
        Returns: undefined;
      };
      confirm_enrollment_payment: {
        Args: { p_enrollment_id: string };
        Returns: {
          just_confirmed: boolean;
          student_id: string | null;
          enrollment: EnrollmentRow;
        };
      };
      is_active_student: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_course_access: {
        Args: { p_course_id: string };
        Returns: boolean;
      };
      resolve_portal_access_token: {
        Args: { p_token: string };
        Returns: { student_id: string; email: string; status: StudentStatus }[];
      };
      mark_class_attendance: {
        Args: { p_batch_id: string };
        Returns: { ok: boolean; already_marked?: boolean; reason?: string };
      };
      is_active_teacher: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_teacher_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      resolve_teacher_portal_access_token: {
        Args: { p_token: string };
        Returns: { teacher_id: string; email: string; status: TeacherStatus }[];
      };
      student_current_batch_id: {
        Args: { p_student_id: string };
        Returns: string | null;
      };
      teacher_batch_roster: {
        Args: { p_batch_id: string };
        Returns: {
          student_id: string;
          full_name: string;
          email: string;
          phone: string;
          country: string;
          phase_name: string | null;
          level_name: string | null;
          batch_timing: string | null;
        }[];
      };
      student_owns_current_batch: {
        Args: { p_batch_id: string };
        Returns: boolean;
      };
      teacher_update_meeting_link: {
        Args: { p_batch_id: string; p_meeting_link: string | null };
        Returns: undefined;
      };
      teacher_add_recording: {
        Args: { p_batch_id: string; p_url: string; p_title: string | null; p_class_date: string | null };
        Returns: string;
      };
      teacher_update_recording: {
        Args: { p_recording_id: string; p_url: string; p_title: string | null; p_class_date: string | null };
        Returns: undefined;
      };
      teacher_delete_recording: {
        Args: { p_recording_id: string };
        Returns: undefined;
      };
      teacher_add_material: {
        Args: { p_batch_id: string; p_storage_path: string; p_title: string };
        Returns: string;
      };
      teacher_update_material: {
        Args: { p_material_id: string; p_title: string };
        Returns: undefined;
      };
      teacher_delete_material: {
        Args: { p_material_id: string };
        Returns: undefined;
      };
      is_own_student_id: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      teacher_send_message: {
        Args: { p_batch_id: string; p_student_id: string | null; p_body: string };
        Returns: string;
      };
      admin_send_message: {
        Args: { p_batch_id: string; p_student_id: string | null; p_body: string };
        Returns: string;
      };
      teacher_add_feedback_note: {
        Args: { p_batch_id: string; p_student_id: string; p_body: string };
        Returns: string;
      };
      teacher_update_feedback_note: {
        Args: { p_note_id: string; p_body: string };
        Returns: undefined;
      };
      teacher_delete_feedback_note: {
        Args: { p_note_id: string };
        Returns: undefined;
      };
      student_open_ticket: {
        Args: { p_subject: string; p_body: string };
        Returns: string;
      };
      is_own_ticket: {
        Args: { p_ticket_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
