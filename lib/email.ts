import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Superteam Payments <onboarding@resend.dev>";

// Shared email styles
const emailFont = `'Georgia', 'Times New Roman', serif`;
const bodyFont = `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
const monoFont = `'Courier New', monospace`;

function emailShell(content: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:${bodyFont};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:48px 20px;">
    <tr>
      <td>
        <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;">
          ${content}
          <!-- Footer -->
          <tr>
            <td style="padding:28px 40px;border-top:1px solid #e5e5e5;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:11px;color:#999;letter-spacing:0.05em;text-transform:uppercase;">Superteam India</span>
                  </td>
                  <td style="text-align:right;">
                    <span style="font-size:11px;color:#bbb;">Automated notification — do not reply</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendFoundationEmail({
  batchId,
  reviewUrl,
  paymentCount,
  totalAmount,
  payments,
}: {
  batchId: string;
  reviewUrl: string;
  paymentCount: number;
  totalAmount: number;
  payments: Array<{ name: string; amount: string; wallet: string; purpose: string }>;
}) {
  const paymentRows = payments
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;">${p.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;font-weight:600;">${p.amount}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#888;font-family:${monoFont};">${p.wallet.slice(0, 8)}...${p.wallet.slice(-8)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666;max-width:180px;">${p.purpose.slice(0, 80)}${p.purpose.length > 80 ? "..." : ""}</td>
      </tr>`
    )
    .join("");

  const content = `
          <!-- Header -->
          <tr>
            <td style="background:#111;padding:36px 40px;">
              <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">Superteam India</div>
              <h1 style="margin:0 0 8px;color:#fff;font-family:${emailFont};font-size:26px;font-weight:400;line-height:1.3;letter-spacing:-0.01em;">Payment Batch for Review</h1>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">${batchId} &middot; ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 24px;border:1px solid #e5e5e5;width:50%;">
                    <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Total Payments</div>
                    <div style="font-size:28px;font-weight:700;color:#111;font-family:${emailFont};">${paymentCount}</div>
                  </td>
                  <td style="width:12px;"></td>
                  <td style="padding:20px 24px;border:1px solid #e5e5e5;width:50%;">
                    <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Total USDC</div>
                    <div style="font-size:28px;font-weight:700;color:#111;font-family:${emailFont};">$${totalAmount.toLocaleString()}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="color:#333;font-size:14px;line-height:1.7;">A new payment batch has been submitted for foundation review. Please review the individual payments and approve or reject each transaction.</p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background:#111;padding:14px 32px;">
                    <a href="${reviewUrl}" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Review Payments</a>
                  </td>
                </tr>
              </table>
              <p style="color:#bbb;font-size:11px;">This link expires in 7 days. If the button doesn't work, copy: <span style="color:#666;">${reviewUrl}</span></p>
            </td>
          </tr>

          <!-- Payment Table -->
          <tr>
            <td style="padding:24px 40px 0;">
              <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Payment Summary</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;">
                <thead>
                  <tr>
                    <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #e5e5e5;background:#fafafa;">Recipient</th>
                    <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #e5e5e5;background:#fafafa;">Amount</th>
                    <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #e5e5e5;background:#fafafa;">Wallet</th>
                    <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #e5e5e5;background:#fafafa;">Purpose</th>
                  </tr>
                </thead>
                <tbody>${paymentRows}</tbody>
              </table>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>`;

  await resend.emails.send({
    from: FROM,
    to: ["nidhiajain2003@gmail.com"],
    subject: `[Superteam] Payment Batch ${batchId} — ${paymentCount} payments for review`,
    html: emailShell(content),
  });
}

