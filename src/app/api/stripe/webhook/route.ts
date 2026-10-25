import "server-only";
import { NextResponse, after, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteStudentAndLink } from "@/lib/students/inviteAndLink";
import { REFERRER_DISCOUNT_COUPON_ID } from "@/lib/payments/referralCoupons";
import { getSiteUrl } from "@/lib/siteUrl";
import type { PaymentNotificationKind } from "@/types/database";
import {
  sendSubscriptionWelcomeEmail,
  sendSubscriptionLostRaceEmail,
  sendSubscriptionTrialStartedEmail,
  sendSubscriptionPaymentSucceededEmail,
  sendSubscriptionCanceledEmail,
  sendPhaseCompletedEmail,
  sendSubscriptionDuplicateTrialCardEmail,
  sendAdminPaymentAlert,
  sendAdminNotification,
  sendFullPaymentWelcomeEmail,
  sendSubscriptionPaymentFailedEmail,
  sendSubscriptionTrialEndingEmail,
  sendSubscriptionRenewalUpcomingEmail,
  sendReferralRewardEarnedEmail,
} from "@/lib/email/send";

/** Shared by every "new Stripe signup" success path (subscription+trial
 * AND the new one-time "full" path) — resolves the student's permanent
 * portal-access link (the same one inviteStudentAndLink's own email uses,
 * see supabase/013_student_portal_access_link.sql) so the richer welcome
 * email below can include it too, and the batch's class link. Awaited
 * (not after()) specifically because the welcome email needs its result —
 * inviteStudentAndLink itself still only does real work once per email
 * (a second course for an already-onboarded student is a no-op), so this
 * added wait is small. */
async function resolvePortalAndClassLink(
  supabase: ReturnType<typeof createAdminClient>,
  studentId: string,
  email: string,
  fullName: string,
  batchId: string | null
) {
  await inviteStudentAndLink(studentId, email, fullName, supabase).catch(() => undefined);

  const { data: access } = await supabase.from("student_portal_access").select("access_token").eq("student_id", studentId).maybeSingle();
  const portalLink = access?.access_token ? `${getSiteUrl()}/student/access/${access.access_token}` : undefined;

  let classLink: string | null = null;
  if (batchId) {
    const { data: batch } = await supabase.from("batches").select("meeting_link").eq("id", batchId).maybeSingle();
    classLink = batch?.meeting_link ?? null;
  }

  return { portalLink, classLink };
}

/** A8 — every in-portal notification row this webhook ever writes goes
 * through here (see supabase/048_payment_notifications.sql). Best-effort
 * on purpose, same as every email send in this file: a failed insert here
 * must never re-throw and undo the actual state change it followed. */
async function insertPaymentNotification(
  supabase: ReturnType<typeof createAdminClient>,
  studentId: string,
  kind: PaymentNotificationKind,
  message: string
) {
  const { error } = await supabase.from("payment_notifications").insert({ student_id: studentId, kind, message });
  if (error) console.error("[StripeWebhook] Failed to insert payment_notifications row:", error);
}

/**
 * Stage 2 adds: the 7-day-trial activation path (checkout.session.completed
 * now may be trialing, not an immediate charge), invoice.payment_succeeded
 * (day-8 first charge AND every later renewal — Stripe fires the identical
 * event for both), customer.subscription.deleted (explicit cancellation,
 * including during the trial before any charge happens), and
 * customer.subscription.trial_will_end. invoice.upcoming (A8) is the
 * established-subscriber counterpart to trial_will_end — an established
 * (non-trial) subscriber's heads-up before their next renewal charge.
 *
 * Reads the RAW body (never JSON-parsed) because signature verification
 * needs the exact bytes Stripe signed. Idempotency: the first write on
 * every request is an insert into stripe_webhook_events keyed by the
 * Stripe event id — a unique-violation there means "already processed"
 * and the handler returns 200 without touching anything else.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "missing signature or webhook secret" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[StripeWebhook] Signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: dedupeError } = await supabase
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type });

  if (dedupeError) {
    // Unique-violation on a repeat delivery of the same event — already
    // processed. Returning 200 (not re-processing) is what stops Stripe's
    // own retry schedule for this event.
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Checkpoint 3 — an existing-student checkout (pay-this-month or
      // set-up-autopay) carries existing_student_id, which a new-signup
      // session never has. Routed to a completely separate handler rather
      // than branching inside handleCheckoutCompleted — that function's
      // whole shape (hold_id, seat reservation, new-student insert) is
      // specific to brand-new signups and doesn't apply here at all.
      if (session.metadata?.existing_student_id) {
        await handleExistingStudentCheckoutCompleted(supabase, stripe, session);
      } else if (session.mode === "payment") {
        // Public Enroll cutover's one-time "Full" path — a brand-new
        // student, but no subscription at all, so handleCheckoutCompleted
        // (which requires session.subscription) doesn't apply.
        await handleFullPaymentEnrollCheckoutCompleted(supabase, stripe, session);
      } else {
        await handleCheckoutCompleted(supabase, stripe, session);
      }
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const holdId = session.metadata?.hold_id;
      if (holdId) {
        await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
      }
      break;
    }
    case "invoice.payment_succeeded": {
      await handleInvoicePaymentSucceeded(supabase, event.data.object as Stripe.Invoice);
      break;
    }
    case "invoice.payment_failed": {
      await handleInvoicePaymentFailed(supabase, event.data.object as Stripe.Invoice);
      break;
    }
    case "customer.subscription.deleted": {
      await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.trial_will_end": {
      await handleTrialWillEnd(supabase, event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.upcoming": {
      await handleInvoiceUpcoming(supabase, event.data.object as Stripe.Invoice);
      break;
    }
    case "charge.refunded": {
      await handlePaymentAlert(supabase, event.data.object as Stripe.Charge, "charge_refunded");
      break;
    }
    case "charge.dispute.created": {
      await handlePaymentAlert(supabase, event.data.object as Stripe.Dispute, "charge_disputed");
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

/** Reads the card fingerprint attached to this checkout, checking the
 * subscription's own default_payment_method first, then falling back to
 * the customer's invoice_settings default — hosted Checkout's own
 * documented behavior is to set the latter, not necessarily the former. */
