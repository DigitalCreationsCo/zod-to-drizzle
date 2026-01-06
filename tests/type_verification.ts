
import { z } from "zod";
import { createTableFromZod } from "../src/index";
import { inferSelectModel, inferInsertModel } from "drizzle-orm";

const schema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional(),
  isAdmin: z.boolean().default(false),
  createdAt: z.date(),
});

const users = createTableFromZod("users", schema, {
  dialect: "postgres",
  primaryKey: "id",
});

type SelectUser = inferSelectModel<typeof users>;
// Expect: { id: number; name: string; email: string | null; isAdmin: boolean; createdAt: number }

type InsertUser = inferInsertModel<typeof users>;
// Expect: { id?: number; name: string; email?: string | null; isAdmin?: boolean; createdAt: number }

const s: SelectUser = {
    id: 1,
    name: "test",
    email: null,
    isAdmin: true,
    createdAt: 1234567890
};

// Check if optional is handled correctly (nullable in select)
const s2: SelectUser = {
    id: 2,
    name: "test",
    email: "test@example.com",
    isAdmin: false,
    createdAt: 123
};

// This should fail
// @ts-expect-error
const sFail: SelectUser = {
    id: 3,
    // missing name
    email: null,
    isAdmin: true,
    createdAt: 123
};

// This should fail (wrong type)
// @ts-expect-error
const sFailType: SelectUser = {
    id: 4,
    name: 123, // wrong type
    email: null,
    isAdmin: true,
    createdAt: 123
};

console.log("Type verification compiled");
