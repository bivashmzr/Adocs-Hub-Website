import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to clean up expired conversions
export const cleanupExpiredConversions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    
    // Query for expired conversions
    const expiredConversions = await ctx.db
      .query("conversions")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Delete each expired conversion and its associated files
    let deletedCount = 0;
    for (const conversion of expiredConversions) {
      try {
        // Delete the PDF file if it exists
        if (conversion.pdfFileId) {
          await ctx.storage.delete(conversion.pdfFileId);
        }
        
        // Delete the DOCX file if it exists
        if (conversion.docxFileId) {
          await ctx.storage.delete(conversion.docxFileId);
        }
        
        // Delete the conversion record
        await ctx.db.delete(conversion._id);
        deletedCount++;
      } catch (error) {
        console.error(`Error cleaning up conversion ${conversion._id}:`, error);
        // Continue with next conversion even if this one fails
      }
    }

    return deletedCount;
  },
});

const crons = cronJobs();

// Run cleanup every hour
crons.interval(
  "cleanup-expired-conversions", 
  { hours: 1 }, 
  internal.crons.cleanupExpiredConversions,
  {}
);

export default crons; 