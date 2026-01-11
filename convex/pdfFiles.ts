import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const savePdfFile = mutation({
  args: { pdfFileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    return await ctx.db.insert("pdfFiles", {
      userId,
      pdfFileId: args.pdfFileId,
      createdAt: Date.now(),
    });
  },
}); 