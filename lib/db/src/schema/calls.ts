import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { proceduresTable } from "./procedures";

export const callTypeEnum = ["pre_op_history", "pre_op_instructions", "post_op_24h", "post_op_72h", "post_op_2wk"] as const;
export const callStatusEnum = ["pending", "in_progress", "completed", "failed", "no_answer", "cancelled"] as const;
export const callOutcomeEnum = ["completed", "no_answer", "voicemail", "failed", "patient_declined"] as const;

export const scheduledCallsTable = pgTable("scheduled_calls", {
  id: serial("id").primaryKey(),
  procedureId: integer("procedure_id").notNull().references(() => proceduresTable.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  callType: text("call_type", { enum: callTypeEnum }).notNull(),
  status: text("status", { enum: callStatusEnum }).notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  vapiCallId: text("vapi_call_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("scheduled_calls_procedure_call_type_idx").on(table.procedureId, table.callType),
]);

export const callRecordsTable = pgTable("call_records", {
  id: serial("id").primaryKey(),
  scheduledCallId: integer("scheduled_call_id").notNull().references(() => scheduledCallsTable.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  callType: text("call_type", { enum: callTypeEnum }).notNull(),
  outcome: text("outcome", { enum: callOutcomeEnum }),
  durationSeconds: integer("duration_seconds"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  structuredData: text("structured_data"),
  hasFlags: text("has_flags").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduledCallSchema = createInsertSchema(scheduledCallsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScheduledCall = z.infer<typeof insertScheduledCallSchema>;
export type ScheduledCall = typeof scheduledCallsTable.$inferSelect;

export const insertCallRecordSchema = createInsertSchema(callRecordsTable).omit({ id: true, createdAt: true });
export type InsertCallRecord = z.infer<typeof insertCallRecordSchema>;
export type CallRecord = typeof callRecordsTable.$inferSelect;