export async function sendRejectionEmail({
  recipientEmail,
  recipientName,
  amount,
  reason,
  projectName,
  batchId,
}: {
  recipientEmail: string;
  recipientName: string;
  amount: string;
  reason: string;
  projectName: string;
  batchId: string;
}) {
  const content = `
          <!-- Header -->
          <tr>
            <td style="background:#111;padding:36px 40px;">
              <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">Payment Update</div>
              <h1 style="margin:0 0 8px;color:#fff;font-family:${emailFont};font-size:24px;font-weight:400;line-height:1.3;">Payment requires correction</h1>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">Batch ${batchId}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="color:#333;font-size:14px;line-height:1.7;">Hi ${recipientName},</p>
              <p style="color:#333;font-size:14px;line-height:1.7;">The Solana Foundation has reviewed your payment for <strong>"${projectName}"</strong>. Unfortunately, it was not approved in this round.</p>
            </td>
          </tr>

          <!-- Rejection Box -->
          <tr>
            <td style="padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #111;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Reason</div>
                    <p style="margin:0;color:#111;font-size:14px;line-height:1.6;">${reason}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;">
                    <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;display:inline-block;width:100px;">Project</span>
                    <span style="font-size:13px;color:#111;font-weight:500;">${projectName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;display:inline-block;width:100px;">Amount</span>
                    <span style="font-size:13px;color:#111;font-weight:600;">${amount}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">Next Steps</div>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;">
                    <span style="font-size:12px;color:#999;font-family:${monoFont};">01</span>
                  </td>
                  <td style="padding:8px 0 8px 12px;font-size:14px;color:#333;">Review the rejection reason above</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;">
                    <span style="font-size:12px;color:#999;font-family:${monoFont};">02</span>
                  </td>
                  <td style="padding:8px 0 8px 12px;font-size:14px;color:#333;">Update your submission on Superteam Earn</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;">
                    <span style="font-size:12px;color:#999;font-family:${monoFont};">03</span>
                  </td>
                  <td style="padding:8px 0 8px 12px;font-size:14px;color:#333;">Contact your Superteam approver once corrected</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>`;

  await resend.emails.send({
    from: FROM,
    to: [recipientEmail],
    subject: `Action Required: Payment for "${projectName}" needs correction`,
    html: emailShell(content),
  });
}

export async function sendCorrectionRequestEmail({
  recipientName,
  projectName,
  flags,
}: {
  recipientEmail: string;
  recipientName: string;
  projectName: string;
  flags: Array<{ level: "hard" | "soft"; type: "name" | "wallet" | "amount" | "contractor"; message: string }>;
}) {
  const hasNameFlag = flags.some((f) => f.type === "name");

  // Determine subject + headline based on flag type
  const subject = hasNameFlag
    ? `Action Required: Update your name on Superteam Earn`
    : `Action Required: Update your wallet address on Superteam Earn`;

  const headline = hasNameFlag
    ? "Your name needs to be updated"
    : "Your wallet address needs to be updated";

  const intro = hasNameFlag
    ? `Your payment request for <strong>"${projectName}"</strong> was flagged because the name on your submission doesn't match the name previously associated with your wallet in our records.`
    : `Your payment request for <strong>"${projectName}"</strong> was flagged because the wallet address you submitted doesn't match what we have on record for your account.`;

  // Build step-by-step instructions
  const steps = hasNameFlag
    ? [
        `Go to your Superteam Earn profile: <a href="https://earn.superteam.fun/profile" style="color:#111;text-decoration:underline;">earn.superteam.fun/profile</a>`,
        `Update your display name to match the name you previously used for payments`,
        `Contact your Superteam approver and ask them to resubmit your payment`,
      ]
    : [
        `Log in to Superteam Earn: <a href="https://earn.superteam.fun/profile" style="color:#111;text-decoration:underline;">earn.superteam.fun/profile</a>`,
        `Go to your profile settings and update your wallet address`,
        `Make sure the new wallet address is the one you want payments sent to`,
        `Contact your Superteam approver and ask them to resubmit your payment`,
      ];

  const stepsHtml = steps
    .map(
      (step, i) => `
        <tr>
          <td style="padding:10px 0;vertical-align:top;width:28px;">
            <span style="font-size:12px;color:#999;font-family:${monoFont};font-weight:500;">${String(i + 1).padStart(2, "0")}</span>
          </td>
          <td style="padding:10px 0 10px 12px;font-size:14px;color:#333;line-height:1.6;">${step}</td>
        </tr>`
    )
    .join("");

  // Show the specific flag message(s) (name or wallet only — not amount)
  const relevantFlags = flags.filter((f) => f.type === "name" || f.type === "wallet");
  const flagRows = relevantFlags
    .map(
      (f) => `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${
              f.level === "hard" ? "#ef4444" : "#f59e0b"
            };flex-shrink:0;margin-top:5px;"></span>
            <span style="font-size:13px;color:#555;line-height:1.6;">${f.message}</span>
          </div>
        </td>
      </tr>`
    )
    .join("");

  const content = `
          <!-- Header -->
          <tr>
            <td style="background:#111;padding:36px 40px;">
              <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">Action Required</div>
              <h1 style="margin:0 0 8px;color:#fff;font-family:${emailFont};font-size:24px;font-weight:400;line-height:1.3;">${headline}</h1>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">${projectName}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="color:#333;font-size:14px;line-height:1.7;">Hi ${recipientName},</p>
              <p style="color:#333;font-size:14px;line-height:1.7;">${intro}</p>
            </td>
          </tr>

          ${relevantFlags.length > 0 ? `
          <!-- Issue detail -->
          <tr>
            <td style="padding:20px 40px 0;">
              <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">What was flagged</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;">
                ${flagRows}
              </table>
            </td>
          </tr>` : ""}

          <!-- Steps -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Steps to resolve</div>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${stepsHtml}
              </table>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>`;

  // Always redirect to test inbox in test environment
  await resend.emails.send({
    from: FROM,
    to: ["nidhiajain2003@gmail.com"],
    subject,
    html: emailShell(content),
  });
}

