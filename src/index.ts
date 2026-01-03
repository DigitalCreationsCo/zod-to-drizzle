import { z } from "zod";
import { SQLiteColumnBuilderBase, sqliteTable, SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { MySqlColumn, MySqlColumnBuilderBase, mysqlTable, MySqlTableWithColumns } from "drizzle-orm/mysql-core";
import { PgColumnBuilderBase, pgTable, PgTableWithColumns } from "drizzle-orm/pg-core";
import { createPostgresColumn } from "./dialects/postgres";
import { createSQLiteColumn } from "./dialects/sqlite";
import type { Column } from "drizzle-orm";
import { ColumnCreator, ColumnMeta, ColumnsByDialect, Dialects, TableOptions, TableTypeByDialect, ValidatedJsonColumn, ZodTableSchemaInput } from "./types";

export function createTableFromZod<
  T extends z.ZodObject,
  D extends Dialects
>(
  tableName: string,
  _schema: T extends ZodTableSchemaInput ? z.infer<ZodTableSchemaInput> : T,
  options: TableOptions<T, D>,
): TableTypeByDialect<D> & readonly [ TableTypeByDialect<D>, ColumnsByDialect<D> ] {

  const schema = getJoinedSchema(_schema) as T;

  const createColumn = getColumnCreator(options.dialect);
  const columns: ColumnsByDialect<D> = {};

  const exclusiveFields = new Set<string>();
  const jsonColumnsConfig = options.jsonColumns?.(schema);

  if (jsonColumnsConfig) {
    for (const [ columnName, config ] of Object.entries(jsonColumnsConfig)) {
      const fieldNames = config.fields.map(String);

      // Validate all fields must exist in schema
      for (const fieldName of fieldNames) {
        if (!(fieldName in schema.shape)) {
          throw new Error(
            `Field "${fieldName}" in jsonColumns["${columnName}"].fields does not exist in schema`
          );
        }
      }

      // Validate check for duplicate exclusive fields
      if (config.exclusive) {
        for (const fieldName of fieldNames) {
          if (exclusiveFields.has(fieldName)) {
            throw new Error(
              `Field "${fieldName}" is marked as exclusive in multiple jsonColumns`
            );
          }
          exclusiveFields.add(fieldName);
        }
      }

      // Validate column type must be jsonb (basic check)
      const columnTypeStr = String(config.column);
      if (!columnTypeStr.includes('jsonb') && !columnTypeStr.includes('json')) {
        console.warn(
          `Warning: jsonColumns["${columnName}"] should use jsonb column type. ` +
          `Other types are not supported for validated JSON columns.`
        );
      }

      // Create validation schema from selected fields
      const validationSchema = z.object(
        Object.fromEntries(
          fieldNames.map(name => [ name, schema.shape[ name ] ])
        )
      );

      // Attach validation schema to column for runtime use
      (config.column as any).__zodSchema = validationSchema;

      // Add the JSON column
      columns[ columnName ] = config.column;
    }
  }

  for (const [ name, zodObject ] of Object.entries<z.ZodType>(schema.shape)) {
    // Skip if this field is marked as exclusive
    if (exclusiveFields.has(name))
      continue;

    const meta = extractColumnMeta(name, zodObject as ZodTableSchemaInput, options);
    columns[ name ] = createColumn(meta);

    // Override with primary key if specified
    if (String(options.primaryKey) === name) {
      columns[ name ] = createColumn({
        ...meta,
        isPrimaryKey: true
      });
    }
  }

  let table: TableTypeByDialect<D>;
  switch (options.dialect) {
    case "sqlite":
      table = sqliteTable(tableName, columns as ColumnsByDialect<"sqlite">) as TableTypeByDialect<D>;
      break;
    case "postgres":
      table = pgTable(tableName, columns as ColumnsByDialect<"postgres">) as TableTypeByDialect<D>;
      break;
    case "mysql":
      table = mysqlTable(tableName, columns as ColumnsByDialect<"mysql">) as TableTypeByDialect<D>;
      break;
  }

  let proxy: any;

  const iteratorFn = function* () {
    yield table;
    yield columns;
  };

  proxy = new Proxy(table, {
    get(target, prop, receiver) {
      if (prop === Symbol.iterator) return iteratorFn;
      if (prop === "0") return table;
      if (prop === "1") return columns;
      return Reflect.get(target, prop, receiver);
    },

    has(target, prop) {
      return prop in target || prop === "0" || prop === "1";
    },

    ownKeys(target) {
      return Array.from(
        new Set([
          ...Reflect.ownKeys(target),
          "0",
          "1",
          Symbol.iterator,
        ])
      );
    },

    getOwnPropertyDescriptor(target, prop) {
      if (prop === "0" || prop === "1") {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
          value: prop === "0" ? proxy : columns,
        };
      }

      if (prop === Symbol.iterator) {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
          value: iteratorFn,
        };
      }

      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  return proxy;
}

export type JsonField = { _type: "json"; };
type ColumnWithMeta = Column & { meta?: JsonField; };

function getColumnCreator<D extends Dialects>(dialect: D): ColumnCreator {
  switch (dialect) {
    case "sqlite": return createSQLiteColumn;
    case "postgres": return createPostgresColumn;
    case "mysql":
      throw new Error("MySQL support coming soon");
    default: throw new Error(`Unsupported dialect: ${dialect}`);
  }
}

export function getJsonColumnValidator<T extends ZodTableSchemaInput>(
  column: any
): ValidatedJsonColumn<T> | null {
  const schema = (column as any).__zodSchema;
  if (!schema) return null;

  return {
    column,
    schema,
    parse: (data: unknown) => schema.parse(data),
    safeParse: (data: unknown) => schema.safeParse(data)
  };
}

function extractColumnMeta<T extends z.ZodObject, D extends Dialects>(
  name: string,
  zodType: ZodTableSchemaInput,
  options: TableOptions<T, D>
): ColumnMeta {
  const unwrapped = unwrapType(zodType);

  return {
    name,
    type: getBaseType(unwrapped),
    isOptional: isOptionalType(zodType),
    isPrimaryKey: options.primaryKey === name,
    hasDefault: hasDefault(zodType),
    reference: options.references?.[ name ],
  };
}

export function getBaseType(schema: z.ZodType): ColumnMeta[ "type" ] {
  const typeName = schema.def.type;

  let type: string | undefined;
  try {
    const traits = (schema as any)._zod?.traits;
    if (traits && typeof traits.values === 'function') {
      const iterator = traits.values();
      const result = iterator.next();
      type = result.value;
    }
  } catch {
    type = typeName;
  }

  if (!type) {
    type = typeName;
  }

  if (type === "ZodString") return "string";
  if (type === "ZodNumber") return "number";
  if (type === "ZodBoolean") return "boolean";
  if (type === "ZodDate") return "date";
  if (type === "ZodEnum" || type === "ZodNativeEnum") return "enum";
  if (type === "ZodObject" || type === "ZodArray" || type === "ZodRecord" ||
    type === "ZodMap" || type === "ZodSet" || type === "ZodUnion") {
    return "json";
  }

  if (type === "ZodLiteral") {
    const value = (schema as z.ZodLiteral<any>).value;
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
  }

  return "string";
}

function isOptionalType(schema: z.ZodTypeAny): boolean {
  return (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    hasDefault(schema)
  );
}

function hasDefault(schema: z.ZodTypeAny): boolean {
  return schema instanceof z.ZodDefault;
}

function getJoinedSchema(schema: any): z.ZodType<any> {
  // Base case: It's an object, return the shape directly
  if (schema instanceof z.ZodObject) {
    return schema;
  }

  // Optional/Nullable wrappers (good practice to handle)
  if (schema instanceof z.ZodNullable) {
    return getJoinedSchema(schema.unwrap());
  }

  // Recursive case: It's an intersection, merge left and right
  if (schema instanceof z.ZodIntersection) {
    return {
      ...getJoinedSchema(schema.def.left),
      ...getJoinedSchema(schema.def.right),
    };
  }

  throw new Error(`Unsupported schema type: ${schema.constructor.name}`);
}

function unwrapType(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodIntersection) return unwrapType(getJoinedSchema(schema));
  if (schema instanceof z.ZodDefault) return unwrapType(schema.unwrap() as z.ZodDefault);
  if (schema instanceof z.ZodOptional) return unwrapType(schema.unwrap() as z.ZodOptional);
  if (schema instanceof z.ZodNullable) return unwrapType(schema.unwrap() as z.ZodNullable);
  if ("def" in schema && schema.def.type === "pipe") {
    return unwrapType((schema as any).def.out);
  }
  return schema;
}

export default createTableFromZod;
export * from "./types";
export * from "./errors";