async function getCardFingerprint(
  stripe: ReturnType<typeof getStripeClient>,
  subscription: Stripe.Subscription,
  customerId: string
): Promise<string | null> {
  let pm = subscription.default_payment_method;

  if (!pm) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!("deleted" in customer)) {
      pm = customer.invoice_settings?.default_payment_method ?? null;
    }
  }

  if (!pm) return null;

  const paymentMethod = typeof pm === "string" ? await stripe.paymentMethods.retrieve(pm) : pm;
  return paymentMethod.card?.fingerprint ?? null;
}

/** Phase re-enrollment (src/lib/payments/phaseReenrollmentCheckout.ts) passes
 * the student's PRIOR subscription id through as metadata.old_subscription_id
 * when one exists, so the phase they just finished stops being billed the
 * moment their new one activates — never cancelled before the new payment
 * is confirmed, and never touched at all for a brand-new signup (no prior
 * subscription means no metadata key). A student paying "Full" for a new
 * phase while still on an old monthly subscription from a prior phase hits
 * this too (handleFullPaymentEnrollCheckoutCompleted also calls this).
 *
 * Clears students.stripe_subscription_id BEFORE cancelling on Stripe, not
 * after — cancelling fires a real customer.subscription.deleted webhook a
 * moment later, and handle_subscription_canceled (048_payment_notifications
 * .sql) matches a student purely by that column. For the monthly re-enroll
 * path activation has already overwritten it to the NEW subscription id by
 * the time this runs, so the clear below is a harmless no-op there. For the
 * full-payment path, activate_full_payment_enrollment deliberately never
 * touches that column (it has no subscription of its own) — without this
 * clear, the stale deleted-webhook would still match this student by the
 * OLD id and flip their whole account to INACTIVE right after they paid. */
/** Phase re-enrollment passes the student's CURRENT batch id through as
 * metadata.old_batch_id when one exists — they're moving to a new phase
 * and no longer occupying that seat, so it's released the moment the new
 * enrollment activates. A brand-new signup's session never carries this
 * metadata key. */
async function releaseOldBatchSeatIfAny(supabase: ReturnType<typeof createAdminClient>, session: Stripe.Checkout.Session) {
  const oldBatchId = session.metadata?.old_batch_id;
  if (!oldBatchId) return;

  const { data: batch } = await supabase.from("batches").select("filled_slots").eq("id", oldBatchId).maybeSingle();
  if (!batch) return;

  await supabase
    .from("batches")
    .update({ filled_slots: Math.max(batch.filled_slots - 1, 0) })
    .eq("id", oldBatchId);
}

async function cancelOldSubscriptionIfAny(
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripeClient>,
  session: Stripe.Checkout.Session,
  studentId: string,
  newSubscriptionId: string | null
) {
  const oldSubscriptionId = session.metadata?.old_subscription_id;
  if (!oldSubscriptionId || oldSubscriptionId === newSubscriptionId) return;

  await supabase
    .from("students")
    .update({ stripe_subscription_id: null, subscription_status: null, subscription_cap_at: null })
    .eq("id", studentId)
    .eq("stripe_subscription_id", oldSubscriptionId);

  await stripe.subscriptions.cancel(oldSubscriptionId).catch((err) => {
    console.error("[StripeWebhook] Failed to cancel prior-phase subscription on re-enrollment:", oldSubscriptionId, err);
  });
}

/** Cancels a subscription and refunds its latest invoice in full if it was
 * already paid — shared by both failure-to-activate paths (lost seat race,
 * duplicate trial card). Never leaves someone billed for a seat/trial that
 * was never actually theirs. */
async function cancelAndRefundIfPaid(stripe: ReturnType<typeof getStripeClient>, subscriptionId: string) {
  const subscription = await stripe.subscriptions.cancel(subscriptionId);

  const latestInvoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  if (!latestInvoiceId) return;

  const invoice = await stripe.invoices.retrieve(latestInvoiceId, {
    expand: ["payments.data.payment.payment_intent"],
  });
  const rawPaymentIntent = invoice.payments?.data?.[0]?.payment?.payment_intent;
  const paymentIntentId = typeof rawPaymentIntent === "string" ? rawPaymentIntent : rawPaymentIntent?.id;
  if (invoice.status === "paid" && paymentIntentId) {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
  }
}

