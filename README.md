# zod-to-drizzle

Convert [Zod](https://zod.dev) schemas to [Drizzle ORM](https://orm.drizzle.team) tables with TypeScript support.

## Update
Zod schemas are a robust data definition and validation tool. The goal with zod-to-drizzle was to use Zod schemas to generate Drizzle table definitions, unifying validation and database models into a single definition.

The issue is that Drizzle’s type system is heavily class-based rather than purely interface-based, featuring protected member access: Drizzle’s internal utilities perform strict inheritance checks. 
TypeScript treated the zod schemas as object literals. Even if the object has the exact same "shape" as a Drizzle column, the actual inhertiance throws ts(2345) errors because a non-derived type cannot access the protected members of the Column class. Attempting to spoof this inheritance through complex intersections and type-casting results in fragile code that compromises Drizzle's type safety.

For using zod schemas with drizzle table definitions, use the official drizzle-zod library to derive validation schemas from the database models with type-checking and better compatibility.

## Features

- 🚀 Convert Zod schemas to Drizzle tables
- 🔑 Automatic primary key handling
- 🔗 Type-safe foreign key references
- 📝 Full TypeScript support
- 🎯 Support for SQLite (PostgreSQL & MySQL coming soon)
- 🎨 Support for all common Zod types

## Installation

```bash
bun add zod-to-drizzle
# or
npm install zod-to-drizzle
# or
pnpm add zod-to-drizzle
# or
yarn add zod-to-drizzle
```

## Quick Start

```typescript
import { createTableFromZod } from "zod-to-drizzle";
import { z } from "zod";
import { SQLiteTable } from "drizzle-orm/sqlite-core";

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
}) as SQLiteTable;
```

## Foreign Keys

```typescript
// Define schemas
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const PostSchema = z.object({
  id: z.number(),
  title: z.string(),
  userId: z.number(),
});

// Create tables with references
const users = createTableFromZod("users", UserSchema, {
  dialect: "sqlite",
  primaryKey: "id",
});

const posts = createTableFromZod("posts", PostSchema, {
  dialect: "sqlite",
  primaryKey: "id",
  references: [
    {
      table: users,
      columns: [["userId", "id"]],
    },
  ],
});
```

## Supported Types

| Zod Type            | SQLite | PostgreSQL | MySQL |
| ------------------- | ------ | ---------- | ----- |
| `z.string()`        | ✅     | 🔜         | 🔜    |
| `z.number()`        | ✅     | 🔜         | 🔜    |
| `z.boolean()`       | ✅     | 🔜         | 🔜    |
| `z.date()`          | ✅     | 🔜         | 🔜    |
| `z.enum()`          | ✅     | 🔜         | 🔜    |
| `z.object()` (JSON) | ✅     | 🔜         | 🔜    |
| `z.array()` (JSON)  | ✅     | 🔜         | 🔜    |
| `z.optional()`      | ✅     | 🔜         | 🔜    |
| `z.nullable()`      | ✅     | 🔜         | 🔜    |
| `z.default()`       | ✅     | 🔜         | 🔜    |

## API Reference

### createTableFromZod

```typescript
function createTableFromZod<T extends z.ZodObject<any>>(
  tableName: string,
  schema: T,
  options: {
    dialect?: "sqlite" | "postgres" | "mysql";
    primaryKey?: keyof z.infer<T>;
    references?: Array<{
      table: SQLiteTable;
      columns: [keyof z.infer<T>, string][];
    }>;
  },
);
```

#### Parameters

- `tableName`: The name of the table
- `schema`: Zod object schema
- `options`:
  - `dialect`: Database dialect (default: "sqlite")
  - `primaryKey`: Column to use as primary key
  - `references`: Array of foreign key references

## Examples

### Common Schema Pattern

```typescript
const CommonSchema = z.object({
  id: z.number(),
  createdAt: z.number().default(Date.now()),
  updatedAt: z.number().nullish(),
  deletedAt: z.number().nullish(),
  createdBy: z.number(),
  updatedBy: z.number().nullish(),
  deletedBy: z.number().nullish(),
  deleted: z.boolean().default(false),
});

const UserSchema = CommonSchema.extend({
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
});

const users = createTableFromZod("users", UserSchema, {
  dialect: "sqlite",
  primaryKey: "id",
});
```

### Complex Types

```typescript
const Schema = z.object({
  id: z.number(),
  metadata: z.object({ key: z.string() }), // Stored as JSON (TEXT in SQLite)
  tags: z.array(z.string()), // Stored as JSON (TEXT in SQLite)
  settings: z.record(z.string()), // Stored as JSON (TEXT in SQLite)
  role: z.enum(["admin", "user"]), // Stored as text
});
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## License

MIT - see [LICENSE](LICENSE) for details.