export async function sendAcceptanceEmail({
  recipientEmail,
  recipientName,
  amount,
  projectName,
  walletAddress,
  batchId,
}: {
  recipientEmail: string;
  recipientName: string;
  amount: string;
  projectName: string;
  walletAddress: string;
  batchId: string;
}) {
  const content = `
          <!-- Header -->
          <tr>
            <td style="background:#111;padding:36px 40px;">
              <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">Payment Approved</div>
              <h1 style="margin:0 0 8px;color:#fff;font-family:${emailFont};font-size:24px;font-weight:400;line-height:1.3;">Your payment has been approved</h1>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">Batch ${batchId}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="color:#333;font-size:14px;line-height:1.7;">Hi ${recipientName},</p>
              <p style="color:#333;font-size:14px;line-height:1.7;">The Solana Foundation has approved your payment for <strong>"${projectName}"</strong>. Funds will be transferred to your wallet shortly.</p>
            </td>
          </tr>

          <!-- Amount -->
          <tr>
            <td style="padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;">
                <tr>
                  <td style="padding:28px;text-align:center;">
                    <div style="font-size:36px;font-weight:700;color:#111;font-family:${emailFont};letter-spacing:-0.02em;">${amount}</div>
                    <div style="font-size:11px;color:#999;margin-top:6px;text-transform:uppercase;letter-spacing:0.08em;">USDC &middot; Approved</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;">
                    <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;display:inline-block;width:100px;">Project</span>
                    <span style="font-size:13px;color:#111;font-weight:500;">${projectName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;">
                    <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;display:inline-block;width:100px;">Amount</span>
                    <span style="font-size:13px;color:#111;font-weight:600;">${amount}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.06em;display:inline-block;width:100px;">Wallet</span>
                    <span style="font-size:12px;color:#111;font-family:${monoFont};">${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="color:#888;font-size:13px;line-height:1.6;">Please allow 1-3 business days for the transfer to appear in your wallet. For questions, contact your Superteam approver.</p>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>`;

  await resend.emails.send({
    from: FROM,
    to: [recipientEmail],
    subject: `Payment Approved: "${projectName}" — ${amount}`,
    html: emailShell(content),
  });
}
