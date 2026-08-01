/**
 * Hand-written types matching supabase/001_schema.sql. Kept minimal (no
 * generated Functions/Enums noise) — regenerate with the Supabase CLI later
 * if the schema grows enough to warrant it.
 */

export type AvailabilityStatus = "available" | "almost_full" | "full" | "hidden";
export type PaymentMode = "full" | "monthly";
export type ProgramOfferKey = "complete_program" | "redo_month";
export type EnrollmentStatus = "NEW" | "CONTACTED" | "ENROLLED" | "NOT_INTERESTED";
export type EnrollmentEmailStatus = "pending" | "sent" | "failed";
export type PreferredContactMethod = "WhatsApp" | "Phone Call" | "Email";
export type PaymentStatus = "PENDING" | "PAID";
export type StudentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type ContentStatus = "DRAFT" | "PUBLISHED";
export type AccessStatus = "ACTIVE" | "REVOKED";

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
        Omit<BatchRow, "id" | "created_at" | "updated_at" | "slug"> & {
          id?: string;
          slug?: string | null;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
