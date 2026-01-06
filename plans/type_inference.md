# Type Inference Plan for `zod-to-drizzle`

## Objective
Enable `createTableFromZod` to return a strongly-typed Drizzle table object, allowing `drizzle-orm` to correctly infer Select and Insert models.

## Current State
`createTableFromZod` returns `TableTypeByDialect<D>`, which uses `Column<any>`. This erases type information.

## Proposed Types

We need to construct a type `InferColumns<Schema, Options>` that maps the Zod shape to Drizzle Column types.

### 1. Helper Types

```typescript
type Unwrap<T> = T extends z.ZodOptional<infer U> ? Unwrap<U> :
                 T extends z.ZodNullable<infer U> ? Unwrap<U> :
                 T extends z.ZodDefault<infer U> ? Unwrap<U> :
                 T;

type IsOptional<T> = T extends z.ZodOptional<any> ? true :
                     T extends z.ZodNullable<any> ? true :
                     T extends z.ZodDefault<any> ? true : // Treated as optional for "notNull" check in current impl
                     false;

type GetZodBaseType<T> = Unwrap<T> extends z.ZodString ? 'string' :
                         Unwrap<T> extends z.ZodNumber ? 'number' :
                         Unwrap<T> extends z.ZodBoolean ? 'boolean' :
                         Unwrap<T> extends z.ZodDate ? 'date' :
                         'json'; // Fallback
```

### 2. Postgres Type Mapping

We need to map to `PgColumn<Config>`.

```typescript
// Simplified Config for type inference
interface InferConfig<Name extends string, TData, NotNull extends boolean> {
  name: Name;
  tableName: string;
  dataType: any; 
  columnType: any;
  data: TData;
  driverParam: any;
  notNull: NotNull;
  hasDefault: boolean; // We don't track this strictly yet, but could
  enumValues: undefined;
  baseColumn: any;
}

type PgTypeMapping<
  Name extends string,
  ZodType,
  IsPK extends boolean
> = 
  IsPK extends true ? (
     // PK Logic
     Unwrap<ZodType> extends z.ZodNumber ? PgSerial<InferConfig<Name, number, true>> :
     Unwrap<ZodType> extends z.ZodString ? PgText<InferConfig<Name, string, true>> :
     never
  ) : (
     // Regular Column Logic
     Unwrap<ZodType> extends z.ZodString ? PgText<InferConfig<Name, string, IsOptional<ZodType> extends true ? false : true>> :
     Unwrap<ZodType> extends z.ZodNumber ? PgInteger<InferConfig<Name, number, IsOptional<ZodType> extends true ? false : true>> :
     Unwrap<ZodType> extends z.ZodBoolean ? PgBoolean<InferConfig<Name, boolean, IsOptional<ZodType> extends true ? false : true>> :
     Unwrap<ZodType> extends z.ZodDate ? PgInteger<InferConfig<Name, number, IsOptional<ZodType> extends true ? false : true>> : // Mapped to integer in runtime
     PgText<InferConfig<Name, string, IsOptional<ZodType> extends true ? false : true>> // JSON/Fallback
  );
```

### 3. SQLite Type Mapping

Similar structure, mapping to `SQLiteText`, `SQLiteInteger`.

```typescript
type SQLiteTypeMapping<
  Name extends string,
  ZodType,
  IsPK extends boolean
> = ...
```

### 4. Main Type

```typescript
export type InferTableType<
  Schema extends z.ZodObject<any>,
  Options extends TableOptions<Schema, any>
> = 
  Options['dialect'] extends 'postgres' ? PgTableWithColumns<{
     name: string,
     schema: undefined,
     columns: {
        [K in keyof Schema['shape']]: PgTypeMapping<
            K & string, 
            Schema['shape'][K], 
            K extends Options['primaryKey'] ? true : false
        >
     },
     dialect: 'pg'
  }> :
  Options['dialect'] extends 'sqlite' ? SQLiteTableWithColumns<{
     // ...
  }> :
  never; // MySQL pending
```

## Implementation Strategy

1.  **Modify `src/types.ts`**:
    *   Import necessary generic types from `drizzle-orm`.
    *   Define the `InferTableType` and helper mappings.
    *   Update `ColumnMeta` or create new type-level meta if needed (not needed if we just use Zod type).

2.  **Modify `src/index.ts`**:
    *   Update `createTableFromZod` return type to `InferTableType<T, Options>`.

## Caveats

*   **Runtime vs Type Mismatch**: We must ensure the runtime `createColumn` logic exactly matches the type conditions.
    *   Postgres `date` -> `integer` (runtime) vs Type. If I map ZodDate to `PgInteger` (number), it matches runtime.
*   **JSON Columns**: `jsonColumns` option overrides standard inference.
    *   The current runtime logic creates `text` columns for JSON but attaches a validation schema.
    *   Ideally, we should map these to `PgJson` or `PgJsonb` if supported, or `PgText`.
    *   The current runtime `createPostgresColumn` maps `json` -> `text` (line 23).
    *   So mapping to `PgText` is correct for now.

## Verification

*   Create a test that attempts to `inferSelectModel` from the resulting table.
*   Check if the keys have correct types (`string`, `number`, `string | null`).