/**
 * Checkpoint 3, Phase 4 — an existing (non-Stripe) student's "Pay this
 * month" or "Set up autopay" checkout succeeding. Never touches seats or
 * trial-dedupe (existing students already hold their seat from their
 * original enrollment, and never get a trial — see the Phase 3 build
 * notes) and never creates a new student row.
 */
async function handleExistingStudentCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripeClient>,
  session: Stripe.Checkout.Session
) {
  const studentId = session.metadata?.existing_student_id;
  const paymentPath = session.metadata?.payment_path;
  if (!studentId) return;

  if (paymentPath === "one_time") {
    if (session.payment_status !== "paid") {
      console.error("[StripeWebhook] existing-student one-time checkout completed but not paid", { sessionId: session.id, studentId });
      return;
    }
    const amount = (session.amount_total ?? 0) / 100;
    const currency = (session.currency ?? "cad").toUpperCase();
    const { data: result, error } = await supabase.rpc("record_existing_student_stripe_payment", {
      p_student_id: studentId,
      p_amount: amount,
      p_currency: currency,
      p_stripe_checkout_session_id: session.id,
    });
    if (error || !result?.ok) {
      console.error("[StripeWebhook] record_existing_student_stripe_payment failed:", error ?? result);
    }
    return;
  }

  if (paymentPath === "autopay") {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!subscriptionId || !customerId) {
      console.error("[StripeWebhook] existing-student autopay checkout missing subscription/customer", { sessionId: session.id, studentId });
      return;
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const { data: result, error } = await supabase.rpc("attach_stripe_to_existing_student", {
      p_student_id: studentId,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId,
      p_subscription_status: subscription.status,
    });
    if (error || !result?.ok) {
      console.error("[StripeWebhook] attach_stripe_to_existing_student failed:", error ?? result);
    }
    return;
  }

  console.error("[StripeWebhook] existing-student checkout with unrecognized payment_path", { sessionId: session.id, studentId, paymentPath });
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripeClient>,
  session: Stripe.Checkout.Session
) {
  const enrollmentId = session.metadata?.enrollment_id;
  const holdId = session.metadata?.hold_id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (!enrollmentId || !holdId || !customerId || !subscriptionId) {
    console.error("[StripeWebhook] checkout.session.completed missing required metadata/ids", {
      sessionId: session.id,
    });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  const price = item?.price;
  const lockedPrice = price?.unit_amount != null ? price.unit_amount / 100 : 0;
  const lockedCurrency = (price?.currency ?? "cad").toUpperCase();
  // current_period_end lives on the subscription ITEM (not the Subscription
  // object itself) as of stripe-node 23 / this account's API version —
  // confirmed directly against node_modules/stripe's own type declarations.
  // During a trial this IS the trial end date, which is exactly what
  // next_payment_due_at/course_expiry_at should show.
  const periodEndSeconds = item?.current_period_end;
  const nextPaymentDueAt = periodEndSeconds
    ? new Date(periodEndSeconds * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const isTrial = subscription.status === "trialing";
  const cardFingerprint = await getCardFingerprint(stripe, subscription, customerId);

  const { data: result, error } = await supabase.rpc("activate_subscription_enrollment", {
    p_hold_id: holdId,
    p_enrollment_id: enrollmentId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_locked_price: lockedPrice,
    p_locked_currency: lockedCurrency,
    p_next_payment_due_at: nextPaymentDueAt,
    p_subscription_status: subscription.status,
    p_is_trial: isTrial,
    p_card_fingerprint: cardFingerprint,
  });

  if (error) {
    console.error("[StripeWebhook] activate_subscription_enrollment failed:", error);
    return;
  }

  if (result?.ok) {
    if (result.student_id) {
      await cancelOldSubscriptionIfAny(supabase, stripe, session, result.student_id, subscriptionId);
      await releaseOldBatchSeatIfAny(supabase, session);
    }

    // Caps this subscription to the phase's own length — set by both a
    // brand-new signup (subscriptionCheckout.ts) and phase re-enrollment
    // (phaseReenrollmentCheckout.ts). Checkout's subscription_data has no
    // cancel_at field at creation time, so it's passed through metadata
    // instead and applied here via a follow-up subscriptions.update() once
    // the subscription actually exists. Also persisted onto the student's
    // own row (subscription_cap_at) — handle_subscription_canceled
    // compares the REAL cancellation time against this stored value (not
    // Stripe's live cancel_at, which a Customer Portal cancellation can
    // overwrite) to tell "the cap fired on schedule" apart from any other
    // ending. See supabase/056_inactive_reason.sql.
    const cancelAtRaw = session.metadata?.cancel_at;
    if (cancelAtRaw && result.student_id) {
      await stripe.subscriptions.update(subscriptionId, { cancel_at: Number(cancelAtRaw) }).catch((err) => {
        console.error("[StripeWebhook] Failed to set cancel_at on re-enrollment subscription:", subscriptionId, err);
      });
      await supabase
        .from("students")
        .update({ subscription_cap_at: new Date(Number(cancelAtRaw) * 1000).toISOString() })
        .eq("id", result.student_id);
    }

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("full_name, email, phone, phase_name, level_name, batch_timing, batch_id, enrollment_ref")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (enrollment && result.student_id) {
      // B1: a Stripe-paid student should be able to sign in within about a
      // minute of paying — resolvePortalAndClassLink (above) calls
      // inviteStudentAndLink itself; never creates a second account for an
      // email that already has one (admin's own login, or a second course
      // for an already-onboarded student), only a genuinely new account
      // gets a password and its own separate portal-access email.
      after(async () => {
        const { portalLink, classLink } = await resolvePortalAndClassLink(
          supabase,
          result.student_id!,
          enrollment.email,
          enrollment.full_name,
          enrollment.batch_id
        );
        if (isTrial) {
          await sendSubscriptionTrialStartedEmail(enrollment.email, {
            fullName: enrollment.full_name,
            courseName: enrollment.phase_name,
            batchTiming: enrollment.batch_timing,
            amount: lockedPrice,
            currency: lockedCurrency,
            firstChargeDate: nextPaymentDueAt.slice(0, 10),
            levelName: enrollment.level_name,
            classLink,
            portalLink,
          }).catch(() => undefined);
        } else {
          await sendSubscriptionWelcomeEmail(enrollment.email, {
            fullName: enrollment.full_name,
            courseName: enrollment.phase_name,
            batchTiming: enrollment.batch_timing,
            amount: lockedPrice,
            currency: lockedCurrency,
            levelName: enrollment.level_name,
            classLink,
            portalLink,
          }).catch(() => undefined);
        }
      });

      after(() =>
        sendAdminNotification({
          fullName: enrollment.full_name,
          phaseName: enrollment.phase_name,
          levelName: enrollment.level_name,
          batchTiming: enrollment.batch_timing,
          email: enrollment.email,
          phone: enrollment.phone,
          enrollmentRef: enrollment.enrollment_ref,
          amountDue: lockedPrice,
          currency: lockedCurrency,
        }).catch(() => undefined)
      );
    }
    return;
  }

  // Not activated. Never leave the student billed for a seat/trial that
  // isn't actually theirs, regardless of which of the two reasons below.
  await cancelAndRefundIfPaid(stripe, subscriptionId);

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, full_name, email, phone, batch_id, phase_name, batch_timing")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) {
    console.error("[StripeWebhook] enrollment not found after cancel/refund", { enrollmentId, reason: result?.reason });
    return;
  }

  if (result?.reason === "duplicate_trial_card") {
    // Fraud-prevention, not a capacity problem — never waitlist for this.
    // payment_events was already logged inside the SQL function itself.
    after(() =>
      sendSubscriptionDuplicateTrialCardEmail(enrollment.email, {
        fullName: enrollment.full_name,
        courseName: enrollment.phase_name,
      }).catch(() => undefined)
    );
    return;
  }

  // result.reason === 'no_hold' — decision 2's lost-race path.
  if (!enrollment.batch_id) {
    console.error("[StripeWebhook] lost-race enrollment has no batch_id", { enrollmentId });
    return;
  }

  // batch_waitlist's uniqueness is a functional index on (batch_id,
  // lower(email)), which PostgREST upsert can't target directly — insert
  // and ignore the expected 23505 if this email is already waitlisted for
  // this batch (harmless either way, nothing to update).
  const { error: waitlistError } = await supabase.from("batch_waitlist").insert({
    batch_id: enrollment.batch_id,
    full_name: enrollment.full_name,
    email: enrollment.email,
    phone: enrollment.phone,
    message: "Auto-added: lost the last-seat race during Stripe checkout.",
  });
  if (waitlistError && waitlistError.code !== "23505") {
    console.error("[StripeWebhook] Failed to add lost-race student to waitlist:", waitlistError);
  }

  await supabase.from("payment_events").insert({
    student_id: null,
    enrollment_id: enrollment.id,
    event_type: "lost_race_waitlisted",
    amount: null,
    currency: null,
    stripe_event_id: null,
    created_by: null,
    note: `Subscription ${subscriptionId} cancelled/refunded — seat was gone by the time checkout.session.completed arrived.`,
  });

  after(() =>
    sendSubscriptionLostRaceEmail(enrollment.email, {
      fullName: enrollment.full_name,
      courseName: enrollment.phase_name,
      batchTiming: enrollment.batch_timing,
    }).catch(() => undefined)
  );
}

/**
 * Public Enroll cutover's one-time "Full" path — a brand-new student
 * paying once via Stripe, no trial, no subscription. Mirrors
 * handleCheckoutCompleted's shape (activate, or refund+waitlist on a lost
 * seat race) but against activate_full_payment_enrollment (migration 055)
 * and a direct PaymentIntent refund instead of a subscription cancel —
 * there is no duplicate_trial_card case here, since nothing is free.
 */
async function handleFullPaymentEnrollCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripeClient>,
  session: Stripe.Checkout.Session
) {
  const enrollmentId = session.metadata?.enrollment_id;
  const holdId = session.metadata?.hold_id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  if (!enrollmentId || !holdId) {
    console.error("[StripeWebhook] full-payment checkout.session.completed missing required metadata", { sessionId: session.id });
    return;
  }

  const amount = (session.amount_total ?? 0) / 100;
  const currency = (session.currency ?? "cad").toUpperCase();

  const { data: result, error } = await supabase.rpc("activate_full_payment_enrollment", {
    p_hold_id: holdId,
    p_enrollment_id: enrollmentId,
    p_stripe_customer_id: customerId ?? null,
    p_amount: amount,
    p_currency: currency,
  });

  if (error) {
    console.error("[StripeWebhook] activate_full_payment_enrollment failed:", error);
    return;
  }

  if (result?.ok) {
    if (result.student_id) {
      await cancelOldSubscriptionIfAny(supabase, stripe, session, result.student_id, null);
      await releaseOldBatchSeatIfAny(supabase, session);
    }

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("full_name, email, phone, phase_name, level_name, batch_timing, batch_id, enrollment_ref")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (enrollment && result.student_id) {
      after(async () => {
        const { portalLink, classLink } = await resolvePortalAndClassLink(
          supabase,
          result.student_id!,
          enrollment.email,
          enrollment.full_name,
          enrollment.batch_id
        );
        await sendFullPaymentWelcomeEmail(enrollment.email, {
          fullName: enrollment.full_name,
          courseName: enrollment.phase_name,
          batchTiming: enrollment.batch_timing,
          amount,
          currency,
          levelName: enrollment.level_name,
          classLink,
          portalLink,
        }).catch(() => undefined);
      });

      after(() =>
        sendAdminNotification({
          fullName: enrollment.full_name,
          phaseName: enrollment.phase_name,
          levelName: enrollment.level_name,
          batchTiming: enrollment.batch_timing,
          email: enrollment.email,
          phone: enrollment.phone,
          enrollmentRef: enrollment.enrollment_ref,
          amountDue: amount,
          currency,
        }).catch(() => undefined)
      );
    }
    return;
  }

  // Not activated — lost the seat race between hold and payment. Never
  // leave the student billed for a seat that was never actually theirs.
  if (paymentIntentId) {
    await stripe.refunds.create({ payment_intent: paymentIntentId }).catch((err) => {
      console.error("[StripeWebhook] Failed to refund lost-race full payment:", err);
    });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, full_name, email, phone, batch_id, phase_name, batch_timing")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment || !enrollment.batch_id) {
    console.error("[StripeWebhook] lost-race full-payment enrollment not found or has no batch_id", { enrollmentId, reason: result?.reason });
    return;
  }

  const { error: waitlistError } = await supabase.from("batch_waitlist").insert({
    batch_id: enrollment.batch_id,
    full_name: enrollment.full_name,
    email: enrollment.email,
    phone: enrollment.phone,
    message: "Auto-added: lost the last-seat race during Stripe checkout.",
  });
  if (waitlistError && waitlistError.code !== "23505") {
    console.error("[StripeWebhook] Failed to add lost-race student to waitlist:", waitlistError);
  }

  await supabase.from("payment_events").insert({
    student_id: null,
    enrollment_id: enrollment.id,
    event_type: "lost_race_waitlisted",
    amount: null,
    currency: null,
    stripe_event_id: null,
    created_by: null,
    note: `One-time payment (session ${session.id}) cancelled/refunded — seat was gone by the time checkout.session.completed arrived.`,
  });

  after(() =>
    sendSubscriptionLostRaceEmail(enrollment.email, {
      fullName: enrollment.full_name,
      courseName: enrollment.phase_name,
      batchTiming: enrollment.batch_timing,
    }).catch(() => undefined)
  );
}

