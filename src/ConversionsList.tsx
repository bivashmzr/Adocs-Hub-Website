import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { useEffect, useState } from "react";

type ConversionType = "pdf_to_word" | "image_to_pdf" | "pdf_merger";

interface ConversionsListProps {
  type: ConversionType;
  title?: string;
}

export function ConversionsList({ type, title = "Recent Conversions" }: ConversionsListProps) {
  const conversionsResult = useQuery(api.files.listConversions, { type });
  const [conversions, setConversions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Process results with useEffect
  useEffect(() => {
    if (Array.isArray(conversionsResult)) {
      setConversions(conversionsResult);
      setError(null);
    } else if (conversionsResult instanceof Error) {
      console.error("Error in listConversions query:", conversionsResult);
      setError(conversionsResult.message);
      setConversions([]);
    }
  }, [conversionsResult]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-800">Error loading conversions</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!conversions?.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="space-y-4">
        {conversions.map((conversion) => (
          <ConversionItem key={conversion._id} conversion={conversion} />
        ))}
      </div>
    </div>
  );
}

function ConversionItem({ conversion }: { 
  conversion: any & { docxUrl: string | null, pdfUrl?: string | null } 
}) {
  // Determine status color
  let statusColor = "bg-yellow-100 text-yellow-800";
  let displayStatus = conversion.status;
  
  // Treat conversions as completed if they have a URL, even if status says failed
  const hasDownloadableResult = 
    (conversion.type === "pdf_to_word" && conversion.docxUrl) || 
    ((conversion.type === "image_to_pdf" || conversion.type === "pdf_merger") && conversion.pdfUrl);
  
  if (hasDownloadableResult) {
    statusColor = "bg-green-100 text-green-800";
    // If status is failed but we have a URL, show "completed" instead
    if (conversion.status === "failed") {
      displayStatus = "completed";
    }
  } else if (conversion.status === "failed") {
    statusColor = "bg-red-100 text-red-800";
  }

  async function handleDownload() {
    if (!conversion.docxUrl && !conversion.pdfUrl) {
      toast.error("Download URL not available");
      return;
    }

    try {
      const downloadUrl = conversion.type === "pdf_to_word" ? conversion.docxUrl! : conversion.pdfUrl!;
      
      // Show download toast
      const toastId = toast.loading("Preparing download...");
      
      // Fetch the file first to ensure it's complete
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        toast.error("Failed to download file. Please try again.", { id: toastId });
        return;
      }
      
      // Get the file as a blob
      const blob = await response.blob();
      
      // Create a blob URL and download link
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Set the filename
      let fileName = conversion.fileName;
      
      // Make sure the file has the correct extension
      if (conversion.type === "pdf_to_word" && !fileName.toLowerCase().endsWith('.docx')) {
        fileName = fileName.replace(/\.[^.]+$/, '') + '.docx';
      } else if ((conversion.type === "image_to_pdf" || conversion.type === "pdf_merger") && !fileName.toLowerCase().endsWith('.pdf')) {
        fileName = fileName.replace(/\.[^.]+$/, '') + '.pdf';
      }
      
      link.download = fileName;
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      toast.success("Download complete", { id: toastId });
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Download failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{conversion.fileName}</p>
          <span className={`inline-block px-2 py-1 rounded-full text-xs ${statusColor}`}>
            {displayStatus}
          </span>
          {conversion.sourceFileIds && conversion.sourceFileIds.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              {conversion.type === "pdf_merger" ? 
                `${conversion.sourceFileIds.length} PDF${conversion.sourceFileIds.length !== 1 ? 's' : ''}` :
                `${conversion.sourceFileIds.length} image${conversion.sourceFileIds.length !== 1 ? 's' : ''}`
              }
            </span>
          )}
        </div>
        {hasDownloadableResult && (
          <button
            onClick={handleDownload}
            className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
          >
            Download
          </button>
        )}
      </div>
    </div>
  );
}
