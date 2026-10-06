import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  lang: text("lang").notNull().default("en"),
  status: text("status").notNull().default("active"),
  paused: boolean("paused").notNull().default(false),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const seats = pgTable(
  "seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    slot: integer("slot").notNull(),
    ownerSeatId: uuid("owner_seat_id").references((): AnyPgColumn => seats.id),
    displayName: text("display_name"),
    agentName: text("agent_name"),
    agentModel: text("agent_model"),
    tokenHash: text("token_hash").unique(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    greetedAt: timestamp("greeted_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [unique("seats_room_kind_slot_uq").on(t.roomId, t.kind, t.slot)],
);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  humanSeatId: uuid("human_seat_id")
    .notNull()
    .references(() => seats.id),
  tokenHash: text("token_hash").unique().notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    seatId: uuid("seat_id").references(() => seats.id),
    kind: text("kind").notNull(),
    toSeatId: uuid("to_seat_id").references(() => seats.id),
    body: text("body").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_room_id_idx").on(t.roomId, t.id)],
);

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  agentSeatId: uuid("agent_seat_id")
    .notNull()
    .references(() => seats.id),
  ownerSeatId: uuid("owner_seat_id")
    .notNull()
    .references(() => seats.id),
  requestMessageId: bigint("request_message_id", { mode: "number" }).references(() => messages.id),
  task: text("task").notNull(),
  plan: text("plan"),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
