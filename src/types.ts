import type { Column } from "drizzle-orm";
import type {
  SQLiteTableWithColumns,
  SQLiteColumn,
} from "drizzle-orm/sqlite-core";
import type { PgTableWithColumns, PgColumn } from "drizzle-orm/pg-core";
import type {
  MySqlTableWithColumns,
  MySqlColumn,
} from "drizzle-orm/mysql-core";
import type { z } from "zod";

export type JsonField = { _type: "json" };
export type ColumnWithMeta = Column & { meta?: JsonField };

export type Dialects = "sqlite" | "postgres" | "mysql";

export interface TableOptions<T extends z.ZodTypeAny, SD extends Dialects> {
  primaryKey?: keyof z.infer<T>;
  dialect: SD;
  references?: Array<{
    table: Record<string, any>;
    columns: [keyof z.infer<T>, string][];
    onDelete?: "cascade" | "restrict" | "set null" | "no action"; // does nothing for now
  }>;
}

export type DrizzleColumns = {
  "sqlite": SQLiteColumn;
  "postgres": PgColumn;
  "mysql": MySqlColumn;
};
export type DrizzleTables = {
  "sqlite": SQLiteTableWithColumns<any>;
  "postgres": PgTableWithColumns<any>;
  "mysql": MySqlTableWithColumns<any>;
};