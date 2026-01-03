import { jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createTableFromZod } from "zod-to-drizzle";

const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email().optional(),
    preferences: z.object({
        theme: z.string(),
        prompt: z.string(),
        avatar: z.string().optional(),
        lastLoggedin: z.date(),
        "test space property": z.string(), // test formatting with space
        "inner preferences": z.object({
            pref1: z.string(),
            pref2: z.string(),
            pref3: z.string(),
            "pref 4": z.string(),
        })
    }),
    createdAt: z.number().default(Date.now),
});

// export const organizations = pgTable("organizations", {
//     id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//     name: text("name").notNull().unique(),
// });

const [ users, columns ] = createTableFromZod("users", UserSchema, {
    dialect: "postgres",
    primaryKey: "id",
    jsonColumns: (schema) => ({
        preferences: {
            column: jsonb('preferences'),
            fields: [ "preferences" ],
            exclusive: false
        }
    })
    // references: {
    //     orgId: {
    //         table: organizations,
    //         column: "id",
    //         onDelete: "cascade",
    //     },
    // },
});

console.log('creating table for schema: ');
console.log(UserSchema.shape);

console.log('end');