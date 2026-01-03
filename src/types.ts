import { z } from "zod";
import { SQLiteColumnBuilderBase, sqliteTable, SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { MySqlColumn, MySqlColumnBuilderBase, mysqlTable, MySqlTableWithColumns } from "drizzle-orm/mysql-core";
import { PgColumnBuilderBase, pgTable, PgTableWithColumns } from "drizzle-orm/pg-core";
import { createPostgresColumn } from "./dialects/postgres";
import { createSQLiteColumn } from "./dialects/sqlite";
import type { Column, ColumnBaseConfig, ColumnBuilderBase, TableConfig } from "drizzle-orm";


export type ZodTableSchemaInput = z.ZodObject<any> | z.ZodIntersection<any, any>;
export type Dialects = "sqlite" | "postgres" | "mysql";
export type ColumnCreator = (meta: ColumnMeta) => any;

export interface TableOptions<T extends z.ZodObject, D extends Dialects> {
    dialect: D;
    primaryKey?: keyof z.infer<T>;
    references?: Record<string, ColumnReference>;
    jsonColumns?: (schema: T) => Record<string, JsonColumnConfig<T, D>>;
}

export interface ColumnMeta {
    name: string;
    type: "string" | "number" | "boolean" | "json" | "date" | "enum";
    isOptional: boolean;
    isPrimaryKey: boolean;
    hasDefault: boolean;
    reference?: ColumnReference;
}

interface ColumnReference {
    table: Record<string, any>;
    column: string;
    onDelete?: "cascade" | "restrict" | "set null" | "no action";
}

export interface JsonColumnConfig<T extends z.ZodObject, D extends Dialects> {
    column: ColumnBuilderBaseTypeByDialect<D>;
    fields: Array<keyof T['shape']>; // Schema fields to include
    exclusive?: boolean; // If true, these fields won't become separate columns
}

export interface ValidatedJsonColumn<T extends ZodTableSchemaInput> {
    column: any;
    schema: T;
    parse: (data: unknown) => z.infer<T>;
    safeParse: (data: unknown) => z.ZodSafeParseResult<z.core.output<T>>;
}


export type TableTypeByDialect<D extends Dialects> =
    D extends "postgres" ? PgTableWithColumns<TableConfig<Column<any>>> :
    D extends "mysql" ? MySqlTableWithColumns<TableConfig<MySqlColumn<any>>> :
    SQLiteTableWithColumns<TableConfig<Column<any>>>;

export type ColumnBuilderBaseTypeByDialect<D extends Dialects> =
    D extends "postgres" ? PgColumnBuilderBase :
    D extends "mysql" ? MySqlColumnBuilderBase :
    SQLiteColumnBuilderBase;

export type ColumnsByDialect<D extends Dialects> = Record<string, ColumnBuilderBaseTypeByDialect<D>>;