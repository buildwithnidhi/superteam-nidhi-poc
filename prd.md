# PRD: Superteam Events Dashboard (POC)

## Overview
A simple dashboard that pulls event data from Luma (via API key) and displays hosts/guests with filtering by date range and geography.

## Background
Superteam manages all events via Luma. They need visibility into attendee data across events without manually checking Luma.

## Goals
- Display unique hosts and guests across Luma events
- Filter by date range
- Filter by geography (country/city)
- Auto-refresh data every 2 days

## Out of Scope (POC)
- Authentication / multi-user access
- Export / reporting features
- Real-time sync
- Historical analytics beyond what Luma API provides

---

## Data Source
- **API**: Luma API (`LUMA_API_KEY`)
- **Key endpoint**: `GET /v1/calendar/list-people`
- **Staging integration**: `https://dev.forms.superteam.fun`

---

## Features

### 1. Events List
- Fetch all calendar events from Luma
- Show: event name, date, location

### 2. Hosts & Guests Table
- For selected event(s), show unique hosts and guests
- Columns: name, role (host/guest), email, location

### 3. Date Range Filter
- Date picker (start date → end date)
- Filters events shown and corresponding people data

### 4. Geography Filter
- Dropdown to filter by country or city
- Derived from attendee/event location data from Luma

### 5. Data Refresh
- Cache Luma API responses locally
- Refresh every 2 days (cron or on-demand button)

---

## Tech Stack (POC)
- **Frontend**: Next.js (already scaffolded)
- **Data fetching**: Server-side API routes calling Luma
- **Storage**: In-memory or local JSON cache (no DB for POC)
- **Styling**: Tailwind CSS

---

## API Notes
From Luma `/v1/calendar/list-people`, we can extract:
- Person name, email
- Role: host vs guest
- Event associations
- Location (if provided)

---

## Success Criteria
- Can view hosts and guests across events
- Date range filter works
- Geography filter works
- Data auto-refreshes every 2 days
