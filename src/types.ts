import { z } from "zod";
import {
    SQLiteColumnBuilderBase, SQLiteTableWithColumns, ForeignKeyBuilder as SQLiteForeignKeyBuilder,
    SQLiteText, SQLiteInteger
} from "drizzle-orm/sqlite-core";
import {
    MySqlColumn, MySqlColumnBuilderBase, MySqlTableWithColumns, ForeignKeyBuilder as MySqlForeignKeyBuilder
} from "drizzle-orm/mysql-core";
import {
    PgColumnBuilderBase, PgTableWithColumns, ForeignKeyBuilder as PgForeignKeyBuilder,
    PgText, PgInteger, PgBoolean, PgSerial
} from "drizzle-orm/pg-core";
import type { Column, TableConfig } from "drizzle-orm";


export type ZodTableSchemaInput = z.ZodObject<any> | z.ZodIntersection<any, any>;
export type Dialects = "sqlite" | "postgres" | "mysql";
export type ColumnCreator<D extends Dialects> = (meta: ColumnMeta<D>) => any;

export interface TableOptions<T extends z.ZodObject, D extends Dialects> {
    dialect: D;
    primaryKey?: keyof z.infer<T>;
    references?: Array<{
        table?: TableTypeByDialect<any, D>;
        columns: [ keyof z.infer<T>, string | Column[ 'name' ] ][];
        // onDelete?: "cascade" | "restrict" | "set null" | "no action"; // does nothing for now
    }>;
    jsonColumns?: (schema: T) => Record<string, JsonColumnConfig<T, D>>;
}

export interface ColumnMeta<D extends Dialects> {
    name: string;
    type: "string" | "number" | "boolean" | "json" | "date" | "enum";
    isOptional: boolean;
    isPrimaryKey: boolean;
    hasDefault: boolean;
}

export interface JsonColumnConfig<T extends z.ZodObject, D extends Dialects> {
    column: ColumnBuilderBaseTypeByDialect<D> & { __zodSchema?: z.ZodType<any>; };
    fields: Array<keyof T[ 'shape' ]>; // Schema fields to include
    exclusive?: boolean; // If true, these fields won't become separate columns
}

export interface ValidatedJsonColumn<T extends ZodTableSchemaInput> {
    column: any;
    schema: T;
    parse: (data: unknown) => z.infer<T>;
    safeParse: (data: unknown) => z.ZodSafeParseResult<z.core.output<T>>;
}

export type TableTypeByDialect<T extends z.ZodRawShape, D extends Dialects> =
    D extends "postgres" ? PgTableWithColumns<any> :
    D extends "mysql" ? MySqlTableWithColumns<any> :
    SQLiteTableWithColumns<any>;

export type ColumnBuilderBaseTypeByDialect<D extends Dialects> =
    D extends "postgres" ? PgColumnBuilderBase :
    D extends "mysql" ? MySqlColumnBuilderBase :
    SQLiteColumnBuilderBase;

export type ColumnsByDialect<D extends Dialects> = Record<string, ColumnBuilderBaseTypeByDialect<D>>;

export type ForeignKeyBuilderType<D extends Dialects> =
    D extends "postgres" ? PgForeignKeyBuilder :
    D extends "mysql" ? MySqlForeignKeyBuilder :
    SQLiteForeignKeyBuilder;


// =========================================================
// Type Inference
// =========================================================

type Unwrap<T> = T extends z.ZodOptional<infer U> ? Unwrap<U> :
    T extends z.ZodNullable<infer U> ? Unwrap<U> :
    T extends z.ZodDefault<infer U> ? Unwrap<U> :
    T;

type IsOptional<T> = T extends z.ZodOptional<any> ? true :
    T extends z.ZodNullable<any> ? true :
    T extends z.ZodDefault<any> ? true : // Defaults are technically optional for insert
    false;

// Simplified Config for type inference
interface InferConfig<
    Name extends string,
    TData,
    NotNull extends boolean,
    IsPK extends boolean = false
