import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const proceduresTable = pgTable("procedures", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  procedureName: text("procedure_name").notNull(),
  procedureCode: text("procedure_code"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  facility: text("facility"),
  surgeon: text("surgeon"),
  arrivalTime: text("arrival_time"),
  specialInstructions: text("special_instructions"),
  ehrProcedureId: text("ehr_procedure_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProcedureSchema = createInsertSchema(proceduresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProcedure = z.infer<typeof insertProcedureSchema>;
export type Procedure = typeof proceduresTable.$inferSelect;
