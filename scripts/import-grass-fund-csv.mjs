import mysql from 'mysql2/promise';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/import-grass-fund-csv.mjs <path-to-csv>');
  process.exit(1);
}

const pool = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false },
  connectionLimit: 3,
});

const content = fs.readFileSync(path.resolve(csvPath), 'utf8');

const records = await new Promise((resolve, reject) => {
  parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

console.log(`Parsed ${records.length} rows. Importing into grass_fund...`);

let inserted = 0;
let skipped = 0;
let errors = 0;

for (const row of records) {
  try {
    const [result] = await pool.execute(
      `INSERT IGNORE INTO grass_fund
         (project_title, grant_title, user_location, sponsor_name, project_one_liner, ask, approvedAmount, applicationStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.project_title     || null,
        row.grant_title       || null,
        row.user_location     || null,
        row.sponsor_name      || null,
        row.project_one_liner || null,
        row.ask            ? Number(row.ask)            : null,
        row.approvedAmount ? Number(row.approvedAmount) : null,
        row.applicationStatus || null,
      ]
    );

    if (result.affectedRows === 1) inserted++;
    else skipped++;
  } catch (err) {
    console.error(`  Error on row "${row.project_title}":`, err.message);
    errors++;
  }
}

await pool.end();

console.log(`\nDone.`);
console.log(`  Inserted : ${inserted}`);
console.log(`  Skipped  : ${skipped} (already exist)`);
console.log(`  Errors   : ${errors}`);
