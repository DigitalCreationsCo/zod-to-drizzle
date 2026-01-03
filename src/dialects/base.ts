// import type { z } from "zod";
// import type { ColumnWithMeta, TableOptions } from "..";

// export abstract class DialectHandler {
//   abstract string(
//     isOptional: boolean,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
//   abstract number(
//     isOptional: boolean,
//     hasDefault: boolean,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
//   abstract boolean(
//     isOptional: boolean,
//     hasDefault: boolean,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
//   abstract json(
//     isOptional: boolean,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
//   abstract date(
//     isOptional: boolean,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
//   abstract enum(
//     isOptional: boolean,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
//   abstract nativeEnum(
//     isOptional: boolean,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
//   abstract primaryKey(
//     zodType: z.ZodType,
//     refs?: TableOptions<any>["references"],
//   ): ColumnWithMeta;
// }
