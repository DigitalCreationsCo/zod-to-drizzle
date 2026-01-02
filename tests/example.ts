import { z } from "zod";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { createTableFromZod } from "../src";

// Define your schema
const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    tag: z.literal("user"),
    email: z.string().email().optional(),
    createdAt: z.number().default(Date.now),
});

// Create a table
const users = createTableFromZod("users", UserSchema, {
    dialect: "sqlite",
    primaryKey: "id",
}); 