import { z } from "zod";
import {
  pgTable,
  text as pgText,
  integer as pgInteger,
  boolean as pgBoolean,
  timestamp,
  serial,
  real as pgReal,
  numeric,
  varchar as pgVarchar,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import {
  sqliteTable,
  text as sqliteText,
  integer as sqliteInteger,
  real as sqliteReal,
} from "drizzle-orm/sqlite-core";

type DatabaseDialect = "postgres" | "sqlite";

export interface JsonColumnConfig<T extends z.ZodRawShape> {
  fields: (Extract<keyof T, string>)[];
  exclusive: boolean;
}

export interface ForeignKeyReference<TTable = any> {
  table: TTable;
  columns: [ string, string ][];
}

export interface ConversionOptions<T extends z.ZodRawShape> {
  dialect: DatabaseDialect;
  primaryKey?: string;
  jsonColumns?: (schema: z.ZodObject<T>) => Record<string, JsonColumnConfig<T>>;
  references?: ForeignKeyReference[];
  varcharLengths?: Record<string, number>;
  autoIncrementId?: boolean;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

type UnwrapZod<T> = T extends z.ZodOptional<infer U>
  ? UnwrapZod<U>
  : T extends z.ZodNullable<infer U>
  ? UnwrapZod<U>
  : T extends z.ZodDefault<infer U>
  ? UnwrapZod<U>
  : T;

type IsOptional<T> = T extends z.ZodOptional<any>
  ? true
  : T extends z.ZodNullable<any>
  ? true
  : false;

type ZodToPgColumn<TName extends string, TZodType> = UnwrapZod<TZodType> extends z.ZodString
  ? ReturnType<typeof pgText>
  : UnwrapZod<TZodType> extends z.ZodNumber
  ? ReturnType<typeof pgInteger<TName>>
  : UnwrapZod<TZodType> extends z.ZodBoolean
  ? ReturnType<typeof pgBoolean<TName>>
  : UnwrapZod<TZodType> extends z.ZodDate
  ? ReturnType<typeof timestamp<TName, 'date'>>
  : UnwrapZod<TZodType> extends z.ZodArray<any>
  ? ReturnType<typeof jsonb<TName>>
  : UnwrapZod<TZodType> extends z.ZodObject<any>
  ? ReturnType<typeof jsonb<TName>>
  : UnwrapZod<TZodType> extends z.ZodRecord<any, any>
  ? ReturnType<typeof jsonb<TName>>
  : ReturnType<typeof pgText>;

type ZodToSqliteColumn<TName extends string, TZodType> =
  UnwrapZod<TZodType> extends z.ZodString
  ? ReturnType<typeof sqliteText>
  : UnwrapZod<TZodType> extends z.ZodNumber
  ? ReturnType<typeof sqliteInteger<TName, 'number'>>
  : UnwrapZod<TZodType> extends z.ZodBoolean
  ? ReturnType<typeof sqliteInteger<TName, 'boolean'>>
  : UnwrapZod<TZodType> extends z.ZodDate
  ? ReturnType<typeof sqliteInteger<TName, 'timestamp'>>
  : UnwrapZod<TZodType> extends z.ZodArray<any>
  ? ReturnType<typeof sqliteText>
  : UnwrapZod<TZodType> extends z.ZodObject<any>
  ? ReturnType<typeof sqliteText>
  : UnwrapZod<TZodType> extends z.ZodRecord<any, any>
  ? ReturnType<typeof sqliteText>
  : ReturnType<typeof sqliteText>;

type BuildJsonColumns<
  TShape extends z.ZodRawShape,
  TJsonConfig extends Record<string, JsonColumnConfig<TShape>> | undefined,
  TDialect extends DatabaseDialect
> = TJsonConfig extends Record<string, JsonColumnConfig<TShape>>
  ? {
    [ K in keyof TJsonConfig & string ]: TDialect extends "postgres"
    ? ReturnType<typeof jsonb<K>>
    : ReturnType<typeof sqliteText>;
  }
  : {};

type ExtractExclusiveFields<TShape extends z.ZodRawShape, T> = T extends Record<string, JsonColumnConfig<TShape>>
  ? {
    [ K in keyof T ]: T[ K ][ "exclusive" ] extends true
    ? T[ K ][ 'fields' ][ number ]
    : never;
  }[ keyof T ]
  : never;

type BuildColumnMap<
  TShape extends z.ZodRawShape,
  TDialect extends DatabaseDialect,
  TExclusiveFields extends string = never,
  TJsonCols extends Record<string, any> = {}
> = {
  [ K in keyof TShape as K extends TExclusiveFields ? never : K & string ]: TDialect extends "postgres"
  ? ZodToPgColumn<K & string, TShape[ K ]>
  : ZodToSqliteColumn<K & string, TShape[ K ]>;
} & TJsonCols;

// ---------------------------------------------------------------------------
// JSON parsing helper
// ---------------------------------------------------------------------------

export function parseJson<T extends z.ZodTypeAny>(raw: unknown, schema: T): z.infer<T> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return schema.parse(parsed);
    } catch (err) {
      throw new Error(`Failed to parse JSON column: ${(err as Error).message}`);
    }
  } else {
    return schema.parse(raw);
  }
}

