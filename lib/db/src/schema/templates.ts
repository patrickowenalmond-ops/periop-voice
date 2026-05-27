import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const callTypeEnum = ["pre_op_history", "pre_op_instructions", "post_op_24h", "post_op_72h", "post_op_2wk"] as const;

export const callTemplatesTable = pgTable("call_templates", {
  id: serial("id").primaryKey(),
  callType: text("call_type", { enum: callTypeEnum }).notNull(),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  questions: text("questions"),
  language: text("language").notNull().default("en"),
  active: text("active").notNull().default("true"),
  vapiAssistantId: text("vapi_assistant_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCallTemplateSchema = createInsertSchema(callTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCallTemplate = z.infer<typeof insertCallTemplateSchema>;
export type CallTemplate = typeof callTemplatesTable.$inferSelect;
