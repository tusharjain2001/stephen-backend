// Email templates for the contact form.
//
// The visitor-facing confirmation implements Figma 847:17754 ("email response
// for contact us query"). The Reference ID line was dropped on request; every
// other element, colour, size and gap is the frame's.
//
// Inline styles and a table-based shell only — that is what Gmail/Outlook
// actually render. See DARK MODE below for why every colour is declared twice.

const BRAND = {
  cream: "#fffcf7", // 847:17754 card background
  maroon: "#990000", // 847:17760 title
  maroonDeep: "#660000", // 847:17767 closing note
  slate: "#3e4f69", // 847:17755 "Need Assistance?" block
  black: "#000000", // 847:17762 / 17763 / 17765 / 17766
  // 847:17764 is rgba(170,188,208,0.2) over the cream card. Flattened to a
  // solid hex on purpose: alpha compositing is unreliable in Outlook, and a
  // translucent panel is exactly what iOS dark mode washes out.
  //   0.2*170 + 0.8*255 = 238 | 0.2*188 + 0.8*252 = 239 | 0.2*208 + 0.8*247 = 239
  panel: "#eeefef",
  // Admin-email extras (no Figma frame — internal mail, kept utilitarian).
  blue: "#3e4f69",
  soft: "#fbf6ee",
  muted: "#595959",
  border: "#e3dbd0",
  espresso: "#38291f",
};

// Real fonts for clients that support @import (Apple Mail, iOS Mail); the
// stacks behind them carry everyone else. Playfair -> Georgia keeps the serif
// title serif; DM Sans -> Helvetica keeps the body geometric-ish.
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', Times, serif";
const SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

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

/* -------------------------------------------------------------------------
 * DARK MODE
 *
 * iOS Mail does not read an email's colours — absent any declaration it
 * decides the message is a light-mode document and re-tints it, which is what
 * turns #fffcf7 into a muddy grey and drags #990000 toward pink. That is the
 * "fading" this template has to survive.
 *
 * Three layers, because no single one covers every client:
 *
 *  1. `color-scheme: light dark` (meta + CSS). This is the actual opt-out —
 *     it tells WebKit "this message handles both schemes", so Apple/iOS Mail
 *     stops auto-inverting and renders what we wrote.
 *  2. A `prefers-color-scheme: dark` block that re-asserts every colour with
 *     `!important`. Belt and braces for clients that honour the media query
 *     but still nudge colours, and it wins over any injected override.
 *  3. `[data-ogsc]` / `[data-ogsb]` — Outlook.com rewrites inline styles onto
 *     these attributes in dark mode; without the duplicate rules its dark
 *     theme silently drops the panel background.
 *
 * Everything is also declared inline on the element itself, and every
 * background is set with BOTH a `bgcolor` attribute and CSS, because Outlook's
 * Word renderer ignores CSS backgrounds on table cells.
 * ---------------------------------------------------------------------- */
