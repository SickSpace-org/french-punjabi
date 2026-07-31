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
export type StudentStatus = "ACTIVE" | "INACTIVE";

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

export type StudentRow = {
  id: string;
  enrollment_id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  phase_id: string | null;
  level_id: string | null;
  batch_id: string | null;
  phase_name: string;
  level_name: string | null;
  batch_timing: string;
  enrollment_ref: string;
  status: StudentStatus;
  enrolled_at: string;
  created_at: string;
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
        > & {
          id?: string;
          status?: EnrollmentStatus;
          confirmation_email_status?: EnrollmentEmailStatus;
          payment_status?: PaymentStatus;
        },
        Partial<Omit<EnrollmentRow, "id" | "created_at" | "updated_at">>
      >;
      students: TableDef<
        StudentRow,
        Omit<StudentRow, "id" | "created_at" | "updated_at" | "enrolled_at" | "status"> & {
          id?: string;
          enrolled_at?: string;
          status?: StudentStatus;
        },
        Partial<Omit<StudentRow, "id" | "created_at" | "updated_at">>
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