async function handleInvoicePaymentSucceeded(supabase: ReturnType<typeof createAdminClient>, invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id;
  if (!subscriptionId) return;

  const lineItem = invoice.lines.data[0];
  const periodEndSeconds = lineItem?.period?.end;
  const nextPaymentDueAt = periodEndSeconds
    ? new Date(periodEndSeconds * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: result, error } = await supabase.rpc("record_subscription_payment_succeeded", {
    p_stripe_subscription_id: subscriptionId,
    p_amount: invoice.amount_paid / 100,
    p_currency: invoice.currency.toUpperCase(),
    p_next_payment_due_at: nextPaymentDueAt,
    p_subscription_status: "active",
  });

  if (error || !result?.ok || !result.student_id) {
    console.error("[StripeWebhook] record_subscription_payment_succeeded failed:", error ?? result);
    return;
  }

  const { data: student } = await supabase
    .from("students")
    .select("full_name, email")
    .eq("id", result.student_id)
    .maybeSingle();

  if (student) {
    after(() =>
      sendSubscriptionPaymentSucceededEmail(student.email, {
        fullName: student.full_name,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        nextRenewalDate: nextPaymentDueAt.slice(0, 10),
      }).catch(() => undefined)
    );
  }

  await insertPaymentNotification(
    supabase,
    result.student_id,
    "payment_succeeded",
    `Your payment of ${invoice.currency.toUpperCase()} $${(invoice.amount_paid / 100).toFixed(2)} was received. Next renewal: ${nextPaymentDueAt.slice(0, 10)}.`
  );

  const stripe = getStripeClient();

  // A6 — only the referred student's FIRST successful payment ever earns
  // their referrer a reward (never at signup/trial start). Deliberately
  // NOT result.is_first_payment (counting prior payment_succeeded log
  // rows) — a non-trial activation already logs one of those itself
  // (see activate_subscription_enrollment), which would make this, the
  // real first invoice.payment_succeeded event, look like a second
  // payment. invoice.billing_reason === 'subscription_create' is
  // Stripe's own authoritative signal for "this is the subscription's
  // first invoice," correct regardless of trial or non-trial.
  if (invoice.billing_reason === "subscription_create") {
    const { data: creditResult } = await supabase.rpc("credit_referral_if_earned", {
      p_referred_student_id: result.student_id,
    });
    if (creditResult?.ok && creditResult.referrer_student_id) {
      if (!creditResult.queued) {
        await attachReferrerCoupon(supabase, stripe, creditResult.referrer_student_id);
      }
      // A8 — notify the referrer at the moment they EARN the reward, not
      // again later when a queued one actually attaches (apply_queued_
      // referral_if_any below) — one notification per referral earned.
      await notifyReferralRewardEarned(supabase, creditResult.referrer_student_id, Boolean(creditResult.queued));
    }
  }

  // Independently, THIS student (as a referrer) might have a queued
  // credit waiting for the first invoice with room for it — this is the
  // "max one $25 per cycle, queue the next instead of dropping it" rule.
  const { data: queuedResult } = await supabase.rpc("apply_queued_referral_if_any", {
    p_student_id: result.student_id,
  });
  if (queuedResult?.ok) {
    await attachReferrerCoupon(supabase, stripe, result.student_id);
  }
}