function emailDocument({ title, preheader, content }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;1,400&family=Playfair+Display:wght@500&display=swap');

  :root { color-scheme: light dark; supported-color-schemes: light dark; }

  body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  table { border-collapse: collapse; }
  a { color: inherit; }

  /* Declaring color-scheme makes the UA apply its DARK defaults in dark mode,
     so the inherited text colour on body/table/td flips to white — invisible
     against the cream card. Every <p> carries its own inline colour, but the
     containers must be pinned too, or any text a client reflows out of a <p>
     (and Outlook does) disappears. This is the actual "fading". */
  body, table, td, div, p, span, a { color: ${BRAND.black}; }

  /* Layer 2 — re-assert every colour so dark mode can't reinterpret them. */
  @media (prefers-color-scheme: dark) {
    body, table, td, div { color: ${BRAND.black} !important; }
    .st-page   { background-color: ${BRAND.cream} !important; }
    .st-card   { background-color: ${BRAND.cream} !important; }
    .st-panel  { background-color: ${BRAND.panel} !important; }
    .st-title  { color: ${BRAND.maroon} !important; }
    .st-note   { color: ${BRAND.maroonDeep} !important; }
    .st-assist, .st-assist a { color: ${BRAND.slate} !important; }
    .st-body   { color: ${BRAND.black} !important; }
  }

  /* Layer 3 — Outlook.com dark theme. */
  [data-ogsc] body, [data-ogsc] table, [data-ogsc] td, [data-ogsc] div { color: ${BRAND.black} !important; }
  [data-ogsc] .st-page,  [data-ogsb] .st-page  { background-color: ${BRAND.cream} !important; }
  [data-ogsc] .st-card,  [data-ogsb] .st-card  { background-color: ${BRAND.cream} !important; }
  [data-ogsc] .st-panel, [data-ogsb] .st-panel { background-color: ${BRAND.panel} !important; }
  [data-ogsc] .st-title  { color: ${BRAND.maroon} !important; }
  [data-ogsc] .st-note   { color: ${BRAND.maroonDeep} !important; }
  [data-ogsc] .st-assist, [data-ogsc] .st-assist a { color: ${BRAND.slate} !important; }
  [data-ogsc] .st-body   { color: ${BRAND.black} !important; }

  /* The frame is 810 wide with 41px gutters; 640 is the widest a mail client
     reliably shows without side-scrolling, so the gutters scale with it. */
  @media only screen and (max-width: 480px) {
    .st-pad    { padding-left: 24px !important; padding-right: 24px !important; }
    .st-top    { padding-top: 40px !important; }
    .st-title  { font-size: 28px !important; line-height: 37px !important; }
    .st-lead   { font-size: 20px !important; line-height: 26px !important; }
    .st-copy   { font-size: 17px !important; line-height: 23px !important; }
    .st-assist { font-size: 17px !important; line-height: 23px !important; }
  }
</style>
</head>
<body class="st-page" bgcolor="${BRAND.cream}" style="margin:0;padding:0;background-color:${BRAND.cream};color:${BRAND.black};">
  <!-- Inbox preview line. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>

  <table role="presentation" class="st-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.cream}" style="background-color:${BRAND.cream};">
    <tr>
      <td align="center" style="padding:16px 12px;">
        <table role="presentation" class="st-card" width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.cream}" style="width:640px;max-width:640px;background-color:${BRAND.cream};border-radius:16px;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* -------------------------------------------------------------------------
 * The visitor's confirmation — Figma 847:17754
 *
 * The frame is a 810 x 879 centred stack. Every gap below is the frame's:
 *   64 top -> title 36/48 -> 51 -> "We've received" 24/31 -> 23 -> copy 20/26
 *   -> 41 -> details panel (26 / 24 / 23 / 20 / 26) -> 41 -> note 16/21
 *   -> 106 -> "Need Assistance?" 20 italic -> 10 -> the address -> 30 bottom
 *
 * Text is centred throughout (the root frame carries `text-center`), and
 * `leading-[normal]` resolves to 1.3 for DM Sans and 1.33 for Playfair, which
 * is what makes the frame's block heights (48 / 31 / 156 / 42 / 26 / 52) come
 * out exactly.
 * ---------------------------------------------------------------------- */
