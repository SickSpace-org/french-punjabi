Modify the EXISTING French Punjabi enrollment system to support manual Interac e-Transfer payments.

IMPORTANT:

Do NOT integrate:
- Stripe
- PayPal
- Square
- Credit/debit card checkout
- Any payment gateway

Payment will be made separately by Interac e-Transfer to:

hiteshsharma2454@gmail.com

The website must NOT claim that it can automatically verify an Interac e-Transfer.

The ADMIN will manually confirm that the payment has arrived.

Once the admin confirms payment, the system should automatically:

1. Mark the enrollment as PAID.
2. Mark the enrollment as ENROLLED.
3. Add/create the student in the Students section.
4. Assign the student to their selected Phase, Level and Batch.
5. Send the student an enrollment-confirmation email.

Keep the existing Supabase database, Admin Dashboard, Courses system,
authentication and website design.

==================================================
1. STUDENT ENROLLMENT FLOW
==================================================

The flow should be:

Courses
↓
Select Phase
↓
Select Level
↓
Select Batch
↓
ENROLL NOW
↓
Fill Enrollment Form
↓
SUBMIT
↓
Save enrollment in Supabase
↓
Show Interac e-Transfer instructions
↓
Student sends payment separately
↓
Admin confirms payment
↓
Student becomes enrolled

Submitting the form itself does NOT mean the student is enrolled.

==================================================
2. AFTER FORM SUBMISSION
==================================================

After a valid enrollment form has successfully been saved in Supabase,
show a professional confirmation/payment instruction screen.

Heading:

ENROLLMENT REQUEST RECEIVED

Message:

Thank you, [First Name].

We have received your enrollment request.

To complete your enrollment, please send your course fee using
Interac e-Transfer.

Then show a clear payment card:

----------------------------------

INTERAC E-TRANSFER

Send payment to:

hiteshsharma2454@gmail.com

Amount:
C$[selected course amount] CAD

Enrollment Reference:
[Enrollment ID]

----------------------------------

Add a COPY EMAIL button beside:

hiteshsharma2454@gmail.com

and a COPY REFERENCE button beside the Enrollment ID.

Do NOT add a fake "Pay Now" button because the website is not processing
the transfer.

Instead show:

OPEN YOUR BANKING APP

and instructions:

1. Sign in to your Canadian online/mobile banking.
2. Choose Interac e-Transfer.
3. Send the displayed amount to:
   hiteshsharma2454@gmail.com
4. Include your Enrollment Reference in the message/note where possible.
5. Our team will confirm your enrollment after the payment is received.

Add:

IMPORTANT

Your seat is not confirmed until payment has been received and verified
by the French Punjabi team.

==================================================
3. UNIQUE ENROLLMENT ID
==================================================

Every submitted enrollment should receive a unique reference.

Example:

FP-2026-A7K4P2

Store it in Supabase.

The student should see this reference on:

- Submission confirmation page
- Payment instructions
- Confirmation email

This makes matching Interac transfers to enrollments easier.

==================================================
4. PAYMENT STATUS
==================================================

Add/maintain payment status for every enrollment.

Support:

PENDING
PAID

When the student first submits:

Enrollment Status:
NEW

Payment Status:
PENDING

Do NOT mark the student PAID automatically.

==================================================
5. ADMIN → ENROLLMENTS
==================================================

Update the existing:

/admin/enrollments

page.

Each enrollment should show:

Student Name
Enrollment ID
Email
Phone
Phase
Level
Batch
Amount Due
Payment Status
Enrollment Status
Submission Date

Example:

John Smith
FP-2026-A7K4P2

Phase 1 — Level 2
9:00 PM EST

C$620.37 CAD

Payment:
PENDING

Enrollment:
NEW

[ VIEW DETAILS ]

==================================================
6. CONFIRM PAYMENT BUTTON
==================================================

Inside an enrollment's admin details, when:

Payment Status = PENDING

show:

[ CONFIRM PAYMENT RECEIVED ]

When clicked, show a confirmation modal:

CONFIRM PAYMENT

Are you sure you have received the Interac e-Transfer for:

John Smith
FP-2026-A7K4P2
C$620.37 CAD

Only confirm this after checking that the payment has actually arrived.

[ CANCEL ]

[ YES, PAYMENT RECEIVED ]

Do NOT confirm immediately without this second confirmation.

==================================================
7. AFTER ADMIN CONFIRMS PAYMENT
==================================================

When admin clicks:

YES, PAYMENT RECEIVED

perform the following as ONE reliable server-side operation/workflow:

Payment Status:
PENDING → PAID

Enrollment Status:
→ ENROLLED

Record:

paid_at
confirmed_by
updated_at

Then create/add the person to the Students system.

==================================================
8. STUDENTS SECTION
==================================================

Make the existing:

Admin → Students

section functional if it is currently only a placeholder.

Route:

/admin/students

A student should appear here ONLY after payment has been manually
confirmed by an authorized admin.

Store/show:

Student Name
Email
Phone
Country
Phase
Level
Batch
Enrollment ID
Enrollment Date
Status

Example:

John Smith