// ---------------------------------------------------------------------------
// Runtime invariant for exclusive JSON columns
// ---------------------------------------------------------------------------

export function assertExclusiveJsonWrites<TShape extends z.ZodRawShape>(
  payload: Record<string, any>,
  schema: z.ZodObject<TShape>,
  jsonConfig?: Record<string, JsonColumnConfig<TShape>>
) {
  if (!jsonConfig) return;

  for (const [ jsonCol, config ] of Object.entries(jsonConfig)) {
    if (!config.exclusive) continue;

    for (const field of config.fields) {
      if (field in payload && !(jsonCol in payload)) {
        throw new Error(
          `Exclusive JSON column "${jsonCol}" is required when field "${String(field)}" is provided`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Type-safe createTableFromZod
// ---------------------------------------------------------------------------

export function createTableFromZod<
  const TName extends string,
  TShape extends z.ZodRawShape,
  TJsonConfig extends Record<string, JsonColumnConfig<TShape>> | undefined = undefined
>(
  tableName: TName,
  zodSchema: z.ZodObject<TShape>,
  options: ConversionOptions<TShape> & { dialect: "postgres"; }
): ReturnType<typeof pgTable<TName, BuildColumnMap<
  TShape,
  "postgres",
  TJsonConfig extends Record<string, JsonColumnConfig<TShape>> ? ExtractExclusiveFields<TShape, TJsonConfig> : never,
  BuildJsonColumns<TShape, TJsonConfig, "postgres">
>>>;

export function createTableFromZod<
  const TName extends string,
  TShape extends z.ZodRawShape,
  TJsonConfig extends Record<string, JsonColumnConfig<TShape>> | undefined = undefined
>(
  tableName: TName,
  zodSchema: z.ZodObject<TShape>,
  options: ConversionOptions<TShape> & { dialect: "sqlite"; }
): ReturnType<typeof sqliteTable<TName, BuildColumnMap<
  TShape,
  "sqlite",
  TJsonConfig extends Record<string, JsonColumnConfig<TShape>> ? ExtractExclusiveFields<TShape, TJsonConfig> : never,
  BuildJsonColumns<TShape, TJsonConfig, "sqlite">
>>>;

export function createTableFromZod<
  TName extends string,
  TShape extends z.ZodRawShape
>(
  tableName: TName,
  zodSchema: z.ZodObject<TShape>,
  options: ConversionOptions<TShape>
): any {
  const {
    dialect,
    primaryKey,
    jsonColumns: jsonColumnsConfig,
    references = [],
    varcharLengths = {},
    autoIncrementId = true
  } = options;

  const shape = zodSchema.shape;
  const columns: Record<string, any> = {};

  const jsonConfigs = jsonColumnsConfig ? jsonColumnsConfig(zodSchema) : {};
  const exclusiveFields = new Set<string>();
  for (const [ jsonColName, config ] of Object.entries(jsonConfigs)) {
    if (config.exclusive) {
      config.fields.forEach(f => exclusiveFields.add(String(f)));
    }
  }

  for (const [ fieldName, zodType ] of Object.entries(shape)) {
    if (exclusiveFields.has(fieldName)) continue;

    const isPrimaryKey = primaryKey === fieldName;
    columns[ fieldName ] = convertZodTypeToColumn(
      zodType as z.ZodTypeAny,
      fieldName,
      dialect,
      varcharLengths,
      autoIncrementId && isPrimaryKey,
      isPrimaryKey
    );
  }

  // JSON columns
  for (const [ jsonColName ] of Object.entries(jsonConfigs)) {
    if (dialect === "postgres") {
      columns[ jsonColName ] = jsonb(jsonColName);
    } else {
      columns[ jsonColName ] = sqliteText(jsonColName, { mode: "json" });
    }
  }

  // Foreign keys
  for (const ref of references) {
    for (const [ domesticCol, foreignCol ] of ref.columns) {
      if (!columns[ domesticCol ]) {
        throw new Error(`Foreign key column "${domesticCol}" not found in table "${tableName}"`);
      }
      columns[ domesticCol ] = columns[ domesticCol ].references(() => ref.table[ foreignCol ]);
    }
  }

  return dialect === "postgres"
    ? pgTable(tableName, columns)
    : sqliteTable(tableName, columns);
}

// ---------------------------------------------------------------------------
// Convert Zod type → Drizzle column
// ---------------------------------------------------------------------------

function convertZodTypeToColumn(
  zodType: z.ZodTypeAny,
  fieldName: string,
  dialect: DatabaseDialect,
  varcharLengths: Record<string, number>,
  isAutoIncrementPK: boolean,
  isPrimaryKey: boolean
): any {
  let isOptional = false;
  let isNullable = false;
  let hasDefault = false;
  let defaultValue: any;
  let innerType = zodType;

  while (true) {
    if (innerType instanceof z.ZodOptional) {
      isOptional = true;
      innerType = (innerType as z.ZodOptional<z.ZodTypeAny>).unwrap();
    } else if (innerType instanceof z.ZodNullable) {
      isNullable = true;
      innerType = (innerType as z.ZodNullable<z.ZodTypeAny>).unwrap();
    } else if (innerType instanceof z.ZodDefault) {
      hasDefault = true;
      defaultValue = innerType.def.defaultValue;
      innerType = (innerType as z.ZodDefault<z.ZodTypeAny>).unwrap();
    } else {
      break;
    }
  }

  if (isAutoIncrementPK && innerType instanceof z.ZodNumber) {
    if (dialect === "postgres") {
      return serial(fieldName).primaryKey();
    }
    return sqliteInteger(fieldName, { mode: "number" }).primaryKey({ autoIncrement: true });
  }

  let column: any;

  if (innerType instanceof z.ZodString) {
    const checks = innerType.def.checks || [];
    const isUuid = checks.some((c: any) => c.kind === "uuid");

    if (isUuid && dialect === "postgres") {
      column = uuid(fieldName);
    } else if (varcharLengths[ fieldName ]) {
      column = dialect === "postgres"
        ? pgVarchar(fieldName, { length: varcharLengths[ fieldName ] })
        : sqliteText(fieldName);
    } else {
      column = dialect === "postgres" ? pgText(fieldName) : sqliteText(fieldName);
    }
  } else if (innerType instanceof z.ZodNumber) {
    const checks = innerType.def.checks || [];
    const isInt = checks.some((c: any) => c.kind === "int");

    if (dialect === "postgres") {
      column = isInt ? pgInteger(fieldName) : numeric(fieldName);
    } else {
      column = isInt
        ? sqliteInteger(fieldName, { mode: "number" })
        : sqliteReal(fieldName);
    }
  } else if (innerType instanceof z.ZodBoolean) {
    column = dialect === "postgres"
      ? pgBoolean(fieldName)
      : sqliteInteger(fieldName, { mode: "boolean" });
  } else if (innerType instanceof z.ZodDate) {
    column = dialect === "postgres"
      ? timestamp(fieldName, { mode: "date" })
      : sqliteInteger(fieldName, { mode: "timestamp" });
  } else if (
    innerType instanceof z.ZodArray ||
    innerType instanceof z.ZodObject ||
    innerType instanceof z.ZodRecord
  ) {
    column = dialect === "postgres"
      ? jsonb(fieldName)
      : sqliteText(fieldName, { mode: "json" });
  } else {
    column = dialect === "postgres" ? pgText(fieldName) : sqliteText(fieldName);
  }

  if (isPrimaryKey && !isAutoIncrementPK) {
    column = column.primaryKey();
  }

  if (!isOptional && !isNullable && !isPrimaryKey) {
    column = column.notNull();
  }

  // NOTE: Per documentation, Zod defaults are NOT mirrored to DB defaults
  // This is intentional to avoid drift and double-defaulting
  // hasDefault is intentionally not used here

  return column;
}