async function attachReferrerCoupon(
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripeClient>,
  referrerStudentId: string
) {
  const { data: referrer } = await supabase
    .from("students")
    .select("stripe_subscription_id")
    .eq("id", referrerStudentId)
    .maybeSingle();
  if (!referrer?.stripe_subscription_id) return;

  await stripe.subscriptions
    .update(referrer.stripe_subscription_id, { discounts: [{ coupon: REFERRER_DISCOUNT_COUPON_ID }] })
    .catch((err) => {
      console.error("[StripeWebhook] Failed to attach referrer coupon:", err);
    });
}

/** A8 — fires once per referral, at the moment the referrer earns it
 * (whether the $25 coupon attaches immediately or is queued behind one
 * already in use — see attachReferrerCoupon / apply_queued_referral_if_any
 * above). $25 CAD is hardcoded here because it's the fixed value of
 * REFERRER_DISCOUNT_COUPON_ID (see referralCoupons.ts), not a per-student
 * figure that needs looking up. */
async function notifyReferralRewardEarned(
  supabase: ReturnType<typeof createAdminClient>,
  referrerStudentId: string,
  queued: boolean
) {
  const { data: referrer } = await supabase
    .from("students")
    .select("full_name, email")
    .eq("id", referrerStudentId)
    .maybeSingle();
  if (!referrer) return;

  const amount = 25;
  const currency = "CAD";

  await insertPaymentNotification(
    supabase,
    referrerStudentId,
    "referral_reward",
    queued
      ? `You've earned a ${currency} $${amount.toFixed(2)} referral reward — it'll apply to a future invoice once your current discount is used up.`
      : `You've earned a ${currency} $${amount.toFixed(2)} referral reward — it's been applied to your subscription.`
  );

  after(() =>
    sendReferralRewardEarnedEmail(referrer.email, { fullName: referrer.full_name, amount, currency }).catch(() => undefined)
  );
}

