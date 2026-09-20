require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const {
  adminEmail,
  userEmail,
  nominationAdminEmail,
  nominationUserEmail,
} = require("./lib/emails");

const app = express();

/* ------------------------------------------------------------------ *
 * CORS
 *
 * ALLOWED_ORIGINS is a comma-separated allowlist. Leave it unset in
 * local dev and every origin is accepted; set it in production so the
 * endpoint can only be driven from the real site.
 * ------------------------------------------------------------------ */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header at all = curl / server-to-server / same-origin.
      if (!origin || allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed`));
    },
  })
);

app.use(express.json({ limit: "100kb" }));

/* ------------------------------------------------------------------ *
 * Mailer
 *
 * Explicit SMTP host/port rather than `service: "gmail"`, so the same
 * config works for Gmail, Zoho, Brevo, Mailgun, Resend SMTP, etc.
 * Created lazily: on Vercel a cold start with a bad/missing SMTP env
 * should return a JSON 500 from the route, not crash the function at
 * import time with an unhelpful stack.
 * ------------------------------------------------------------------ */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT || 587);

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/* ------------------------------------------------------------------ *
 * Site constants
 *
 * These are properties of the organisation, not of the environment —
 * they'd be identical in dev, staging and production, so they live here
 * rather than as env vars nobody would ever set differently.
 * ------------------------------------------------------------------ */
const ORG_NAME = "Stephen's Table";

// Printed in the visitor's confirmation email as "call us if it's urgent".
// TODO: this is the placeholder from the site footer — swap in the real number.
const ORG_PHONE = "(970) 555-0123";

// Colorado nonprofit, so submission timestamps are stamped in Mountain Time
// regardless of which region the function happens to run in.
const ORG_TIMEZONE = "America/Denver";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

/* ------------------------------------------------------------------ *
 * Shared submission plumbing
 *
 * The contact form and the nomination form differ only in what they
 * validate and what they put in the two emails — everything from "who
 * receives this" down to "a failed acknowledgement is not a failed
 * submission" is identical, so it lives here once.
 * ------------------------------------------------------------------ */

// Recorded in the notification email so a bad submission can be traced;
// nothing gates on it.
function clientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// Both forms land in the same inbox and quote the same phone number — the
// client asked for one address across the site, so there is no second env var.
function contactDetails() {
  return {
    email: process.env.CONTACT_TO_EMAIL || "info@stephenstablecolorado.org",
    phone: ORG_PHONE,
  };
}

function buildMeta(ip) {
  const now = new Date();
  return {
    ip,
    // Full stamp for the team notification...
    submittedAt: now.toLocaleString("en-US", {
      timeZone: ORG_TIMEZONE,
      dateStyle: "full",
      timeStyle: "short",
    }),
    // ...and the date alone for the visitor's "Submitted On" line, which
    // 847:17766 renders as "August 5, 2026".
    submittedDate: now.toLocaleDateString("en-US", {
      timeZone: ORG_TIMEZONE,
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

/**
 * Send the pair of emails a submission produces and answer the browser.
 *
 * `label` only ever appears in the server log. `senderName`/`senderEmail` are
 * the person who filled the form in — they become the reply-to on the team
 * notification and the recipient of the acknowledgement.
 */
async function deliver(res, { label, teamMail, visitorMail, senderName, senderEmail, inbox, successMessage, failureMessage }) {
  // Gmail rewrites the From header to the authenticated account anyway, so
  // there's nothing a separate MAIL_FROM_ADDRESS could usefully say.
  const from = `"${ORG_NAME}" <${process.env.SMTP_USER}>`;

  try {
    // The team notification is the one that must land — if it fails the
    // submission is lost, so it decides the response status.
    await getTransporter().sendMail({
      from,
      to: inbox,
      // Hitting reply in the inbox answers the visitor, not the SMTP account.
      replyTo: `"${senderName}" <${senderEmail}>`,
      subject: teamMail.subject,
      text: teamMail.text,
      html: teamMail.html,
    });
  } catch (error) {
    console.error(`${label} — team notification failed:`, error);
    return res.status(500).json({ success: false, error: failureMessage });
  }

  // The acknowledgement is a nicety. If it bounces (typo'd address, a
  // provider rejecting us) the message is already safely in the inbox, so
  // don't tell the visitor their submission failed.
  let acknowledged = true;
  try {
    await getTransporter().sendMail({
      from,
      to: senderEmail,
      replyTo: inbox,
      subject: visitorMail.subject,
      text: visitorMail.text,
      html: visitorMail.html,
    });
  } catch (error) {
    acknowledged = false;
    console.error(`${label} — visitor acknowledgement failed:`, error);
  }

  return res.json({ success: true, acknowledged, message: successMessage });
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "stephen-backend",
    endpoints: ["POST /api/contact", "POST /api/nominate"],
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    contactInboxConfigured: Boolean(process.env.CONTACT_TO_EMAIL),
  });
});

app.post("/api/contact", async (req, res) => {
  const ip = clientIp(req);

  // Honeypot: a field no human sees. Return 200 so bots don't learn.
  if (clean(req.body?.website, 200)) {
    return res.json({ success: true });
  }

  const form = {
    firstName: clean(req.body?.firstName, 100),
    lastName: clean(req.body?.lastName, 100),
    email: clean(req.body?.email, 200),
    reason: clean(req.body?.reason, 100),
    message: clean(req.body?.message, 5000),
    agree: req.body?.agree === true || req.body?.agree === "true",
  };

  const errors = [];
  if (!form.firstName) errors.push("First name is required.");
  if (!form.lastName) errors.push("Last name is required.");
  if (!EMAIL_RE.test(form.email)) errors.push("A valid email address is required.");
  if (!form.reason) errors.push("Please select a reason for contact.");
  if (!form.message) errors.push("Please write a message.");
  if (!form.agree) errors.push("Please agree to be contacted regarding your inquiry.");

  if (errors.length) {
    return res.status(400).json({ success: false, error: errors[0], errors });
  }

  const contact = contactDetails();
  const meta = buildMeta(ip);

  return deliver(res, {
    label: "Contact form",
    teamMail: adminEmail(form, meta),
    visitorMail: userEmail(form, contact, meta),
    senderName: `${form.firstName} ${form.lastName}`,
    senderEmail: form.email,
    inbox: contact.email,
    successMessage: "Thanks — your message has been sent. We'll be in touch soon.",
    failureMessage:
      "We couldn't send your message right now. Please try again, or email us directly.",
  });
});

/* ------------------------------------------------------------------ *
 * Nominate a senior
 *
 * Mirrors /api/contact — same inbox, same sending account, same two-mail
 * shape. The form is two steps in the UI but arrives as one payload, so
 * every field is validated together here.
 * ------------------------------------------------------------------ */
app.post("/api/nominate", async (req, res) => {
  const ip = clientIp(req);

  if (clean(req.body?.website, 200)) {
    return res.json({ success: true });
  }

  const form = {
    // Step 1 — the person submitting.
    firstName: clean(req.body?.firstName, 100),
    lastName: clean(req.body?.lastName, 100),
    email: clean(req.body?.email, 200),
    need: clean(req.body?.need, 5000),
    relationship: clean(req.body?.relationship, 100),
    // Step 2 — the senior being nominated.
    seniorName: clean(req.body?.seniorName, 200),
    age: clean(req.body?.age, 10),
    phone: clean(req.body?.phone, 40),
    seniorEmail: clean(req.body?.seniorEmail, 200),
    address: clean(req.body?.address, 300),
    city: clean(req.body?.city, 100),
    zip: clean(req.body?.zip, 20),
  };

  const errors = [];
  if (!form.firstName) errors.push("Your first name is required.");
  if (!form.lastName) errors.push("Your last name is required.");
  if (!EMAIL_RE.test(form.email)) errors.push("A valid email address is required.");
  if (!form.need) errors.push("Please tell us about the need.");
  if (!form.relationship) errors.push("Please tell us your relationship to the senior.");
  if (!form.seniorName) errors.push("The senior's full name is required.");
  if (!form.age) errors.push("The senior's age is required.");
  if (!form.phone) errors.push("A phone number for the senior is required.");
  // The form marks this one required, but a senior without email is exactly
  // the person this service exists for — so it is validated only if given,
  // and the phone number above is what the team actually calls on.
  if (form.seniorEmail && !EMAIL_RE.test(form.seniorEmail)) {
    errors.push("Please check the senior's email address.");
  }
  if (!form.address) errors.push("The senior's home address is required.");
  if (!form.city) errors.push("City is required.");
  if (!form.zip) errors.push("Zip code is required.");

  if (errors.length) {
    return res.status(400).json({ success: false, error: errors[0], errors });
  }

  const contact = contactDetails();
  const meta = buildMeta(ip);

  return deliver(res, {
    label: "Nomination form",
    teamMail: nominationAdminEmail(form, meta),
    visitorMail: nominationUserEmail(form, contact, meta),
    senderName: `${form.firstName} ${form.lastName}`,
    senderEmail: form.email,
    inbox: contact.email,
    successMessage: "Thanks — we've received the nomination and will be in touch soon.",
    failureMessage:
      "We couldn't submit this nomination right now. Please try again, or email us directly.",
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// CORS rejections arrive here as errors; answer in JSON rather than HTML.
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ success: false, error: error.message || "Server error" });
});

// Vercel imports this module and drives the exported handler itself; only
// listen when running locally (`npm run dev` / `npm start`).
if (!process.env.VERCEL) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`stephen-backend listening on http://localhost:${port}`));
}

module.exports = app;
