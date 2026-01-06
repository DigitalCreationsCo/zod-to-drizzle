import { z } from "zod";
import { createTableFromZod } from "../src";

// ============================================================================
// EXAMPLES WITH ACCURATE TYPE INFERENCE
// ============================================================================

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
});

// PostgreSQL table with accurate column types
const users = createTableFromZod("users", UserSchema, {
  dialect: "postgres" as const,
  primaryKey: "id",
  autoIncrementId: true,
  varcharLengths: {
    email: 255,
  },
});

// Now columns are accessible with accurate types:
// users.id → PgColumn<{...}>
// users.name → PgColumn<{...}>
// users.email → PgColumn<{...}>
const idColumn = users.id;       // ✅ Properly typed
const nameColumn = users.name;   // ✅ Properly typed
const emailColumn = users.email; // ✅ Properly typed

// SQLite table with accurate column types
const usersSqlite = createTableFromZod("users", UserSchema, {
  dialect: "sqlite" as const,
  primaryKey: "id",
  autoIncrementId: true,
});

// Columns accessible with SQLite types
const idColumnSqlite = usersSqlite.id;     // ✅ SQLiteColumn
const nameColumnSqlite = usersSqlite.name; // ✅ SQLiteColumn

// Example with JSON columns
const UserWithPreferencesSchema = z.object({
  id: z.number(),
  email: z.string(),
  preferences: z.object({
    theme: z.enum([ 'light', 'dark' ]),
    notifications: z.boolean(),
  }),
  metadata: z.record(z.string(), z.any()),
});

const usersWithJson = createTableFromZod("users_json", UserWithPreferencesSchema, {
  dialect: "postgres" as const,
  primaryKey: "id",
  autoIncrementId: true,
  jsonColumns: (schema) => ({
    preferences: {
      fields: [ "preferences" ],
      exclusive: true, // preferences only in JSON, not as separate column
    },
    metadata: {
      fields: [ "metadata" ],
      exclusive: true,
    }
  }),
});

// Columns are accessible:
const jsonIdCol = usersWithJson.id;          // ✅ PgColumn (serial)
const jsonEmailCol = usersWithJson.email;    // ✅ PgColumn (text)
const jsonPrefsCol = usersWithJson.preferences; // ✅ PgColumn (jsonb)
const jsonMetaCol = usersWithJson.metadata;  // ✅ PgColumn (jsonb)
// usersWithJson.preferences field doesn't exist as separate column (exclusive: true)

// Example with foreign keys
const PostSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  userId: z.number(),
  published: z.boolean().default(false),
});

const posts = createTableFromZod("posts", PostSchema, {
  dialect: "postgres" as const,
  primaryKey: "id",
  autoIncrementId: true,
  references: [
    {
      table: users,
      columns: [ [ "userId", "id" ] ],
    }
  ],
});

// All columns accessible with types
const postTitle = posts.title;   // ✅ PgColumn<{...}>
const postUserId = posts.userId; // ✅ PgColumn<{...}> with foreign key reference