/**
 * invoice.payment_failed — increments payment_failure_count and logs it
 * (via record_payment_failed), then sends an immediate notification/email
 * for THIS specific failed attempt (A8). Deliberately does NOT itself
 * change status: Stripe can retry a single invoice several times, and the
 * SUSPEND/INACTIVE timeline is governed purely by elapsed calendar days
 * since next_payment_due_at (the daily sweep), never by how many retries
 * happened — see supabase/044_payment_failure_lifecycle.sql. This is
 * intentionally distinct from the daily sweep's payment_overdue_reminder
 * (sent once per day on days 1-3) — Stripe's retry schedule is normally
 * days apart, so this fires once per genuinely new failed attempt, not a
 * flood of near-duplicates.
 */
async function handleInvoicePaymentFailed(supabase: ReturnType<typeof createAdminClient>, invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id;
  if (!subscriptionId) return;

  const { data: result, error } = await supabase.rpc("record_payment_failed", {
    p_stripe_subscription_id: subscriptionId,
    p_amount: invoice.amount_due / 100,
    p_currency: invoice.currency.toUpperCase(),
  });

  if (error || !result?.ok || !result.student_id) {
    console.error("[StripeWebhook] record_payment_failed failed:", error ?? result);
    return;
  }

  const { data: student } = await supabase
    .from("students")
    .select("full_name, email")
    .eq("id", result.student_id)
    .maybeSingle();
  if (!student) return;

  const amount = invoice.amount_due / 100;
  const currency = invoice.currency.toUpperCase();

  await insertPaymentNotification(
    supabase,
    result.student_id,
    "payment_failed",
    `We tried to charge ${currency} $${amount.toFixed(2)} and it didn't go through. We'll automatically try again.`
  );

  after(() =>
    sendSubscriptionPaymentFailedEmail(student.email, { fullName: student.full_name, amount, currency }).catch(() => undefined)
  );
}

