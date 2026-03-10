import mysql from 'mysql2/promise';
import { Resend } from 'resend';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENTS = ['nidhiajain2003@gmail.com'];

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
  const week = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const chapterRows = chapters.map(c => `
    <tr>
      <td>${c.country || 'Unknown'}</td>
      <td>${c.appCount}</td>
      <td>${formatCurrency(c.amountFunded)}</td>
      <td>${c.approvalRate}%</td>
    </tr>
  `).join('');

  const pendingRows = pending.length === 0
    ? `<tr><td colspan="3" style="padding:8px; color:#999;">No pending applications</td></tr>`
    : pending.map(p => `
      <tr>
        <td>${p.project_title || '—'}</td>
        <td>${p.user_location || '—'}</td>
        <td>${formatCurrency(p.ask)}</td>
      </tr>
    `).join('');

  const approvedRows = recentApproved.length === 0
    ? `<tr><td colspan="3" style="padding:8px; color:#999;">No approved applications yet</td></tr>`
    : recentApproved.map(a => `
      <tr>
        <td>${a.project_title || '—'}</td>
        <td>${a.user_location || '—'}</td>
        <td>${formatCurrency(a.approvedAmount)}</td>
      </tr>
    `).join('');

  const template = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Courier New', monospace; background: #f9f9f9; padding: 32px; color: #111; }
    .container { max-width: 600px; margin: 0 auto; background: white; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
    .header { background: #111; padding: 24px 32px; }
    .header h1 { color: #9cffa0; margin: 0; font-size: 20px; }
    .header p { color: #666; margin: 4px 0 0; font-size: 12px; }
    .section { padding: 24px 32px; border-bottom: 1px solid #f0f0f0; }
    .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin: 0 0 16px; }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .stat-label { color: #666; }
    .stat-value { font-weight: bold; color: #111; }
    .approved { color: #16a34a; }
    .rejected { color: #dc2626; }
    .pending { color: #d97706; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px; background: #f5f5f5; color: #666; font-size: 11px; text-transform: uppercase; }
    td { padding: 8px; border-bottom: 1px solid #f5f5f5; color: #333; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .tag-pending { background: #fef3c7; color: #d97706; }
    .tag-approved { background: #dcfce7; color: #16a34a; }
    .footer { padding: 16px 32px; background: #f9f9f9; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌿 Touching Grass Fund</h1>
      <p>Weekly Campaign Digest — {{week}}</p>
    </div>

    <div class="section">
      <h2>Overall</h2>
      <div class="stat-row"><span class="stat-label">Total Applications</span><span class="stat-value">{{total}}</span></div>
      <div class="stat-row"><span class="stat-label">Approved</span><span class="stat-value approved">{{approved}} — \${{totalFunded}} funded</span></div>
      <div class="stat-row"><span class="stat-label">Pending Review</span><span class="stat-value pending">{{pending}}</span></div>
      <div class="stat-row"><span class="stat-label">Rejected</span><span class="stat-value rejected">{{rejected}}</span></div>
    </div>

    <div class="section">
      <h2>Chapter Breakdown</h2>
      <table>
        <tr>
          <th>Chapter</th>
          <th>Apps</th>
          <th>Funded</th>
          <th>Approval</th>
        </tr>
        {{chapterRows}}
      </table>
    </div>

    <div class="section">
      <h2>⚠️ Needs Attention (Pending)</h2>
      <table>
        <tr>
          <th>Project</th>
          <th>Chapter</th>
          <th>Amount</th>
        </tr>
        {{pendingRows}}
      </table>
    </div>

    <div class="section">
      <h2>✅ Recently Approved</h2>
      <table>
        <tr>
          <th>Project</th>
          <th>Chapter</th>
          <th>Amount</th>
        </tr>
        {{approvedRows}}
      </table>
    </div>

    <div class="footer">
      Superteam Automation · Sent every Monday at 9am · Do not reply
    </div>
  </div>
</body>
</html>`;

  return template
    .replace('{{week}}', week)
    .replace('{{total}}', stats.total)
    .replace('{{approved}}', stats.approved || 0)
    .replace('{{totalFunded}}', Number(stats.totalFunded || 0).toLocaleString('en-US'))
    .replace('{{pending}}', stats.pending || 0)
    .replace('{{rejected}}', stats.rejected || 0)
    .replace('{{chapterRows}}', chapterRows)
    .replace('{{pendingRows}}', pendingRows)
    .replace('{{approvedRows}}', approvedRows);
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
