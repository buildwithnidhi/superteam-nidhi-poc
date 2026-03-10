import mysql from 'mysql2/promise';
import { Resend } from 'resend';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENTS = ['nidhiajain2003@gmail.com', 'pratik.dholani1@gmail.com'];

async function getDbPool() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false },
    connectionLimit: 3,
  });
}

async function fetchDigestData(pool) {
  // Overall stats
  const [[stats]] = await pool.execute(`
    SELECT
      COUNT(*) AS total,
      SUM(applicationStatus = 'approved') AS approved,
      SUM(CASE WHEN applicationStatus = 'approved' THEN COALESCE(approvedAmount, 0) ELSE 0 END) AS totalFunded,
      SUM(applicationStatus = 'pending') AS pending,
      SUM(applicationStatus = 'rejected') AS rejected
    FROM grass_fund
  `);

  // Chapter breakdown by country
  const [chapters] = await pool.execute(`
    SELECT
      user_location AS country,
      COUNT(*) AS appCount,
      SUM(CASE WHEN applicationStatus = 'approved' THEN COALESCE(approvedAmount, 0) ELSE 0 END) AS amountFunded,
      ROUND(100.0 * SUM(applicationStatus = 'approved') / COUNT(*), 1) AS approvalRate
    FROM grass_fund
    GROUP BY user_location
    ORDER BY appCount DESC
  `);

  // Pending applications (needs attention)
  const [pending] = await pool.execute(`
    SELECT project_title, grant_title, user_location, sponsor_name, project_one_liner, ask
    FROM grass_fund
    WHERE applicationStatus = 'pending'
    ORDER BY project_title
  `);

  // Last 5 approved
  const [recentApproved] = await pool.execute(`
    SELECT project_title, grant_title, user_location, sponsor_name, approvedAmount
    FROM grass_fund
    WHERE applicationStatus = 'approved'
    ORDER BY project_title DESC
    LIMIT 5
  `);

  return { stats, chapters, pending, recentApproved };
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return '$' + Number(amount).toLocaleString('en-US');
}

