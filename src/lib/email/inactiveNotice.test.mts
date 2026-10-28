// Unit tests for the inactive-students email (template, {first name}, refuse-to-send checks, recipients, Resend answers).
// Run with:  npm run test:inactive-notice      (Node's built-in test runner; no network, no database, sends nothing)
import { test } from "node:test";
import assert from "node:assert/strict";
import { INACTIVE_NOTICE } from "./inactiveNoticeConstants.ts";
import {
  classifyResendError,
  emailAddressOf,
  escapeHtml,
  findNoticeConfigProblems,
  firstNameOf,
  greetingFor,
  isMissingTableError,
  isPlaceholderText,
  isRecipientAllowedHere,
  isSandboxSender,
  mapBatchResponse,
  normalizeEmail,
  renderInactiveNotice,
  selectRecipients,
  type NoticeConfig,
} from "./inactiveNotice.ts";

const GOOD_APP_FROM = "AngrishFrançais <enrollments@angrishfrancais.com>";
const withConfig = (patch: Partial<NoticeConfig>): NoticeConfig => ({ ...INACTIVE_NOTICE, ...patch });

// ---------------------------------------------------------------- the exact wording you supplied
test("contact line is exactly the supplied text, URL included", () => {
  const exact = "If you'd like to rejoin, or you think this is a mistake, please contact us: https://www.angrishfrancais.com/contact";
  assert.equal(`${INACTIVE_NOTICE.contactIntro} ${INACTIVE_NOTICE.contactUrl}`, exact);
  assert.ok(renderInactiveNotice("Priya Sharma").text.includes(exact));
});

test("footer is exactly the supplied text, in both versions", () => {
  const exact = "AngrishFrançais · Angrish Language classes Inc · 63 Binder Twine Trail, Brampton, ON L6X 4T2, Canada";
  assert.equal(INACTIVE_NOTICE.footer, exact);
  const mail = renderInactiveNotice("Priya");
  assert.ok(mail.text.includes(exact));
  assert.ok(mail.html.includes(exact));
});

test("the contact URL is a clickable link in the HTML", () => {
  const { html } = renderInactiveNotice("Priya");
  assert.ok(html.includes('<a href="https://www.angrishfrancais.com/contact">https://www.angrishfrancais.com/contact</a>'));
});

test("sender is noreply@angrishfrancais.com", () => {
  assert.equal(emailAddressOf(INACTIVE_NOTICE.from), "noreply@angrishfrancais.com");
});

// ---------------------------------------------------------------- {first name}
test("first name: Hi <first word>,", () => {
  assert.equal(greetingFor("Priya Sharma"), "Hi Priya,");
  assert.equal(greetingFor("  Priya   Kaur  Sharma "), "Hi Priya,");
  assert.equal(greetingFor("Élodie Martin"), "Hi Élodie,");
  assert.equal(greetingFor("李雷 韩"), "Hi 李雷,");
  assert.ok(renderInactiveNotice("Priya Sharma").text.startsWith("Hi Priya,\n"));
});

test("first name falls back to 'Hi there' when missing, empty or unusable", () => {
  for (const value of [null, undefined, "", "   ", "\n\t", "-", "...", "😀", "‮"]) {
    assert.equal(greetingFor(value as string | null | undefined), "Hi there,", `value ${JSON.stringify(value)}`);
  }
  assert.ok(renderInactiveNotice(null).text.startsWith("Hi there,\n"));
  assert.ok(renderInactiveNotice("").html.includes("Hi there,"));
});

test("first name: line breaks, control and bidi characters never survive", () => {
  assert.equal(firstNameOf("Anna\r\nBcc: evil@example.net"), "Anna");
  assert.equal(firstNameOf("\u0000Anna"), "Anna");
  assert.equal(firstNameOf("A‮nna"), "A");
  const mail = renderInactiveNotice("Anna\r\nBcc: evil@example.net");
  assert.ok(!/Bcc/.test(mail.text.split("\n")[0]));
});

test("first name is capped at 40 characters", () => {
  const long = "A".repeat(500);
  assert.equal(firstNameOf(long)?.length, 40);
  assert.ok(greetingFor(long).length < 60);
});

// ---------------------------------------------------------------- escaping
test("everything is escaped in the HTML", () => {
  const evil = `<script>alert(1)</script> "><img src=x onerror=alert(2)> & 'x'`;
  const { html } = renderInactiveNotice(evil);
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
  const apostrophe = renderInactiveNotice("O'Brien Murphy");
  assert.ok(apostrophe.html.includes("Hi O&#39;Brien,"));
  assert.ok(apostrophe.text.startsWith("Hi O'Brien,"));
});

