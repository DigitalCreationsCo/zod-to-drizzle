import { integer, text } from "drizzle-orm/sqlite-core";
import { ColumnMeta } from "..";

// ========================================
// dialects/sqlite.ts
// ========================================

import { Dialects } from "..";

export function createSQLiteColumn(meta: ColumnMeta<"sqlite">) {
  // Primary key handling
  if (meta.isPrimaryKey) {
    return meta.type === "string"
      ? text(meta.name).primaryKey()
      : integer(meta.name).primaryKey({ autoIncrement: true });
  }

  let column: any;

  switch (meta.type) {
    case "string":
    case "enum":
    case "json":
      column = text(meta.name);
      break;
    case "number":
    case "boolean":
    case "date":
      column = integer(meta.name);
      break;
  }


  if (!meta.isOptional && !meta.hasDefault) {
    column = column.notNull();
  }

  return column;
}