function buildEmailHtml({ stats, chapters, pending, recentApproved }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const chapterRows = chapters.map(c => `
    <tr>
      <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${c.country || 'Unknown'}</td>
      <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; text-align:center;">${c.appCount}</td>
      <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; text-align:right;">${formatCurrency(c.amountFunded)}</td>
      <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; text-align:center;">${c.approvalRate}%</td>
    </tr>
  `).join('');

  const pendingRows = pending.length === 0
    ? `<tr><td colspan="5" style="padding:14px; text-align:center; color:#6b7280;">No pending applications</td></tr>`
    : pending.map(p => `
      <tr>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${p.project_title || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${p.grant_title || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${p.user_location || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${p.sponsor_name || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; text-align:right;">${formatCurrency(p.ask)}</td>
      </tr>
    `).join('');

  const approvedRows = recentApproved.length === 0
    ? `<tr><td colspan="5" style="padding:14px; text-align:center; color:#6b7280;">No approved applications yet</td></tr>`
    : recentApproved.map(a => `
      <tr>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${a.project_title || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${a.grant_title || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${a.user_location || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${a.sponsor_name || '—'}</td>
        <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; text-align:right; color:#16a34a; font-weight:600;">${formatCurrency(a.approvedAmount)}</td>
      </tr>
    `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Grass Fund Weekly Digest</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%); padding:36px 40px; border-radius:12px 12px 0 0;">
              <h1 style="margin:0; color:#fff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">Grass Fund Weekly Digest</h1>
              <p style="margin:6px 0 0; color:#c4b5fd; font-size:14px;">${today}</p>
            </td>
          </tr>

          <!-- Overall Stats -->
          <tr>
            <td style="background:#fff; padding:32px 40px;">
              <h2 style="margin:0 0 20px; font-size:16px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Overview</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="25%" style="text-align:center; padding:16px 8px; background:#f9fafb; border-radius:8px; margin:4px;">
                    <div style="font-size:28px; font-weight:800; color:#7c3aed;">${stats.total}</div>
                    <div style="font-size:12px; color:#6b7280; margin-top:4px; font-weight:500;">Total Apps</div>
                  </td>
                  <td width="4%"></td>
                  <td width="25%" style="text-align:center; padding:16px 8px; background:#f0fdf4; border-radius:8px;">
                    <div style="font-size:28px; font-weight:800; color:#16a34a;">${stats.approved || 0}</div>
                    <div style="font-size:12px; color:#6b7280; margin-top:4px; font-weight:500;">Approved</div>
                    <div style="font-size:13px; color:#16a34a; font-weight:600; margin-top:2px;">${formatCurrency(stats.totalFunded)}</div>
                  </td>
                  <td width="4%"></td>
                  <td width="25%" style="text-align:center; padding:16px 8px; background:#fffbeb; border-radius:8px;">
                    <div style="font-size:28px; font-weight:800; color:#d97706;">${stats.pending || 0}</div>
                    <div style="font-size:12px; color:#6b7280; margin-top:4px; font-weight:500;">Pending</div>
                  </td>
                  <td width="4%"></td>
                  <td width="25%" style="text-align:center; padding:16px 8px; background:#fef2f2; border-radius:8px;">
                    <div style="font-size:28px; font-weight:800; color:#dc2626;">${stats.rejected || 0}</div>
                    <div style="font-size:12px; color:#6b7280; margin-top:4px; font-weight:500;">Rejected</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="background:#fff; padding:0 40px;"><hr style="border:none; border-top:1px solid #e5e7eb; margin:0;" /></td></tr>

          <!-- Chapter Breakdown -->
          <tr>
            <td style="background:#fff; padding:32px 40px;">
              <h2 style="margin:0 0 16px; font-size:16px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Chapter Breakdown</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Country</th>
                    <th style="padding:10px 14px; text-align:center; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Apps</th>
                    <th style="padding:10px 14px; text-align:right; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Funded</th>
                    <th style="padding:10px 14px; text-align:center; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Approval Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${chapterRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="background:#fff; padding:0 40px;"><hr style="border:none; border-top:1px solid #e5e7eb; margin:0;" /></td></tr>

          <!-- Needs Attention -->
          <tr>
            <td style="background:#fff; padding:32px 40px;">
              <h2 style="margin:0 0 6px; font-size:16px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">
                Needs Attention
                <span style="display:inline-block; background:#fef3c7; color:#92400e; font-size:12px; font-weight:700; padding:2px 8px; border-radius:999px; margin-left:8px; vertical-align:middle; text-transform:none; letter-spacing:0;">${pending.length} pending</span>
              </h2>
              <p style="margin:0 0 16px; font-size:13px; color:#6b7280;">Applications awaiting review</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; border-collapse:collapse;">
                <thead>
                  <tr style="background:#fffbeb;">
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Project</th>
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Grant</th>
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Location</th>
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Sponsor</th>
                    <th style="padding:10px 14px; text-align:right; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Ask</th>
                  </tr>
                </thead>
                <tbody>
                  ${pendingRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="background:#fff; padding:0 40px;"><hr style="border:none; border-top:1px solid #e5e7eb; margin:0;" /></td></tr>

          <!-- Recently Approved -->
          <tr>
            <td style="background:#fff; padding:32px 40px; border-radius:0 0 12px 12px;">
              <h2 style="margin:0 0 6px; font-size:16px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Recently Approved</h2>
              <p style="margin:0 0 16px; font-size:13px; color:#6b7280;">Last 5 approved applications</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; border-collapse:collapse;">
                <thead>
                  <tr style="background:#f0fdf4;">
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Project</th>
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Grant</th>
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Location</th>
                    <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Sponsor</th>
                    <th style="padding:10px 14px; text-align:right; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${approvedRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">This digest is sent every Monday at 9:00 AM · Superteam Grass Fund</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendDigest() {
  console.log(`[${new Date().toISOString()}] Running Grass Fund weekly digest...`);
  let pool;
  try {
    pool = await getDbPool();
    const data = await fetchDigestData(pool);
    const html = buildEmailHtml(data);

    const { data: result, error } = await resend.emails.send({
      from: 'Grass Fund Digest <onboarding@resend.dev>',
      to: RECIPIENTS,
      subject: `Grass Fund Weekly Digest — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
    } else {
      console.log('Digest sent successfully. ID:', result?.id);
    }
  } catch (err) {
    console.error('Failed to send digest:', err);
  } finally {
    if (pool) await pool.end();
  }
}

// Run immediately if called with --now flag
if (process.argv.includes('--now')) {
  await sendDigest();
  process.exit(0);
} else {
  // Schedule: every Monday at 9:00 AM UTC
  cron.schedule('0 9 * * 1', sendDigest, { timezone: 'UTC' });
  console.log('Grass Fund digest cron started. Runs every Monday at 09:00 UTC.');
}
