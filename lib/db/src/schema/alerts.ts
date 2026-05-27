import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { callRecordsTable } from "./calls";

export const alertSeverityEnum = ["low", "medium", "high", "critical"] as const;

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  callRecordId: integer("call_record_id").notNull().references(() => callRecordsTable.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  severity: text("severity", { enum: alertSeverityEnum }).notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  recommendedAction: text("recommended_action"),
  acknowledged: text("acknowledged").notNull().default("false"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
