import {
  mysqlTable,
  varchar,
  text,
  datetime,
  int,
  json,
  timestamp,
  primaryKey,
} from "drizzle-orm/mysql-core";

export const lumaEvents = mysqlTable("luma_events", {
  eventApiId: varchar("event_api_id", { length: 255 }).primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  startAt: datetime("start_at"),
  endAt: datetime("end_at"),
  geoCity: varchar("geo_city", { length: 255 }),
  geoCountry: varchar("geo_country", { length: 255 }),
  coverUrl: text("cover_url"),
  url: text("url"),
  geoAddressJson: json("geo_address_json"),
  creatorApiId: varchar("creator_api_id", { length: 255 }),
  timezone: varchar("timezone", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lumaPeople = mysqlTable("luma_people", {
  personApiId: varchar("person_api_id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }),
  userName: varchar("user_name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  eventApprovedCount: int("event_approved_count").default(0),
  eventCheckedInCount: int("event_checked_in_count").default(0),
  tags: json("tags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lumaGuests = mysqlTable(
  "luma_guests",
  {
    eventApiId: varchar("event_api_id", { length: 255 }).notNull(),
    userApiId: varchar("user_api_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    approvalStatus: varchar("approval_status", { length: 50 }),
    registeredAt: datetime("registered_at"),
    checkedInAt: datetime("checked_in_at"),
  },
  (table) => [
    primaryKey({ columns: [table.eventApiId, table.userApiId] }),
  ]
);

export const lumaHosts = mysqlTable("luma_hosts", {
  hostApiId: varchar("host_api_id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  avatarUrl: text("avatar_url"),
});

export const lumaEventHosts = mysqlTable(
  "luma_event_hosts",
  {
    eventApiId: varchar("event_api_id", { length: 255 }).notNull(),
    hostApiId: varchar("host_api_id", { length: 255 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventApiId, table.hostApiId] }),
  ]
);

export const lumaSyncLog = mysqlTable("luma_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  syncType: varchar("sync_type", { length: 50 }).notNull(),
  eventsCount: int("events_count").default(0),
  peopleCount: int("people_count").default(0),
  status: varchar("status", { length: 50 }).notNull(),
  syncedAt: timestamp("synced_at").defaultNow(),
});
