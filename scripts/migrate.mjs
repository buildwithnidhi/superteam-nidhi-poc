import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false },
});

await conn.execute(`CREATE TABLE IF NOT EXISTS luma_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_api_id VARCHAR(255) UNIQUE,
  title VARCHAR(255),
  start_at DATETIME,
  end_at DATETIME,
  geo_city VARCHAR(100),
  geo_country VARCHAR(100),
  cover_url TEXT,
  url VARCHAR(255),
  geo_address_json JSON,
  creator_api_id VARCHAR(255),
  timezone VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`);

await conn.execute(`CREATE TABLE IF NOT EXISTS luma_hosts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_api_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  email VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

await conn.execute(`CREATE TABLE IF NOT EXISTS luma_guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_api_id VARCHAR(255),
  user_api_id VARCHAR(255),
  name VARCHAR(255),
  email VARCHAR(255),
  approval_status VARCHAR(50),
  registered_at DATETIME,
  checked_in_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_guest_event (event_api_id, user_api_id)
)`);

await conn.execute(`CREATE TABLE IF NOT EXISTS luma_event_hosts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_api_id VARCHAR(255),
  host_api_id VARCHAR(255),
  UNIQUE KEY unique_event_host (event_api_id, host_api_id)
)`);

await conn.execute(`CREATE TABLE IF NOT EXISTS luma_people (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_api_id VARCHAR(255) UNIQUE,
  email VARCHAR(255),
  user_name VARCHAR(255),
  avatar_url TEXT,
  event_approved_count INT DEFAULT 0,
  event_checked_in_count INT DEFAULT 0,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`);

await conn.execute(`CREATE TABLE IF NOT EXISTS luma_sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sync_type VARCHAR(50),
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  events_count INT,
  people_count INT,
  status VARCHAR(50)
)`);

console.log('All tables created successfully!');
await conn.end();
