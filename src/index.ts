import { z } from "zod";
import { UnsupportedZodTypeError } from "./errors";
import type { DrizzleTables, Dialects, TableOptions } from "./types";
import { sqliteTable } from "drizzle-orm/sqlite-core";
import { mysqlTable } from "drizzle-orm/mysql-core";
import { pgTable } from "drizzle-orm/pg-core";
import type { DialectHandler } from "./dialects/base";
import { PostgresHandler } from "./dialects/postgres";
import { SQLiteHandler } from "./dialects/sqlite";

function getDialectHandler<SD extends Dialects>(dialect: TableOptions<any, SD>[ "dialect" ]): DialectHandler {
  switch (dialect) {
    case "sqlite":
      return new SQLiteHandler();
    case "mysql":
      throw new Error("MySQL support coming soon");
    case "postgres":
      return new PostgresHandler();
    default:
      throw new Error(`Unsupported dialect ${dialect}`);
  }
}

function isOptionalType(schema: z.ZodTypeAny): boolean {
  return (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodNullable ||
    hasDefault(schema)
  );
}

function hasDefault(schema: z.ZodTypeAny): boolean {
  return schema instanceof z.ZodDefault;
}

function unwrapType(schema: z.ZodType): z.ZodType {
  if (schema.def.type === "default") {
    return unwrapType((schema as z.ZodDefault<any>).unwrap());
  }
  if (schema.def.type === "optional") {
    return unwrapType((schema as z.ZodOptional<any>).unwrap());
  }
  if (schema.def.type === "nullable") {
    return unwrapType((schema as z.ZodNullable<any>).unwrap());
  }
  if (schema.def.type === "pipe") {
    return unwrapType(schema.pipe(schema).out);
  }
  return schema;
}

function zodToDrizzle(
  schema: z.ZodTypeAny,
  isOptional: boolean,
  handler: DialectHandler,
  refs?: TableOptions<any, any>[ "references" ],
) {
  const baseType = unwrapType(schema);
  const withDefault = hasDefault(schema);
  const hasReferences = refs !== undefined;

  if (baseType.def.type === "number") {
    return handler.number(
      isOptional,
      withDefault,
      hasReferences ? refs : undefined,
    );
  }
  if (baseType.def.type === "boolean") {
    return handler.boolean(isOptional, withDefault);
  }
  if (baseType.def.type === "string") {
    return handler.string(isOptional, refs);
  }
  if (baseType.def.type === "object") {
    return handler.json(isOptional);
  }
  if (baseType.def.type === "array") {
    return handler.json(isOptional);
  }
  if (baseType.def.type === "enum") {
    return handler.enum(isOptional);
  }
  if (baseType.def.type === "date") {
    return handler.date(isOptional);
  }
  if (baseType.def.type === "null" || baseType.def.type === "undefined") {
    return handler.string(true); // Always optional
  }
  if (baseType.def.type === "literal") {
    // Handle based on literal type
    // @ts-expect-error - value is not typed
    const literalValue = baseType.value;
    if (typeof literalValue === "string") {
      return handler.string(isOptional, refs);
    }
    if (typeof literalValue === "number") {
      return handler.number(
        isOptional,
        withDefault,
        hasReferences ? refs : undefined,
      );
    }
    if (typeof literalValue === "boolean") {
      return handler.boolean(isOptional, withDefault);
    }
  }
  if (baseType.def.type === "union") {
    return handler.json(isOptional);
  }
  if (baseType.def.type === "record") {
    return handler.json(isOptional);
  }
  if (baseType.def.type === "map") {
    return handler.json(isOptional);
  }
  if (baseType.def.type === "set") {
    return handler.json(isOptional);
  }

  throw new UnsupportedZodTypeError(baseType.def.type);
}

interface Reference {
  table: DrizzleTables[ keyof DrizzleTables ];
  columns: [ keyof z.infer<any>, string ][];
  onDelete?: "cascade" | "restrict" | "set null" | "no action";
}

function findReference<SD extends Dialects>(
  columnName: string,
  refs?: TableOptions<any, SD>[ "references" ],
): Reference[] | undefined {
  if (!refs) return undefined;

  for (const ref of refs) {
    const match = ref.columns.find(([ local ]) => local === columnName);
    if (match) {
      return [
        {
          table: ref.table,
          columns: [ match ],
          onDelete: ref.onDelete,
        },
      ];
    }
  }
  return undefined;
}

export function createTableFromZod<T extends z.ZodObject<any>, SD extends Dialects>(
  tableName: string,
  schema: T,
  options: TableOptions<T, SD>,
) {
  const { dialect, primaryKey, references } = options;
  const handler = getDialectHandler(dialect);
  const shape = schema.shape;
  const columns: Record<string, any> = {};

  for (const [ key, value ] of Object.entries(shape)) {
    const isOptional = isOptionalType(value as z.ZodTypeAny);
    const ref = findReference(key, references);

    columns[ key ] = zodToDrizzle(
      value as z.ZodTypeAny,
      isOptional,
      handler,
      ref,
    );

    if (primaryKey === key) {
      columns[ key ] = handler.primaryKey(schema);
    }
  }

  switch (dialect) {
    case "sqlite":
      return sqliteTable(tableName, columns);
    case "mysql":
      return mysqlTable(tableName, columns);
    case "postgres":
      return pgTable(tableName, columns);
    default:
      return sqliteTable(tableName, columns);
  }
}

export * from "./types";
export * from "./errors";
