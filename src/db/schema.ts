import { relations } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const exams = pgTable('exams', {
  id: serial('id').primaryKey(),
  examKey: text('exam_key').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  grade: text('grade').notNull(),
  subjectId: text('subject_id').notNull(),
  examTitle: text('exam_title').notNull(),
  scoreOutOf20: text('score_out_of_20').notNull(),
  scorePercent: integer('score_percent').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  exams: many(exams),
}));

export const examsRelations = relations(exams, ({ one }) => ({
  owner: one(users, {
    fields: [exams.userId],
    references: [users.id],
  }),
}));
