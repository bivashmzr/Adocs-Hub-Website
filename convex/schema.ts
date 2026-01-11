import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Define our conversion types explicitly for consistency 
export const ConversionType = v.union(
  v.literal("pdf_to_word"),
  v.literal("image_to_pdf"),
  v.literal("pdf_merger")
);

export default defineSchema({
  ...authTables,
  conversions: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    type: ConversionType,
    pdfFileId: v.optional(v.id("_storage")),
    docxFileId: v.optional(v.id("_storage")),
    fileName: v.string(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    sourceFileIds: v.optional(v.array(v.id("_storage"))),
    completedAt: v.optional(v.number())
  })
  .index("by_user", ["userId"])
  .index("by_user_and_type", ["userId", "type"]),
  
  imageUploads: defineTable({
    userId: v.string(),
    fileId: v.id("_storage"),
    createdAt: v.number(),
  }),
  
  pdfFiles: defineTable({
    userId: v.string(),
    pdfFileId: v.id("_storage"),
    createdAt: v.number(),
  })
});
