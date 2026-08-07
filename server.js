require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const { adminEmail, userEmail } = require("./lib/emails");

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "stephen-backend", endpoint: "POST /api/contact" });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    contactInboxConfigured: Boolean(process.env.CONTACT_TO_EMAIL),
  });
});

app.post("/api/contact", async (req, res) => {
  // Recorded in the notification email so a bad submission can be traced;
  // nothing gates on it.
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

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

  const contact = {
    email: process.env.CONTACT_TO_EMAIL || "info@stephenstablecolorado.org",
    phone: process.env.CONTACT_PHONE || "(970) 555-0123",
  };

  const meta = {
    ip,
    submittedAt: new Date().toLocaleString("en-US", {
      timeZone: process.env.TIMEZONE || "America/Denver",
      dateStyle: "full",
      timeStyle: "short",
    }),
  };

  const fromName = process.env.MAIL_FROM_NAME || "Stephen's Table";
  const fromAddress = process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER;
  const from = `"${fromName}" <${fromAddress}>`;

  const toTeam = adminEmail(form, meta);
  const toUser = userEmail(form, contact);

  try {
    // The team notification is the one that must land — if it fails the
    // submission is lost, so it decides the response status.
    await getTransporter().sendMail({
      from,
      to: contact.email,
      // Hitting reply in the inbox answers the visitor, not the SMTP account.
      replyTo: `"${form.firstName} ${form.lastName}" <${form.email}>`,
      subject: toTeam.subject,
      text: toTeam.text,
      html: toTeam.html,
    });
  } catch (error) {
    console.error("Contact form — team notification failed:", error);
    return res.status(500).json({
      success: false,
      error: "We couldn't send your message right now. Please try again, or email us directly.",
    });
  }

  // The acknowledgement is a nicety. If it bounces (typo'd address, a
  // provider rejecting us) the message is already safely in the inbox, so
  // don't tell the visitor their submission failed.
  let acknowledged = true;
  try {
    await getTransporter().sendMail({
      from,
      to: form.email,
      replyTo: contact.email,
      subject: toUser.subject,
      text: toUser.text,
      html: toUser.html,
    });
  } catch (error) {
    acknowledged = false;
    console.error("Contact form — visitor acknowledgement failed:", error);
  }

  return res.json({
    success: true,
    acknowledged,
    message: "Thanks — your message has been sent. We'll be in touch soon.",
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