function userEmail(form, contact, meta) {
  const mailto = `mailto:${contact.email}`;

  const content = `
    <tr>
      <td class="st-pad st-top" align="center" style="padding:64px 41px 0;">

        <!-- 847:17760 — Playfair Display Medium 36 / #990000, capitalize -->
        <p class="st-title" style="margin:0;font-family:${SERIF};font-weight:500;font-size:36px;line-height:48px;color:${BRAND.maroon};text-transform:capitalize;text-align:center;">
          Thank You for Reaching Out!
        </p>

        <!-- 51px gap (847:17759) -->
        <div style="height:51px;line-height:51px;font-size:0;">&nbsp;</div>

        <!-- 847:17762 — DM Sans Medium 24 -->
        <p class="st-body st-lead" style="margin:0;font-family:${SANS};font-weight:500;font-size:24px;line-height:31px;color:${BRAND.black};text-align:center;">
          We&#39;ve received your message.
        </p>

        <!-- 23px gap (847:17761) -->
        <div style="height:23px;line-height:23px;font-size:0;">&nbsp;</div>

        <!-- 847:17763 — DM Sans Regular 20, two paragraphs on a blank line -->
        <p class="st-body st-copy" style="margin:0 0 26px;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
          Thank you for contacting Stephen&#39;s Table Colorado. Your inquiry has been
          successfully submitted, and a member of our team will review it and get back
          to you as soon as possible.
        </p>
        <p class="st-body st-copy" style="margin:0;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
          Whether you&#39;re looking for support, interested in volunteering, exploring
          partnership opportunities, or simply have a question, we&#39;re here to help.
        </p>
      </td>
    </tr>

    <!-- 41px gap (847:17758) -->
    <tr><td style="height:41px;line-height:41px;font-size:0;">&nbsp;</td></tr>

    <!-- 847:17764 — the details panel -->
    <tr>
      <td class="st-pad" style="padding:0 41px;">
        <table role="presentation" class="st-panel" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.panel}" style="background-color:${BRAND.panel};border-radius:16px;">
          <tr>
            <td align="center" style="padding:26px 24px;">
              <!-- 847:17765 — DM Sans Medium 24 -->
              <p class="st-body st-lead" style="margin:0 0 23px;font-family:${SANS};font-weight:500;font-size:24px;line-height:31px;color:${BRAND.black};text-align:center;">
                Submission Details
              </p>
              <!-- 847:17766 — DM Sans Regular 20 -->
              <p class="st-body st-copy" style="margin:0;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
                Submitted On: ${escapeHtml(meta.submittedDate)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- 41px gap -->
    <tr><td style="height:41px;line-height:41px;font-size:0;">&nbsp;</td></tr>

    <!-- 847:17767 — DM Sans Medium 16 / #660000 -->
    <tr>
      <td class="st-pad" align="center" style="padding:0 41px;">
        <p class="st-note" style="margin:0;font-family:${SANS};font-weight:500;font-size:16px;line-height:21px;color:${BRAND.maroonDeep};text-align:center;">
          Our team will review your inquiry and respond using your preferred contact
          method. We appreciate your patience and look forward to connecting with you.
        </p>
      </td>
    </tr>

    <!-- 106px down to the footer block (591 -> 761 in the frame) -->
    <tr><td style="height:106px;line-height:106px;font-size:0;">&nbsp;</td></tr>

    <!-- 847:17755 — DM Sans Italic 20 / #3e4f69 -->
    <tr>
      <td class="st-pad" align="center" style="padding:0 41px 30px;">
        <p class="st-assist" style="margin:0 0 10px;font-family:${SANS};font-style:italic;font-weight:400;font-size:20px;line-height:26px;color:${BRAND.slate};text-align:center;">
          Need Assistance?
        </p>
        <p class="st-assist" style="margin:0;font-family:${SANS};font-style:italic;font-weight:400;font-size:20px;line-height:26px;color:${BRAND.slate};text-align:center;">
          If your request is urgent, please email us directly at
          <a href="${mailto}" style="color:${BRAND.slate};text-decoration:underline;">${escapeHtml(contact.email)}.</a>
        </p>
      </td>
    </tr>`;

  return {
    subject: "Thank You for Reaching Out! — Stephen's Table",
    html: emailDocument({
      title: "Thank You for Reaching Out!",
      preheader: "We've received your message and will get back to you as soon as possible.",
      content,
    }),
    text: [
      "THANK YOU FOR REACHING OUT!",
      "",
      "We've received your message.",
      "",
      "Thank you for contacting Stephen's Table Colorado. Your inquiry has been",
      "successfully submitted, and a member of our team will review it and get back",
      "to you as soon as possible.",
      "",
      "Whether you're looking for support, interested in volunteering, exploring",
      "partnership opportunities, or simply have a question, we're here to help.",
      "",
      "SUBMISSION DETAILS",
      `Submitted On: ${meta.submittedDate}`,
      "",
      "Our team will review your inquiry and respond using your preferred contact",
      "method. We appreciate your patience and look forward to connecting with you.",
      "",
      "Need Assistance?",
      `If your request is urgent, please email us directly at ${contact.email}.`,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------
 * The team notification — no Figma frame, this one is internal. Kept dense
 * and scannable rather than designed, but it rides the same dark-mode shell.
 * ---------------------------------------------------------------------- */
function row(label, value) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-family:${SANS};font-size:13px;color:${BRAND.muted};width:150px;vertical-align:top;">${escapeHtml(label)}</td>
    <td class="st-body" style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-family:${SANS};font-size:14px;color:${BRAND.espresso};vertical-align:top;">${value}</td>
  </tr>`;
}

function adminEmail(form, meta) {
  const fullName = `${form.firstName} ${form.lastName}`.trim();

  const content = `
    <tr>
      <td bgcolor="#260000" style="background-color:#260000;padding:28px 32px;border-radius:16px 16px 0 0;">
        <div style="color:#ffffff;font-family:${SERIF};font-size:22px;font-weight:500;">Stephen&#39;s Table</div>
        <div style="color:#e8d9d9;font-family:${SANS};font-size:13px;padding-top:4px;">New contact form submission</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 class="st-title" style="margin:0 0 8px;font-family:${SERIF};font-size:20px;line-height:1.35;color:${BRAND.blue};">New contact form submission</h1>
        <p style="margin:0 0 24px;font-family:${SANS};font-size:14px;line-height:1.6;color:${BRAND.muted};">Someone just filled in the contact form on the website.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${row("Name", escapeHtml(fullName))}
          ${row("Email", `<a href="mailto:${encodeURIComponent(form.email)}" style="color:${BRAND.blue};">${escapeHtml(form.email)}</a>`)}
          ${row("Reason for contact", escapeHtml(form.reason || "—"))}
          ${row("Consent to contact", form.agree ? "Yes" : "No")}
          ${row("Submitted", escapeHtml(meta.submittedAt))}
        </table>

        <div style="margin-top:24px;">
          <div style="font-family:${SANS};font-size:13px;color:${BRAND.muted};margin-bottom:8px;">Message</div>
          <div class="st-panel" bgcolor="${BRAND.soft}" style="background-color:${BRAND.soft};border-left:3px solid ${BRAND.blue};padding:16px 18px;font-family:${SANS};font-size:14px;line-height:1.7;color:${BRAND.espresso};">${escapeMultiline(form.message)}</div>
        </div>

        <div style="margin-top:28px;">
          <a href="mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent("Re: your message to Stephen's Table")}"
             style="display:inline-block;background:${BRAND.blue};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-family:${SANS};font-size:14px;font-weight:bold;">Reply to ${escapeHtml(form.firstName || "sender")}</a>
        </div>
      </td>
    </tr>
    <tr>
      <td class="st-panel" bgcolor="${BRAND.soft}" style="background-color:${BRAND.soft};padding:20px 32px;border-top:1px solid ${BRAND.border};border-radius:0 0 16px 16px;">
        <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${BRAND.muted};">Sent automatically by the Stephen&#39;s Table website${meta.ip ? ` &middot; IP ${escapeHtml(meta.ip)}` : ""}. Hit reply to answer the sender directly.</p>
      </td>
    </tr>`;

  return {
    subject: `New contact form message — ${fullName || form.email}${form.reason ? ` (${form.reason})` : ""}`,
    html: emailDocument({
      title: "New contact form submission",
      preheader: `${fullName} — ${form.reason || "no reason given"}`,
      content,
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


/* -------------------------------------------------------------------------
 * NOMINATE A SENIOR
 *
 * Same two-mail shape as the contact form: a notification to the team inbox
 * and an acknowledgement to whoever submitted the nomination.
 *
 * Both ride `emailDocument`, so the dark-mode handling and the Figma-derived
 * shell above apply unchanged. There is no separate frame for these, and a
 * second visual language for the same site's mail would be worse than reusing
 * the one that was designed.
 *
 * On who gets the acknowledgement: the NOMINATOR, never the senior. The
 * senior has not filled anything in and has not agreed to be emailed — the
 * team reaches out to them itself, off the details below.
 * ---------------------------------------------------------------------- */
function nominationUserEmail(form, contact, meta) {
  const mailto = `mailto:${contact.email}`;
  const seniorName = form.seniorName || "the senior you told us about";

  const content = `
    <tr>
      <td class="st-pad st-top" align="center" style="padding:64px 41px 0;">

        <p class="st-title" style="margin:0;font-family:${SERIF};font-weight:500;font-size:36px;line-height:48px;color:${BRAND.maroon};text-transform:capitalize;text-align:center;">
          Thank You for Your Nomination!
        </p>

        <div style="height:51px;line-height:51px;font-size:0;">&nbsp;</div>

        <p class="st-body st-lead" style="margin:0;font-family:${SANS};font-weight:500;font-size:24px;line-height:31px;color:${BRAND.black};text-align:center;">
          We&#39;ve received your nomination.
        </p>

        <div style="height:23px;line-height:23px;font-size:0;">&nbsp;</div>

        <p class="st-body st-copy" style="margin:0 0 26px;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
          Thank you for nominating someone to Stephen&#39;s Table Colorado. Our team will
          review the details you shared and reach out directly to see how we can best
          support them.
        </p>
        <p class="st-body st-copy" style="margin:0;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
          Looking out for a neighbour, a friend or a family member is how most of the
          seniors we serve first find us. We&#39;re grateful you took the time.
        </p>
      </td>
    </tr>

    <tr><td style="height:41px;line-height:41px;font-size:0;">&nbsp;</td></tr>

    <tr>
      <td class="st-pad" style="padding:0 41px;">
        <table role="presentation" class="st-panel" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.panel}" style="background-color:${BRAND.panel};border-radius:16px;">
          <tr>
            <td align="center" style="padding:26px 24px;">
              <p class="st-body st-lead" style="margin:0 0 23px;font-family:${SANS};font-weight:500;font-size:24px;line-height:31px;color:${BRAND.black};text-align:center;">
                Submission Details
              </p>
              <p class="st-body st-copy" style="margin:0 0 8px;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
                Senior Nominated: ${escapeHtml(seniorName)}
              </p>
              <p class="st-body st-copy" style="margin:0;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
                Submitted On: ${escapeHtml(meta.submittedDate)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr><td style="height:41px;line-height:41px;font-size:0;">&nbsp;</td></tr>

    <tr>
      <td class="st-pad" align="center" style="padding:0 41px;">
        <p class="st-note" style="margin:0;font-family:${SANS};font-weight:500;font-size:16px;line-height:21px;color:${BRAND.maroonDeep};text-align:center;">
          A member of our team will review this nomination and make contact to confirm
          the next steps. We appreciate your patience while we do.
        </p>
      </td>
    </tr>

    <tr><td style="height:106px;line-height:106px;font-size:0;">&nbsp;</td></tr>

    <tr>
      <td class="st-pad" align="center" style="padding:0 41px 30px;">
        <p class="st-assist" style="margin:0 0 10px;font-family:${SANS};font-style:italic;font-weight:400;font-size:20px;line-height:26px;color:${BRAND.slate};text-align:center;">
          Need Assistance?
        </p>
        <p class="st-assist" style="margin:0;font-family:${SANS};font-style:italic;font-weight:400;font-size:20px;line-height:26px;color:${BRAND.slate};text-align:center;">
          If this nomination is urgent, please email us directly at
          <a href="${mailto}" style="color:${BRAND.slate};text-decoration:underline;">${escapeHtml(contact.email)}.</a>
        </p>
      </td>
    </tr>`;

  return {
    subject: "Thank You for Your Nomination! — Stephen's Table",
    html: emailDocument({
      title: "Thank You for Your Nomination!",
      preheader: "We've received your nomination and will reach out shortly.",
      content,
    }),
    text: [
      "THANK YOU FOR YOUR NOMINATION!",
      "",
      "We've received your nomination.",
      "",
      "Thank you for nominating someone to Stephen's Table Colorado. Our team will",
      "review the details you shared and reach out directly to see how we can best",
      "support them.",
      "",
      "Looking out for a neighbour, a friend or a family member is how most of the",
      "seniors we serve first find us. We're grateful you took the time.",
      "",
      "SUBMISSION DETAILS",
      `Senior Nominated: ${seniorName}`,
      `Submitted On: ${meta.submittedDate}`,
      "",
      "A member of our team will review this nomination and make contact to confirm",
      "the next steps. We appreciate your patience while we do.",
      "",
      "Need Assistance?",
      `If this nomination is urgent, please email us directly at ${contact.email}.`,
    ].join("\n"),
  };
}

/**
 * The team notification. Two labelled blocks rather than one flat list,
 * because the form itself is two steps and the split matters on the call that
 * follows: everything under "Nominated by" is the person who submitted, and
 * everything under "Senior's details" is the person to actually contact.
 */
function nominationAdminEmail(form, meta) {
  const nominator = `${form.firstName} ${form.lastName}`.trim();
  const fullAddress = [form.address, form.city, form.zip].filter(Boolean).join(", ");

  const heading = (text) =>
    `<div style="font-family:${SANS};font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.blue};margin:28px 0 6px;">${escapeHtml(text)}</div>`;

  const content = `
    <tr>
      <td bgcolor="#260000" style="background-color:#260000;padding:28px 32px;border-radius:16px 16px 0 0;">
        <div style="color:#ffffff;font-family:${SERIF};font-size:22px;font-weight:500;">Stephen&#39;s Table</div>
        <div style="color:#e8d9d9;font-family:${SANS};font-size:13px;padding-top:4px;">New senior nomination</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 class="st-title" style="margin:0 0 8px;font-family:${SERIF};font-size:20px;line-height:1.35;color:${BRAND.blue};">New senior nomination</h1>
        <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${BRAND.muted};">Someone has nominated a senior through the website. Reach the senior on the details below; hitting reply answers the nominator.</p>

        ${heading("Nominated by")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${row("Name", escapeHtml(nominator))}
          ${row("Email", `<a href="mailto:${encodeURIComponent(form.email)}" style="color:${BRAND.blue};">${escapeHtml(form.email)}</a>`)}
          ${row("Relationship", escapeHtml(form.relationship || "—"))}
        </table>

        ${heading("Senior's details")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${row("Full name", escapeHtml(form.seniorName))}
          ${row("Age", escapeHtml(form.age || "—"))}
          ${row("Phone", form.phone ? `<a href="tel:${encodeURIComponent(form.phone)}" style="color:${BRAND.blue};">${escapeHtml(form.phone)}</a>` : "—")}
          ${row("Email", form.seniorEmail ? `<a href="mailto:${encodeURIComponent(form.seniorEmail)}" style="color:${BRAND.blue};">${escapeHtml(form.seniorEmail)}</a>` : "—")}
          ${row("Address", escapeHtml(fullAddress || "—"))}
          ${row("Submitted", escapeHtml(meta.submittedAt))}
        </table>

        <div style="margin-top:24px;">
          <div style="font-family:${SANS};font-size:13px;color:${BRAND.muted};margin-bottom:8px;">The need</div>
          <div class="st-panel" bgcolor="${BRAND.soft}" style="background-color:${BRAND.soft};border-left:3px solid ${BRAND.blue};padding:16px 18px;font-family:${SANS};font-size:14px;line-height:1.7;color:${BRAND.espresso};">${escapeMultiline(form.need)}</div>
        </div>

        <div style="margin-top:28px;">
          <a href="mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent(`Re: your nomination of ${form.seniorName}`)}"
             style="display:inline-block;background:${BRAND.blue};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-family:${SANS};font-size:14px;font-weight:bold;">Reply to ${escapeHtml(form.firstName || "nominator")}</a>
        </div>
      </td>
    </tr>
    <tr>
      <td class="st-panel" bgcolor="${BRAND.soft}" style="background-color:${BRAND.soft};padding:20px 32px;border-top:1px solid ${BRAND.border};border-radius:0 0 16px 16px;">
        <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${BRAND.muted};">Sent automatically by the Stephen&#39;s Table website${meta.ip ? ` &middot; IP ${escapeHtml(meta.ip)}` : ""}. Hit reply to answer the nominator directly.</p>
      </td>
    </tr>`;

  return {
    subject: `New senior nomination — ${form.seniorName || "unnamed"} (via ${nominator || form.email})`,
    html: emailDocument({
      title: "New senior nomination",
      preheader: `${form.seniorName} — nominated by ${nominator}`,
      content,
    }),
    text: [
      "New senior nomination",
      "",
      "NOMINATED BY",
      `Name:         ${nominator}`,
      `Email:        ${form.email}`,
      `Relationship: ${form.relationship || "—"}`,
      "",
      "SENIOR'S DETAILS",
      `Full name: ${form.seniorName}`,
      `Age:       ${form.age || "—"}`,
      `Phone:     ${form.phone || "—"}`,
      `Email:     ${form.seniorEmail || "—"}`,
      `Address:   ${fullAddress || "—"}`,
      `Sent:      ${meta.submittedAt}`,
      "",
      "The need:",
      form.need,
    ].join("\n"),
  };
}

/* -------------------------------------------------------------------------
 * VOLUNTEER SIGN-UP
 *
 * Same two-mail shape again: a notification to the team inbox and a
 * confirmation to the volunteer. The form copies the client's reference
 * (contact name, email, phone, a stay-in-touch opt-in, full postal address),
 * so the team mail lays those out in the order the form asks for them.
 * ---------------------------------------------------------------------- */
function volunteerAddressLines(form) {
  const cityLine = [form.city, [form.state, form.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [form.address, form.address2, cityLine, form.country].filter(Boolean);
}

function volunteerUserEmail(form, contact, meta) {
  const mailto = `mailto:${contact.email}`;

  const content = `
    <tr>
      <td class="st-pad st-top" align="center" style="padding:64px 41px 0;">

        <p class="st-title" style="margin:0;font-family:${SERIF};font-weight:500;font-size:36px;line-height:48px;color:${BRAND.maroon};text-transform:capitalize;text-align:center;">
          Thank You for Signing Up to Volunteer!
        </p>

        <div style="height:51px;line-height:51px;font-size:0;">&nbsp;</div>

        <p class="st-body st-lead" style="margin:0;font-family:${SANS};font-weight:500;font-size:24px;line-height:31px;color:${BRAND.black};text-align:center;">
          We&#39;ve received your volunteer sign-up.
        </p>

        <div style="height:23px;line-height:23px;font-size:0;">&nbsp;</div>

        <p class="st-body st-copy" style="margin:0 0 26px;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
          Thank you for offering your time to Stephen&#39;s Table Colorado. A member of our
          team will be in touch soon to talk about volunteer opportunities and next steps.
        </p>
        <p class="st-body st-copy" style="margin:0;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
          Whether it&#39;s practical help at home, companionship or community events, our
          volunteers are what make it possible for seniors to age safely and feel a true
          sense of belonging.
        </p>
      </td>
    </tr>

    <tr><td style="height:41px;line-height:41px;font-size:0;">&nbsp;</td></tr>

    <tr>
      <td class="st-pad" style="padding:0 41px;">
        <table role="presentation" class="st-panel" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.panel}" style="background-color:${BRAND.panel};border-radius:16px;">
          <tr>
            <td align="center" style="padding:26px 24px;">
              <p class="st-body st-lead" style="margin:0 0 23px;font-family:${SANS};font-weight:500;font-size:24px;line-height:31px;color:${BRAND.black};text-align:center;">
                Submission Details
              </p>
              <p class="st-body st-copy" style="margin:0;font-family:${SANS};font-weight:400;font-size:20px;line-height:26px;color:${BRAND.black};text-align:center;">
                Submitted On: ${escapeHtml(meta.submittedDate)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr><td style="height:41px;line-height:41px;font-size:0;">&nbsp;</td></tr>

    <tr>
      <td class="st-pad" align="center" style="padding:0 41px;">
        <p class="st-note" style="margin:0;font-family:${SANS};font-weight:500;font-size:16px;line-height:21px;color:${BRAND.maroonDeep};text-align:center;">
          We&#39;ll reach out by email or phone using the details you gave us. We
          appreciate your patience and look forward to welcoming you.
        </p>
      </td>
    </tr>

    <tr><td style="height:106px;line-height:106px;font-size:0;">&nbsp;</td></tr>

    <tr>
      <td class="st-pad" align="center" style="padding:0 41px 30px;">
        <p class="st-assist" style="margin:0 0 10px;font-family:${SANS};font-style:italic;font-weight:400;font-size:20px;line-height:26px;color:${BRAND.slate};text-align:center;">
          Have a Question?
        </p>
        <p class="st-assist" style="margin:0;font-family:${SANS};font-style:italic;font-weight:400;font-size:20px;line-height:26px;color:${BRAND.slate};text-align:center;">
          You can email us anytime at
          <a href="${mailto}" style="color:${BRAND.slate};text-decoration:underline;">${escapeHtml(contact.email)}.</a>
        </p>
      </td>
    </tr>`;

  return {
    subject: "Thank You for Signing Up to Volunteer! — Stephen's Table",
    html: emailDocument({
      title: "Thank You for Signing Up to Volunteer!",
      preheader: "We've received your volunteer sign-up and will be in touch soon.",
      content,
    }),
    text: [
      "THANK YOU FOR SIGNING UP TO VOLUNTEER!",
      "",
      "We've received your volunteer sign-up.",
      "",
      "Thank you for offering your time to Stephen's Table Colorado. A member of our",
      "team will be in touch soon to talk about volunteer opportunities and next steps.",
      "",
      "Whether it's practical help at home, companionship or community events, our",
      "volunteers are what make it possible for seniors to age safely and feel a true",
      "sense of belonging.",
      "",
      "SUBMISSION DETAILS",
      `Submitted On: ${meta.submittedDate}`,
      "",
      "We'll reach out by email or phone using the details you gave us. We",
      "appreciate your patience and look forward to welcoming you.",
      "",
      "Have a Question?",
      `You can email us anytime at ${contact.email}.`,
    ].join("\n"),
  };
}

function volunteerAdminEmail(form, meta) {
  const fullName = `${form.firstName} ${form.lastName}`.trim();
  const addressLines = volunteerAddressLines(form);
  const stayInTouch = form.stayInTouch ? "Yes — I'm in!" : "No thanks";

  const content = `
    <tr>
      <td bgcolor="#260000" style="background-color:#260000;padding:28px 32px;border-radius:16px 16px 0 0;">
        <div style="color:#ffffff;font-family:${SERIF};font-size:22px;font-weight:500;">Stephen&#39;s Table</div>
        <div style="color:#e8d9d9;font-family:${SANS};font-size:13px;padding-top:4px;">New volunteer sign-up</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 class="st-title" style="margin:0 0 8px;font-family:${SERIF};font-size:20px;line-height:1.35;color:${BRAND.blue};">New volunteer sign-up</h1>
        <p style="margin:0 0 24px;font-family:${SANS};font-size:14px;line-height:1.6;color:${BRAND.muted};">Someone just signed up to volunteer on the website.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${row("Name", escapeHtml(fullName))}
          ${row("Email", `<a href="mailto:${encodeURIComponent(form.email)}" style="color:${BRAND.blue};">${escapeHtml(form.email)}</a>`)}
          ${row("Phone", `<a href="tel:${encodeURIComponent(form.phone)}" style="color:${BRAND.blue};">${escapeHtml(form.phone)}</a>`)}
          ${row("Address", addressLines.map(escapeHtml).join("<br>") || "—")}
          ${row("Stay in touch (news & events)", stayInTouch)}
          ${row("Submitted", escapeHtml(meta.submittedAt))}
        </table>

        <div style="margin-top:28px;">
          <a href="mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent("Volunteering with Stephen's Table")}"
             style="display:inline-block;background:${BRAND.blue};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-family:${SANS};font-size:14px;font-weight:bold;">Reply to ${escapeHtml(form.firstName || "volunteer")}</a>
        </div>
      </td>
    </tr>
    <tr>
      <td class="st-panel" bgcolor="${BRAND.soft}" style="background-color:${BRAND.soft};padding:20px 32px;border-top:1px solid ${BRAND.border};border-radius:0 0 16px 16px;">
        <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${BRAND.muted};">Sent automatically by the Stephen&#39;s Table website${meta.ip ? ` &middot; IP ${escapeHtml(meta.ip)}` : ""}. Hit reply to answer the volunteer directly.</p>
      </td>
    </tr>`;

  return {
    subject: `New volunteer sign-up — ${fullName || form.email}`,
    html: emailDocument({
      title: "New volunteer sign-up",
      preheader: `${fullName} — ${form.email}`,
      content,
    }),
    text: [
      "New volunteer sign-up",
      "",
      `Name:          ${fullName}`,
      `Email:         ${form.email}`,
      `Phone:         ${form.phone}`,
      `Address:       ${addressLines.join(", ") || "—"}`,
      `Stay in touch: ${stayInTouch}`,
      `Sent:          ${meta.submittedAt}`,
    ].join("\n"),
  };
}

module.exports = {
  adminEmail,
  userEmail,
  nominationAdminEmail,
  nominationUserEmail,
  volunteerAdminEmail,
  volunteerUserEmail,
  escapeHtml,
};