> {
    name: Name;
    tableName: string;
    dataType: any;
    columnType: any;
    data: TData;
    driverParam: any;
    notNull: NotNull;
    hasDefault: boolean;
    enumValues: undefined;
    baseColumn: any;
    isPrimaryKey: IsPK;
    isAutoincrement: boolean;
    hasRuntimeDefault: boolean;
    length: undefined; // For SQLiteText
}

// Postgres Mapping
type PgTypeMapping<Name extends string, ZodType, IsPK extends boolean> =
    IsPK extends true ? (
        Unwrap<ZodType> extends z.ZodNumber ? PgSerial<InferConfig<Name, number, true, true>> :
        Unwrap<ZodType> extends z.ZodString ? PgText<InferConfig<Name, string, true, true>> :
        PgText<InferConfig<Name, string, true, true>> // Fallback
    ) : (
        Unwrap<ZodType> extends z.ZodString ? PgText<InferConfig<Name, string, IsOptional<ZodType> extends true ? false : true>> :
        Unwrap<ZodType> extends z.ZodNumber ? PgInteger<InferConfig<Name, number, IsOptional<ZodType> extends true ? false : true>> :
        Unwrap<ZodType> extends z.ZodBoolean ? PgBoolean<InferConfig<Name, boolean, IsOptional<ZodType> extends true ? false : true>> :
        Unwrap<ZodType> extends z.ZodDate ? PgInteger<InferConfig<Name, number, IsOptional<ZodType> extends true ? false : true>> : // Date -> Integer (Unix timestamp)
        PgText<InferConfig<Name, string, IsOptional<ZodType> extends true ? false : true>> // JSON/Enum/Fallback
    );

// SQLite Mapping
type SQLiteTypeMapping<Name extends string, ZodType, IsPK extends boolean> =
    IsPK extends true ? (
        Unwrap<ZodType> extends z.ZodNumber ? SQLiteInteger<InferConfig<Name, number, true, true>> :
        Unwrap<ZodType> extends z.ZodString ? SQLiteText<InferConfig<Name, string, true, true>> :
        SQLiteText<InferConfig<Name, string, true, true>>
    ) : (
        Unwrap<ZodType> extends z.ZodString ? SQLiteText<InferConfig<Name, string, IsOptional<ZodType> extends true ? false : true>> :
        Unwrap<ZodType> extends z.ZodNumber ? SQLiteInteger<InferConfig<Name, number, IsOptional<ZodType> extends true ? false : true>> :
        Unwrap<ZodType> extends z.ZodBoolean ? SQLiteInteger<InferConfig<Name, number, IsOptional<ZodType> extends true ? false : true>> : // Bool -> Int
        Unwrap<ZodType> extends z.ZodDate ? SQLiteInteger<InferConfig<Name, number, IsOptional<ZodType> extends true ? false : true>> : // Date -> Int
        SQLiteText<InferConfig<Name, string, IsOptional<ZodType> extends true ? false : true>> // JSON/Enum/Fallback
    );

export type InferTableType<
    Schema extends z.ZodObject<any>,
    Options extends TableOptions<Schema, any>
> =
    Options[ 'dialect' ] extends 'postgres' ? PgTableWithColumns<{
        name: string,
        schema: string | undefined,
        columns: {
            [ K in keyof Schema[ 'shape' ] ]: PgTypeMapping<
                K & string,
                Schema[ 'shape' ][ K ],
                K extends Options[ 'primaryKey' ] ? true : false
            >
        },
        dialect: 'pg';
    }> :
    Options[ 'dialect' ] extends 'sqlite' ? SQLiteTableWithColumns<{
        name: string,
        schema: string | undefined,
        columns: {
            [ K in keyof Schema[ 'shape' ] ]: SQLiteTypeMapping<
                K & string,
                Schema[ 'shape' ][ K ],
                K extends Options[ 'primaryKey' ] ? true : false
            >
        },
        dialect: 'sqlite';
    }> :
    TableTypeByDialect<Options[ 'dialect' ]>; // Fallback for MySql
