import { useState, useEffect } from "react";

type ConversionType = "pdf_to_word" | "image_to_pdf" | "pdf_merger";

type Conversion = {
  _id: string;
  _creationTime: number;
  status: "pending" | "processing" | "completed" | "failed";
  type: ConversionType;
  fileName: string;
  pdfUrl?: string | null;
  docxUrl?: string | null;
  sourceUrls?: string[];
  sourceFileIds?: string[];
  error?: string;
};

type ConversionsListProps = {
  conversions: Conversion[];
  refreshTrigger?: number;
  emptyMessage?: string;
};

export function ConversionsList({ 
  conversions, 
  refreshTrigger, 
  emptyMessage = "No previous conversions found."
}: ConversionsListProps) {
  const [sortedConversions, setSortedConversions] = useState<Conversion[]>([]);
  
  useEffect(() => {
    if (!Array.isArray(conversions)) {
      setSortedConversions([]);
      return;
    }
    
    // Sort by creation time (newest first)
    const sorted = [...conversions].sort((a, b) => b._creationTime - a._creationTime);
    setSortedConversions(sorted);
  }, [conversions, refreshTrigger]);

  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Completed</span>;
      case "processing":
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Processing</span>;
      case "pending":
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Pending</span>;
      case "failed":
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{status}</span>;
    }
  }

  function getTypeLabel(type: ConversionType) {
    switch (type) {
      case "pdf_to_word":
        return "PDF to Word";
      case "image_to_pdf":
        return "Image to PDF";
      case "pdf_merger":
        return "PDF Merger";
      default:
        return type;
    }
  }

  function getDownloadUrl(conversion: Conversion): string | null {
    if (conversion.type === "pdf_to_word" && conversion.docxUrl) {
      return conversion.docxUrl;
    } else if ((conversion.type === "image_to_pdf" || conversion.type === "pdf_merger") && conversion.pdfUrl) {
      return conversion.pdfUrl;
    }
    return null;
  }

  if (!Array.isArray(conversions) || sortedConversions.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedConversions.map(conversion => (
        <div key={conversion._id} className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{conversion.fileName}</h3>
              <div className="flex gap-2 text-sm text-gray-500 mt-1">
                {getStatusBadge(conversion.status)}
                <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                  {getTypeLabel(conversion.type)}
                </span>
                {conversion.sourceFileIds && (
                  <span className="text-xs text-gray-500">
                    {conversion.type === "pdf_merger" 
                      ? `${conversion.sourceFileIds.length} PDF${conversion.sourceFileIds.length !== 1 ? 's' : ''}`
                      : `${conversion.sourceFileIds.length} file${conversion.sourceFileIds.length !== 1 ? 's' : ''}`
                    }
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              {conversion.status === "completed" && (
                <>
                  {getDownloadUrl(conversion) && (
                    <>
                      <a 
                        href={getDownloadUrl(conversion)!} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-indigo-500 border border-indigo-500 px-3 py-1 rounded text-sm hover:bg-indigo-50"
                      >
                        View
                      </a>
                      <a 
                        href={getDownloadUrl(conversion)!} 
                        download={conversion.fileName}
                        className="bg-indigo-500 text-white px-3 py-1 rounded text-sm hover:bg-indigo-600"
                      >
                        Download
                      </a>
                    </>
                  )}
                </>
              )}
              
              {conversion.status === "failed" && conversion.error && (
                <div className="text-red-500 text-sm">
                  Error: {conversion.error}
                </div>
              )}
            </div>
          </div>
          
          {conversion.type === "image_to_pdf" && conversion.sourceUrls && conversion.sourceUrls.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Source Images</h4>
              <div className="grid grid-cols-4 gap-2">
                {conversion.sourceUrls.slice(0, 4).map((url, index) => (
                  <a 
                    key={index} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img 
                      src={url} 
                      alt={`Source ${index + 1}`} 
                      className="rounded border h-16 w-16 object-cover" 
                    />
                  </a>
                ))}
                {conversion.sourceUrls.length > 4 && (
                  <div className="rounded border h-16 w-16 flex items-center justify-center bg-gray-100">
                    <span className="text-sm text-gray-500">+{conversion.sourceUrls.length - 4}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {conversion.type === "pdf_merger" && conversion.sourceUrls && conversion.sourceUrls.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Source PDFs</h4>
              <div className="flex flex-wrap gap-2">
                {conversion.sourceUrls.slice(0, 4).map((url, index) => (
                  <a 
                    key={index} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs hover:bg-gray-200"
                  >
                    Source PDF {index + 1}
                  </a>
                ))}
                {conversion.sourceUrls.length > 4 && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                    +{conversion.sourceUrls.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 