// Email templates for the contact form.
//
// Colours mirror the site's design tokens (src/index.css):
//   m-900 #260000 (footer maroon)   bl-600 #3e4f69 (headings)
//   cream #fffcf7 (page bg)         wb-100 #fbf6ee (soft band)
//   espresso #38291f (body copy)    gray-59 #595959 (muted)
//
// Inline styles only, and a table-based shell — that is what Gmail/Outlook
// actually render. No external CSS, no web fonts.

const BRAND = {
  maroon: "#260000",
  blue: "#3e4f69",
  cream: "#fffcf7",
  soft: "#fbf6ee",
  espresso: "#38291f",
  muted: "#595959",
  border: "#e3dbd0",
};

/**
 * Escape a user-supplied string before it goes into an HTML email body.
 * Submissions are attacker-controlled text; without this, a `<script>` or a
 * fake `</td><td>` in the message field rewrites the template.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped text with newlines preserved as <br> — for the free-text message. */
function escapeMultiline(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function shell({ heading, subheading, body, footerNote }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.cream};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;">
            <tr>
              <td style="background:${BRAND.maroon};padding:28px 32px;">
                <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.5px;">Stephen&#39;s Table</div>
                <div style="color:#e8d9d9;font-size:13px;padding-top:4px;font-family:Arial,Helvetica,sans-serif;">Helping seniors age safely, live with dignity</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 8px;font-size:20px;line-height:1.35;color:${BRAND.blue};">${heading}</h1>
                ${
                  subheading
                    ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${BRAND.muted};font-family:Arial,Helvetica,sans-serif;">${subheading}</p>`
                    : ""
                }
                ${body}
              </td>
            </tr>
            <tr>
              <td style="background:${BRAND.soft};padding:20px 32px;border-top:1px solid ${BRAND.border};">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};font-family:Arial,Helvetica,sans-serif;">${footerNote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};width:150px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.espresso};vertical-align:top;">${value}</td>
  </tr>`;
}

/** What lands in the team inbox. */
function adminEmail(form, meta) {
  const fullName = `${form.firstName} ${form.lastName}`.trim();

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("Name", escapeHtml(fullName))}
      ${row("Email", `<a href="mailto:${encodeURIComponent(form.email)}" style="color:${BRAND.blue};">${escapeHtml(form.email)}</a>`)}
      ${row("Reason for contact", escapeHtml(form.reason || "—"))}
      ${row("Consent to contact", form.agree ? "Yes" : "No")}
      ${row("Submitted", escapeHtml(meta.submittedAt))}
    </table>

    <div style="margin-top:24px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};margin-bottom:8px;">Message</div>
      <div style="background:${BRAND.soft};border-left:3px solid ${BRAND.blue};padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${BRAND.espresso};">${escapeMultiline(form.message)}</div>
    </div>

    <div style="margin-top:28px;">
      <a href="mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent("Re: your message to Stephen's Table")}"
         style="display:inline-block;background:${BRAND.blue};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;">Reply to ${escapeHtml(form.firstName || "sender")}</a>
    </div>`;

  return {
    subject: `New contact form message — ${fullName || form.email}${form.reason ? ` (${form.reason})` : ""}`,
    html: shell({
      heading: "New contact form submission",
      subheading: "Someone just filled in the contact form on stephenstablecolorado.org.",
      body,
      footerNote: `Sent automatically by the Stephen&#39;s Table website${meta.ip ? ` · IP ${escapeHtml(meta.ip)}` : ""}. Hit reply-to to answer the sender directly.`,
    }),
    text: [
      "New contact form submission",
      "",
      `Name:    ${fullName}`,
      `Email:   ${form.email}`,
      `Reason:  ${form.reason || "—"}`,
      `Consent: ${form.agree ? "Yes" : "No"}`,
      `Sent:    ${meta.submittedAt}`,
      "",
      "Message:",
      form.message,
    ].join("\n"),
  };
}

/** The acknowledgement the visitor gets back. */
function userEmail(form, contact) {
  const body = `
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.espresso};">
      Hi ${escapeHtml(form.firstName || "there")},
    </p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.espresso};">
      Thank you for reaching out to Stephen&#39;s Table. We&#39;ve received your message and a member
      of our team will get back to you shortly — usually within one to two business days.
    </p>
    <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.espresso};">
      Here&#39;s a copy of what you sent us:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("Reason for contact", escapeHtml(form.reason || "—"))}
    </table>

    <div style="margin-top:20px;background:${BRAND.soft};border-left:3px solid ${BRAND.blue};padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${BRAND.espresso};">${escapeMultiline(form.message)}</div>

    <p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.espresso};">
      If your matter is urgent, please call us at
      <a href="tel:${escapeHtml(contact.phone)}" style="color:${BRAND.blue};">${escapeHtml(contact.phone)}</a>.
    </p>
    <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.espresso};">
      Warmly,<br><strong>The Stephen&#39;s Table Team</strong>
    </p>`;

  return {
    subject: "We've received your message — Stephen's Table",
    html: shell({
      heading: "Thanks for getting in touch",
      subheading: null,
      body,
      footerNote: `This is an automated confirmation, but you can reply to it and it will reach us at ${escapeHtml(contact.email)}.`,
    }),
    text: [
      `Hi ${form.firstName || "there"},`,
      "",
      "Thank you for reaching out to Stephen's Table. We've received your message and a",
      "member of our team will get back to you shortly — usually within one to two",
      "business days.",
      "",
      "Here's a copy of what you sent us:",
      "",
      `Reason for contact: ${form.reason || "—"}`,
      "",
      form.message,
      "",
      `If your matter is urgent, please call us at ${contact.phone}.`,
      "",
      "Warmly,",
      "The Stephen's Table Team",
    ].join("\n"),
  };
}

module.exports = { adminEmail, userEmail, escapeHtml };
