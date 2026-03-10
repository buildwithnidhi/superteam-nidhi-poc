import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const pool = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false },
  connectionLimit: 3,
});

// Create table if it doesn't exist
console.log('Creating grass_fund table if not exists...');
await pool.execute(`
  CREATE TABLE IF NOT EXISTS grass_fund (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    project_title    TEXT,
    grant_title      TEXT,
    user_location    VARCHAR(255),
    sponsor_name     VARCHAR(255),
    project_one_liner TEXT,
    ask              DECIMAL(10,2),
    approvedAmount   DECIMAL(10,2),
    applicationStatus VARCHAR(50),
    UNIQUE KEY uq_project_grant (project_title(255), grant_title(255))
  )
`);
console.log('  Done.');

// Add auto-increment primary key if it doesn't exist (for pre-existing tables)
const [[idCol]] = await pool.execute(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'grass_fund' AND COLUMN_NAME = 'id'
`, [process.env.DB_NAME]);

if (!idCol) {
  console.log('Adding auto-increment id column...');
  await pool.execute(`ALTER TABLE grass_fund ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST`);
  console.log('  Done.');
} else {
  console.log('id column already exists, skipping.');
}

// Add unique key on (project_title, grant_title) if it doesn't exist
const [[uniqueKey]] = await pool.execute(`
  SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'grass_fund' AND INDEX_NAME = 'uq_project_grant'
`, [process.env.DB_NAME]);

if (!uniqueKey) {
  console.log('Adding unique key on (project_title, grant_title)...');
  await pool.execute(`ALTER TABLE grass_fund ADD UNIQUE KEY uq_project_grant (project_title(255), grant_title(255))`);
  console.log('  Done.');
} else {
  console.log('Unique key already exists, skipping.');
}

await pool.end();
console.log('\nMigration complete.');
