import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { ConversionType } from "./schema";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Add a getUrl function to directly get storage URLs
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const startConversion = mutation({
  args: {
    pdfFileId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversionId = await ctx.db.insert("conversions", {
      userId,
      status: "processing",
      type: "pdf_to_word",
      pdfFileId: args.pdfFileId,
      fileName: args.fileName,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await ctx.scheduler.runAfter(0, api.conversion.convertPdfToWord, {
      conversionId,
    });

    return conversionId;
  },
});

export const startImageToPdfConversion = mutation({
  args: {
    sourceFileIds: v.array(v.id("_storage")),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversionId = await ctx.db.insert("conversions", {
      userId,
      status: "processing",
      type: "image_to_pdf",
      sourceFileIds: args.sourceFileIds,
      fileName: args.fileName,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await ctx.scheduler.runAfter(0, api.conversion.convertImagesToPdf, {
      conversionId,
    });

    return conversionId;
  }
});

export const startPdfMergerConversion = mutation({
  args: {
    sourceFileIds: v.array(v.id("_storage")),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversionId = await ctx.db.insert("conversions", {
      userId,
      status: "processing",
      type: "pdf_merger",
      sourceFileIds: args.sourceFileIds,
      fileName: args.fileName,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await ctx.scheduler.runAfter(0, api.conversion.mergePdfFiles, {
      conversionId,
    });

    return conversionId;
  }
});

export const startPdfStorage = mutation({
  args: {
    pdfFileId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Store the PDF file reference
    return await ctx.db.insert("pdfFiles", {
      userId,
      pdfFileId: args.pdfFileId,
      createdAt: Date.now(),
    });
  },
});

// Type for conversion result to include sourceUrls
type ConversionResult = {
  _id: Id<"conversions">;
  _creationTime: number;
  userId: string;
  status: string;
  type: "pdf_to_word" | "image_to_pdf" | "pdf_merger";
  fileName: string;
  pdfFileId?: Id<"_storage">;
  docxFileId?: Id<"_storage">;
  pdfUrl: string | null;
  docxUrl: string | null;
  sourceFileIds: Id<"_storage">[];
  sourceUrls?: string[];
  updatedAt: number;
  createdAt: number;
  expiresAt: number;
  error?: string;
};

export const listConversions = query({
  args: { 
    type: ConversionType 
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_user_and_type", (q) => 
        q.eq("userId", userId).eq("type", args.type)
      )
      .order("desc")
      .collect();

    return await Promise.all(
      conversions.map(async (conversion) => ({
        ...conversion,
        docxUrl: conversion.docxFileId 
          ? await ctx.storage.getUrl(conversion.docxFileId)
          : null,
        pdfUrl: conversion.pdfFileId 
          ? await ctx.storage.getUrl(conversion.pdfFileId)
          : null,
        sourceUrls: conversion.sourceFileIds
          ? await Promise.all(
              conversion.sourceFileIds.map(id => ctx.storage.getUrl(id))
            )
          : []
      }))
    );
  },
});

export const getConversion = query({
  args: {
    conversionId: v.id("conversions"),
  },
  handler: async (ctx, args) => {
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion) return null;

    // If the conversion has a PDF or DOCX, get its URL
    let pdfUrl = null;
    if (conversion.pdfFileId) {
      pdfUrl = await ctx.storage.getUrl(conversion.pdfFileId);
    }
    
    let docxUrl = null;
    if (conversion.docxFileId) {
      docxUrl = await ctx.storage.getUrl(conversion.docxFileId);
    }
    
    // Get source file URLs if available
    // This works for both image-to-pdf and pdf-merger conversions
    let sourceUrls: string[] = [];
    if ((conversion.type === "image_to_pdf" || conversion.type === "pdf_merger") && 
        conversion.sourceFileIds && conversion.sourceFileIds.length > 0) {
      const urls = await Promise.all(
        conversion.sourceFileIds.map(async (id) => {
          const url = await ctx.storage.getUrl(id);
          return url || null;
        })
      );
      sourceUrls = urls.filter(Boolean) as string[];
    }

    return {
      ...conversion,
      pdfUrl,
      docxUrl,
      sourceUrls: sourceUrls.length > 0 ? sourceUrls : undefined
    };
  },
});

export const markConversionComplete = mutation({
  args: {
    conversionId: v.id("conversions"),
    success: v.boolean(),
    docxFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion) {
      throw new ConvexError("Conversion not found");
    }

    await ctx.db.patch(args.conversionId, {
      status: args.success ? "completed" : "failed",
      ...(args.docxFileId ? { docxFileId: args.docxFileId } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const getConversionJob = query({
  args: {
    conversionId: v.id("conversions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversionId);
  },
});

export const updateConversionJob = mutation({
  args: {
    jobId: v.id("conversions"),
    pdfFileId: v.optional(v.id("_storage")),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      ...(args.pdfFileId ? { pdfFileId: args.pdfFileId } : {}),
      ...(args.status ? { status: args.status } : {}),
      ...(args.error ? { error: args.error } : {}),
      updatedAt: Date.now(),
    });
  },
}); 