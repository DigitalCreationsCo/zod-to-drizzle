import { integer, text } from "drizzle-orm/sqlite-core";
import { DialectHandler } from "./base";
import type { ColumnWithMeta, TableOptions } from "../types";
import { z } from "zod";

export class SQLiteHandler extends DialectHandler {
  string(
    isOptional: boolean,
    refs?: TableOptions<any, "sqlite">["references"],
  ): ColumnWithMeta {
    const column = refs
      ? text().references(() => {
          const table = refs[0]?.table;
          const column = refs[0]?.columns[0]?.[1] ?? "";
          return table?.[column];
        })
      : text();
    return isOptional
      ? (column as unknown as ColumnWithMeta)
      : (column.notNull() as unknown as ColumnWithMeta);
  }

  number(
    isOptional: boolean,
    hasDefault = false,
    refs?: TableOptions<any, "sqlite">["references"],
  ): ColumnWithMeta {
    const column = refs
      ? integer().references(() => {
          const table = refs[0]?.table;
          const column = refs[0]?.columns[0]?.[1] ?? "";
          return table?.[column];
        })
      : integer();
    return isOptional || hasDefault
      ? (column as unknown as ColumnWithMeta)
      : (column.notNull() as unknown as ColumnWithMeta);
  }

  boolean(isOptional: boolean, hasDefault = false): ColumnWithMeta {
    const column = integer();
    return isOptional || hasDefault
      ? (column as unknown as ColumnWithMeta)
      : (column.notNull() as unknown as ColumnWithMeta);
  }

  json(isOptional: boolean): ColumnWithMeta {
    const column = text();
    const finalColumn = isOptional
      ? column
      : (column.notNull() as unknown as ColumnWithMeta);
    // (finalColumn as any).meta = { _type: "json" };
    return finalColumn as unknown as ColumnWithMeta;
  }

  date(isOptional: boolean): ColumnWithMeta {
    const column = integer();
    return isOptional
      ? (column as unknown as ColumnWithMeta)
      : (column.notNull() as unknown as ColumnWithMeta);
  }

  enum(isOptional: boolean): ColumnWithMeta {
    const column = text();
    return isOptional
      ? (column as unknown as ColumnWithMeta)
      : (column.notNull() as unknown as ColumnWithMeta);
  }

  nativeEnum(isOptional: boolean): ColumnWithMeta {
    const column = integer();
    return isOptional
      ? (column as unknown as ColumnWithMeta)
      : (column.notNull() as unknown as ColumnWithMeta);
  }

  primaryKey(zodType: z.ZodType): ColumnWithMeta {
    if (zodType instanceof z.ZodString) {
      return text().primaryKey() as unknown as ColumnWithMeta;
    }
    return integer().primaryKey({
      autoIncrement: true,
    }) as unknown as ColumnWithMeta;
  }
}