test("the fixed constants are escaped too", () => {
  const { html, text } = renderInactiveNotice(
    "Priya",
    withConfig({ intro: "5 < 6 & \"quotes\"", footer: "Acme <b>Inc</b>" })
  );
  assert.ok(html.includes("5 &lt; 6 &amp; &quot;quotes&quot;"));
  assert.ok(html.includes("Acme &lt;b&gt;Inc&lt;/b&gt;"));
  assert.ok(!html.includes("<b>Inc"));
  assert.ok(text.includes("5 < 6 & \"quotes\""));
});

test("escapeHtml covers & < > \" '", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("subject never contains a line break", () => {
  assert.equal(renderInactiveNotice("x", withConfig({ subject: "Hello\r\nBcc: a@b.c" })).subject, "Hello Bcc: a@b.c");
  assert.equal(renderInactiveNotice("x").subject, INACTIVE_NOTICE.subject);
});

test("a contact URL that is not a full https link is refused at render time", () => {
  for (const bad of ["javascript:alert(1)", "/contact", "http://www.angrishfrancais.com/contact", "https://localhost", ""]) {
    assert.throws(() => renderInactiveNotice("x", withConfig({ contactUrl: bad })), /https/, bad);
  }
});

// ---------------------------------------------------------------- refuse-to-send guard
test("the shipped configuration has no problems", () => {
  assert.deepEqual(findNoticeConfigProblems({ apiKeyPresent: true, appFromAddress: GOOD_APP_FROM }), []);
});

test("refuses while the app sender is the Resend sandbox, and says which setting is wrong", () => {
  for (const sandbox of ["AngrishFrançais <onboarding@resend.dev>", "onboarding@resend.dev", undefined, null, ""]) {
    const problems = findNoticeConfigProblems({ apiKeyPresent: true, appFromAddress: sandbox });
    const p = problems.find((x) => x.code === "from_sandbox");
    assert.ok(p, `sandbox ${String(sandbox)}`);
    assert.match(p!.message, /RESEND_FROM_EMAIL/);
  }
});

test("refuses while the notice's own sender is a placeholder or the sandbox", () => {
  for (const from of ["[SENDER]", "AngrishFrançais <onboarding@resend.dev>", "noreply", ""]) {
    const problems = findNoticeConfigProblems({ config: withConfig({ from }), apiKeyPresent: true, appFromAddress: GOOD_APP_FROM });
    assert.ok(problems.some((x) => x.code === "from_invalid"), from);
  }
});

test("refuses while any text still holds a placeholder, naming the field and the file", () => {
  const cases: [Partial<NoticeConfig>, string][] = [
    [{ footer: "[BUSINESS NAME] · [ADDRESS]" }, "placeholder_footer"],
    [{ footer: "" }, "placeholder_footer"],
    [{ footer: "PLACEHOLDER" }, "placeholder_footer"],
    [{ footer: "TODO add address" }, "placeholder_footer"],
    [{ contactIntro: "[CONTACT LINE]" }, "placeholder_contactIntro"],
    [{ intro: "{{intro}}" }, "placeholder_intro"],
    [{ subject: "  " }, "placeholder_subject"],
    [{ signOffName: "[NAME]" }, "placeholder_signOffName"],
    [{ contactUrl: "[URL]" }, "contact_url_invalid"],
    [{ contactUrl: "http://www.angrishfrancais.com/contact" }, "contact_url_invalid"],
    [{ contactUrl: "javascript:alert(1)" }, "contact_url_invalid"],
  ];
  for (const [patch, code] of cases) {
    const problems = findNoticeConfigProblems({ config: withConfig(patch), apiKeyPresent: true, appFromAddress: GOOD_APP_FROM });
    const found = problems.find((x) => x.code === code);
    assert.ok(found, `${JSON.stringify(patch)} should raise ${code}`);
    assert.match(found!.message, /inactiveNoticeConstants\.ts/);
  }
});

test("refuses without an API key", () => {
  const problems = findNoticeConfigProblems({ apiKeyPresent: false, appFromAddress: GOOD_APP_FROM });
  assert.ok(problems.some((x) => x.code === "api_key_missing"));
});

test("several problems are all reported at once", () => {
  const problems = findNoticeConfigProblems({
    config: withConfig({ footer: "[x]", contactUrl: "[y]" }),
    apiKeyPresent: false,
    appFromAddress: undefined,
  });
  const codes = problems.map((p) => p.code);
  for (const code of ["api_key_missing", "from_sandbox", "placeholder_footer", "contact_url_invalid"]) assert.ok(codes.includes(code), code);
});

test("placeholder / sandbox detectors", () => {
  assert.equal(isPlaceholderText("63 Binder Twine Trail, Brampton, ON"), false);
  assert.equal(isPlaceholderText("Angrish Language classes Inc"), false);
  assert.equal(isPlaceholderText("[ADDRESS]"), true);
  assert.equal(isSandboxSender("AngrishFrançais <noreply@angrishfrancais.com>"), false);
  assert.equal(isSandboxSender("x@resend.dev"), true);
});

// ---------------------------------------------------------------- who gets it
const student = (id: string, email: string | null, full_name: string | null = "Priya Sharma") => ({ id, email, full_name });

test("recipients: missing and invalid addresses are skipped, duplicates collapse, recent ones are skipped", () => {
  const { recipients, skipped } = selectRecipients(
    [
      student("1", "a@x.com"),
      student("2", null),
      student("3", "   "),
      student("4", "not-an-email"),
      student("5", "A@X.com"), // same address as 1
      student("6", "b@x.com"),
      student("7", "c@x.com"),
      student("8", "evil@x.com\r\nBcc: z@z.com"),
      student("9", "two words@x.com"),
    ],
    new Set(["7"])
  );
  assert.deepEqual(
    recipients.map((r) => [r.studentId, r.email]),
    [["1", "a@x.com"], ["6", "b@x.com"]]
  );
  assert.deepEqual(skipped, { noEmail: 2, invalidEmail: 3, duplicate: 1, recentlyEmailed: 1 });
});

test("recipients: input order is kept and addresses are normalised", () => {
  const { recipients } = selectRecipients([student("1", "  Z@Y.com "), student("2", "a@y.com")], new Set());
  assert.deepEqual(recipients.map((r) => r.email), ["z@y.com", "a@y.com"]);
  assert.equal(normalizeEmail("  Mixed@Case.COM "), "mixed@case.com");
  assert.equal(normalizeEmail("a@b"), null);
});

test("development safety net: only the developer's own addresses outside production", () => {
  for (const env of [undefined, "development", "preview", ""]) {
    assert.equal(isRecipientAllowedHere("abhinavgarg4982@gmail.com", env), true);
    assert.equal(isRecipientAllowedHere("abhinavgarg4982+seed-active@gmail.com", env), true);
    assert.equal(isRecipientAllowedHere("ABHINAVGARG4982+x@gmail.com", env), true);
    assert.equal(isRecipientAllowedHere("student@example.com", env), false);
    assert.equal(isRecipientAllowedHere("abhinavgarg4982@gmail.com.evil.com", env), false);
    assert.equal(isRecipientAllowedHere("xabhinavgarg4982@gmail.com", env), false);
    assert.equal(isRecipientAllowedHere("abhinavgarg4982+a@evil.com", env), false);
  }
  assert.equal(isRecipientAllowedHere("student@example.com", "production"), true);
});

// ---------------------------------------------------------------- Resend answers
test("quota and rate-limit rejections are recognised (stop, do not retry)", () => {
  assert.equal(classifyResendError({ name: "daily_quota_exceeded", statusCode: 429 }), "quota");
  assert.equal(classifyResendError({ name: "monthly_quota_exceeded", statusCode: 429 }), "quota");
  assert.equal(classifyResendError({ name: "rate_limit_exceeded", statusCode: 429 }), "rate_limit");
  assert.equal(classifyResendError({ name: "something", statusCode: 429, message: "Too many requests" }), "rate_limit");
  assert.equal(classifyResendError({ name: "something", statusCode: 429, message: "You have reached your daily email sending quota" }), "quota");
  assert.equal(classifyResendError({ name: "validation_error", statusCode: 422 }), "other");
  assert.equal(classifyResendError({ name: "application_error", statusCode: 500 }), "other");
  assert.equal(classifyResendError(null), "other");
});

test("batch answer: ids and per-email errors are put back in order", () => {
  assert.deepEqual(mapBatchResponse(3, [{ id: "a" }, { id: "b" }, { id: "c" }], []), [
    { index: 0, ok: true, id: "a" },
    { index: 1, ok: true, id: "b" },
    { index: 2, ok: true, id: "c" },
  ]);
  assert.deepEqual(mapBatchResponse(4, [{ id: "a" }, { id: "c" }, { id: "d" }], [{ index: 1, message: "Invalid `to` field" }]), [
    { index: 0, ok: true, id: "a" },
    { index: 1, ok: false, error: "Invalid `to` field" },
    { index: 2, ok: true, id: "c" },
    { index: 3, ok: true, id: "d" },
  ]);
  const short = mapBatchResponse(2, [{ id: "a" }], undefined);
  assert.equal(short[1].ok, false);
});

test("missing-table detection (migration 062 not applied yet)", () => {
  assert.equal(isMissingTableError({ code: "PGRST205", message: "Could not find the table 'public.inactive_notice_log' in the schema cache" }), true);
  assert.equal(isMissingTableError({ code: "42P01", message: 'relation "public.inactive_notice_log" does not exist' }), true);
  assert.equal(isMissingTableError({ code: "42501", message: "permission denied for table inactive_notice_log" }), false);
  assert.equal(isMissingTableError(null), false);
});