Phase 1
Level 2
9:00 PM EST

Enrollment:
FP-2026-A7K4P2

Status:
ACTIVE

==================================================
9. PREVENT DUPLICATE STUDENTS
==================================================

If the admin accidentally presses confirmation again or refreshes:

Do NOT:

- create another student
- send another confirmation email
- duplicate enrollment
- duplicate batch assignment

The confirmation operation must be idempotent.

Once paid, replace the button with:

✓ PAYMENT CONFIRMED

and show:

Confirmed on:
[date/time]

==================================================
10. STUDENT EMAIL AFTER FORM SUBMISSION
==================================================

After the enrollment request is successfully saved, send the student an
email.

Subject:

Enrollment Request Received — French Punjabi

Content:

Hello [Student Name],

Thank you for your interest in French Punjabi.

We have received your enrollment request.

Your selection:

[Phase]
[Level]
[Batch]

Enrollment Reference:
[Enrollment ID]

To complete your enrollment, please send the course fee via Interac
e-Transfer to:

hiteshsharma2454@gmail.com

Amount:
C$[Amount] CAD

Please include your Enrollment Reference in the transfer message/note
where possible.

Your seat will be confirmed after our team receives and verifies your
payment.

Regards,
French Punjabi Team

IMPORTANT:

This email must NOT say the student is enrolled yet.

==================================================
11. FINAL EMAIL AFTER PAYMENT CONFIRMATION
==================================================

When the ADMIN confirms payment, automatically send another email.

Subject:

Enrollment Confirmed — French Punjabi

Content:

Hello [Student Name],

Your payment has been received and your enrollment with French Punjabi
is now confirmed.

COURSE DETAILS

[Phase]
[Level]
[Batch]

Amount Received:
C$[Amount] CAD

Enrollment Reference:
[Enrollment ID]

Our team will contact you shortly with the next steps and class details.

Thank you,
French Punjabi Team

==================================================
12. PRICING
==================================================

Use the existing database-backed pricing.

Do NOT hardcode the amount separately inside the enrollment form.

When the student selects:

Phase
Level
Payment option

retrieve the applicable course price from the trusted Supabase course
data.

Display the amount clearly in CAD.

Example:

C$224.87 CAD

Do NOT allow the browser/user to manipulate the stored amount.

==================================================
13. ADMIN STUDENT WORKFLOW
==================================================

The final admin workflow should look like:

NEW ENROLLMENT

John Smith

Phase 1 — Level 2
9:00 PM EST

Amount:
C$620.37 CAD

Payment:
🟡 PENDING

[ CONFIRM PAYMENT RECEIVED ]

Admin checks Canadian bank account.

Payment has arrived.

↓

CONFIRM PAYMENT RECEIVED

↓

Confirmation modal

↓

YES, PAYMENT RECEIVED

↓

Payment:
🟢 PAID

Enrollment:
🟢 ENROLLED

↓

Automatically appears in:

ADMIN → STUDENTS

↓

Student receives:

ENROLLMENT CONFIRMED email.

==================================================
14. SECURITY
==================================================

Only authorized admins should be able to confirm payments.

A public user must NEVER be able to call an endpoint and change:

PENDING → PAID

Protect payment confirmation server-side using the existing Supabase
admin authentication/authorization system.

Do NOT rely only on hiding the button.

Do NOT expose service-role credentials to the browser.

==================================================
15. IMPORTANT — THIS IS MANUAL PAYMENT VERIFICATION
==================================================

Interac payment destination:

hiteshsharma2454@gmail.com

The website does NOT have access to the bank account.

Therefore:

DO NOT automatically mark an enrollment PAID because:

- Student submitted the form
- Student clicked a button
- Student claims payment was sent
- Student opened a confirmation page
- Student entered a transaction/reference number

ONLY an authorized admin can confirm:

PAYMENT RECEIVED

after checking the actual Interac e-Transfer.

==================================================
16. DO NOT BREAK EXISTING FEATURES
==================================================

Keep working:

Admin authentication
/admin
/admin/courses
/admin/enrollments
Courses
Structure
Syllabus
Batch availability
Pricing
Course editing
Timings
Available / Almost Full / Full / Hidden

Do not redesign unrelated parts of the website.

==================================================
17. TESTING
==================================================

After implementation run:

npm run build

Fix all errors.

Then test:

1. Submit a test enrollment.
2. Verify it appears in Admin → Enrollments.
3. Verify Payment = PENDING.
4. Verify student does NOT appear in Students yet.
5. Verify payment instructions show:
   hiteshsharma2454@gmail.com
6. Verify the first confirmation email is sent.
7. Admin clicks Confirm Payment Received.
8. Verify confirmation modal appears.
9. Confirm payment.
10. Verify Payment = PAID.
11. Verify Enrollment = ENROLLED.
12. Verify student automatically appears in Students.
13. Verify correct Phase/Level/Batch assignment.
14. Verify final enrollment-confirmation email is sent.
15. Verify clicking/refreshing again does not create duplicates.

Finally, tell me exactly what files/database migrations were changed and
any manual Supabase/email-service setup I still need to complete.