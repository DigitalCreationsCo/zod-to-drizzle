import { z } from "zod";
import { createTableFromZod } from "zod-to-drizzle";

// Define your schema
const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email().optional(),
    createdAt: z.number().default(Date.now),
});

// Create a table
const users = createTableFromZod("users", UserSchema, {
    dialect: "sqlite",
    primaryKey: "id",
});