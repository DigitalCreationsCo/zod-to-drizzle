import { integer, serial, text, boolean } from "drizzle-orm/pg-core";
import type { ColumnMeta } from "..";

// ========================================
// dialects/postgres.ts
// ========================================

export function createPostgresColumn(meta: ColumnMeta) {
    if (meta.isPrimaryKey) {
        return meta.type === "string"
            ? text(meta.name).primaryKey()
            : serial(meta.name).primaryKey();
    }

    let column: any;

    switch (meta.type) {
        case "string":
        case "enum":
        case "json":
            column = text(meta.name);
            break;
        case "number":
            column = integer(meta.name);
            break;
        case "boolean":
            column = boolean(meta.name);
            break;
        case "date":
            column = integer(meta.name); // Unix timestamp
            break;
    }

    if (meta.reference) {
        const ref = meta.reference;
        column = column.references(() => ref.table[ ref.column ]);
    }

    if (!meta.isOptional && !meta.hasDefault) {
        column = column.notNull();
    }

    return column;
}