/**
 * customer.subscription.trial_will_end — Stripe's default is ~3 days
 * before the trial ends. student_id can briefly be null here (the student
 * row might not exist yet if this somehow raced activation), handled the
 * same defensive way record_payment_alert does elsewhere in this file.
 */
async function handleTrialWillEnd(supabase: ReturnType<typeof createAdminClient>, subscription: Stripe.Subscription) {
  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, email, locked_price, locked_currency, next_payment_due_at")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  await supabase.from("payment_events").insert({
    student_id: student?.id ?? null,
    enrollment_id: null,
    event_type: "trial_ending",
    amount: null,
    currency: null,
    stripe_event_id: null,
    created_by: null,
    note: `customer.subscription.trial_will_end for ${subscription.id}`,
  });

  if (!student) return;

  const firstChargeDate = student.next_payment_due_at
    ? student.next_payment_due_at.slice(0, 10)
    : new Date((subscription.trial_end ?? Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 10);
  const amount = student.locked_price ?? 0;
  const currency = student.locked_currency ?? "CAD";

  await insertPaymentNotification(
    supabase,
    student.id,
    "trial_ending",
    `Your free trial ends soon — your card will be charged ${currency} $${amount.toFixed(2)} on ${firstChargeDate}.`
  );

  after(() =>
    sendSubscriptionTrialEndingEmail(student.email, { fullName: student.full_name, amount, currency, firstChargeDate }).catch(
      () => undefined
    )
  );
}

/**
 * invoice.upcoming — the established-subscriber counterpart to
 * trial_will_end (A8). Skips a student still trialing: they already get
 * their own dedicated heads-up above for this exact same upcoming charge,
 * and sending both would be a confusing double message for one event.
 */
async function handleInvoiceUpcoming(supabase: ReturnType<typeof createAdminClient>, invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id;
  if (!subscriptionId) return;

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, email, subscription_status")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!student || student.subscription_status === "trialing") return;

  const amount = invoice.amount_due / 100;
  const currency = invoice.currency.toUpperCase();
  const renewalDate = new Date((invoice.next_payment_attempt ?? Math.floor(Date.now() / 1000)) * 1000)
    .toISOString()
    .slice(0, 10);

  await insertPaymentNotification(
    supabase,
    student.id,
    "renewal_upcoming",
    `Your card will be charged ${currency} $${amount.toFixed(2)} on ${renewalDate} for your next month.`
  );

  after(() =>
    sendSubscriptionRenewalUpcomingEmail(student.email, { fullName: student.full_name, amount, currency, renewalDate }).catch(
      () => undefined
    )
  );
}

async function handleSubscriptionDeleted(supabase: ReturnType<typeof createAdminClient>, subscription: Stripe.Subscription) {
  const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;
  const { data: result, error } = await supabase.rpc("handle_subscription_canceled", {
    p_stripe_subscription_id: subscription.id,
    p_canceled_at: canceledAt,
  });

  if (error || !result?.ok || !result.student_id) {
    console.error("[StripeWebhook] handle_subscription_canceled failed:", error ?? result);
    return;
  }

  // Already handled by admin_deactivate_student or the day-14 sweep (see
  // supabase/048_payment_notifications.sql) — this webhook is just Stripe
  // catching up with a cancellation WE initiated and already told the
  // student about (or, for an admin-initiated one, deliberately didn't).
  // Sending the generic "subscription cancelled" email here too would be
  // a confusing duplicate for the same event.
  if (result.already_inactive) return;

  const { data: student } = await supabase
    .from("students")
    .select("full_name, email")
    .eq("id", result.student_id)
    .maybeSingle();

  if (student) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("phase_name")
      .eq("student_id", result.student_id)
      .eq("payment_mode", "subscription")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // phase_completed (the cap reached its scheduled end, see
    // supabase/056_inactive_reason.sql) gets its own positive-toned
    // email, not the generic cancellation one — a student who just
    // finished paying for a full phase on schedule shouldn't read
    // "cancelled."
    if (result.inactive_reason === "phase_completed") {
      after(async () => {
        const { data: access } = await supabase.from("student_portal_access").select("access_token").eq("student_id", result.student_id!).maybeSingle();
        const portalLink = access?.access_token ? `${getSiteUrl()}/student/access/${access.access_token}` : undefined;
        await sendPhaseCompletedEmail(student.email, {
          fullName: student.full_name,
          courseName: enrollment?.phase_name ?? "your course",
          portalLink,
        }).catch(() => undefined);
      });
      return;
    }

    after(() =>
      sendSubscriptionCanceledEmail(student.email, {
        fullName: student.full_name,
        courseName: enrollment?.phase_name ?? "your course",
      }).catch(() => undefined)
    );
  }
}

