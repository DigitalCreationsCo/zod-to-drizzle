import { expect, test, describe } from "bun:test";
import { z } from "zod";
import { unwrapType } from "../src";

describe("createTableFromZod", () => {
    test("unwrapType should unwrap fields correctly", () => {
        const CommonSchema = z.object({
            id: z.number(),
            name: z.string(),
            email: z.email(),
            description: z.string().optional(),
            role: z.enum([ "member", "admin", "owner" ]),
            createdAt: z.number().default(Date.now()),
            updatedAt: z.number().nullish(),
            deletedAt: z.number().nullish(),
            createdBy: z.number(),
            updatedBy: z.number().nullish(),
            deletedBy: z.number().nullish(),
            deleted: z.boolean().default(false),
        });

        const unwrappedSchema = unwrapType(CommonSchema);

        expect(unwrappedSchema).toEqual(z.object({
            id: z.number(),
            name: z.string(),
            email: z.email(),
            description: z.string(),
            role: z.enum([ "member", "admin", "owner" ]),
            createdAt: z.number().default(Date.now()),
            updatedAt: z.number(),
            deletedAt: z.number(),
            createdBy: z.number(),
            updatedBy: z.number(),
            deletedBy: z.number(),
            deleted: z.boolean().default(false),
        })
        );
    });
});