/**
 * charge.refunded / charge.dispute.created — logs only (see
 * record_payment_alert, migration 045) and alerts admin. Deliberately
 * makes NO access-state change: the refund policy is still pending from
 * the client, so this is purely visibility, not automation. The ONE
 * exception (migration 049): a refund that is specifically for a
 * REFERRED student's FIRST payment reverses their referrer's reward —
 * "a refunded first payment must not leave a referral reward standing."
 */
async function handlePaymentAlert(
  supabase: ReturnType<typeof createAdminClient>,
  object: Stripe.Charge | Stripe.Dispute,
  eventType: "charge_refunded" | "charge_disputed"
) {
  const stripe = getStripeClient();
  let customerId: string | undefined;
  let amount: number;
  let currency: string;
  let stripeObjectId: string;
  let refundedCharge: Stripe.Charge | null = null;

  if (eventType === "charge_refunded") {
    const charge = object as Stripe.Charge;
    refundedCharge = charge;
    customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
    amount = charge.amount_refunded / 100;
    currency = charge.currency.toUpperCase();
    stripeObjectId = charge.id;
  } else {
    const dispute = object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
    }
    amount = dispute.amount / 100;
    currency = dispute.currency.toUpperCase();
    stripeObjectId = dispute.id;
  }

  if (!customerId) {
    console.error("[StripeWebhook] payment alert with no resolvable customer", { eventType, stripeObjectId });
    return;
  }

  const { data: result, error } = await supabase.rpc("record_payment_alert", {
    p_stripe_customer_id: customerId,
    p_event_type: eventType,
    p_amount: amount,
    p_currency: currency,
    p_stripe_object_id: stripeObjectId,
  });

  if (error || !result?.ok) {
    console.error("[StripeWebhook] record_payment_alert failed:", error ?? result);
    return;
  }

  let reversedReferral = false;
  if (eventType === "charge_refunded" && refundedCharge && result.student_id) {
    reversedReferral = await reverseReferralIfFirstPaymentRefund(supabase, stripe, result.student_id, customerId, refundedCharge);
  }

  after(() =>
    sendAdminPaymentAlert({
      kind: eventType === "charge_refunded" ? "refund" : "dispute",
      studentEmail: result.email ?? "",
      studentName: result.full_name ?? null,
      amount,
      currency,
      stripeObjectId,
      note: reversedReferral ? "This refund also reversed a referral reward for this student's referrer." : undefined,
    }).catch(() => undefined)
  );
}

/**
 * Only reverses when the refunded charge is specifically the REFERRED
 * student's FIRST invoice (billing_reason 'subscription_create') —
 * refunding a LATER month must never touch a reward that was already
 * correctly earned. Matched by comparing payment_intent ids rather than
 * invoice ids, since a Charge doesn't carry a direct invoice reference in
 * this API version (the same pattern cancelAndRefundIfPaid above uses).
 */
async function reverseReferralIfFirstPaymentRefund(
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripeClient>,
  referredStudentId: string,
  customerId: string | undefined,
  refundedCharge: Stripe.Charge
): Promise<boolean> {
  if (!customerId) return false;

  const refundedPiId = typeof refundedCharge.payment_intent === "string" ? refundedCharge.payment_intent : refundedCharge.payment_intent?.id;
  if (!refundedPiId) return false;

  const invoices = await stripe.invoices.list({ customer: customerId, limit: 100 });
  const firstInvoice = invoices.data.find((inv) => inv.billing_reason === "subscription_create");
  if (!firstInvoice) return false;

  const fullFirstInvoice = await stripe.invoices.retrieve(firstInvoice.id!, {
    expand: ["payments.data.payment.payment_intent"],
  });
  const rawPi = fullFirstInvoice.payments?.data?.[0]?.payment?.payment_intent;
  const firstInvoicePiId = typeof rawPi === "string" ? rawPi : rawPi?.id;
  if (!firstInvoicePiId || firstInvoicePiId !== refundedPiId) return false;

  const { data: reverseResult, error } = await supabase.rpc("reverse_referral_if_refunded", {
    p_referred_student_id: referredStudentId,
  });
  if (error || !reverseResult?.ok) {
    console.error("[StripeWebhook] reverse_referral_if_refunded failed:", error ?? reverseResult);
    return false;
  }
  if (!reverseResult.reversed || !reverseResult.referrer_student_id) return false;

  const { data: referrer } = await supabase
    .from("students")
    .select("full_name, email, stripe_subscription_id")
    .eq("id", reverseResult.referrer_student_id)
    .maybeSingle();
  if (!referrer) return true;

  // Only remove the live Stripe discount if it was actually attached
  // ('applied') — an 'earned' (queued) one was never attached to anything.
  // Best-effort: if the coupon already finished discounting a past
  // invoice, Stripe has nothing left to remove — that invoice stays as
  // billed, which is the correct, expected outcome, not an error.
  if (reverseResult.was_applied && referrer.stripe_subscription_id) {
    await stripe.subscriptions.deleteDiscount(referrer.stripe_subscription_id).catch((err) => {
      console.error("[StripeWebhook] Failed to remove reversed referrer coupon:", err);
    });
  }

  await insertPaymentNotification(
    supabase,
    reverseResult.referrer_student_id,
    "referral_reward",
    "A referral reward was reversed because the student you referred had their first payment refunded."
  );

  return true;
}
