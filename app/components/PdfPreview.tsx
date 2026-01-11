import { useState } from 'react';
import clsx from 'clsx';

interface PdfPreviewProps {
  pdfUrl: string;
  title: string;
}

export default function PdfPreview({ pdfUrl, title }: PdfPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
      >
        <span className="font-medium">{title}</span>
        <svg
          className={clsx(
            "w-5 h-5 transition-transform",
            isExpanded ? "transform rotate-180" : ""
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="border-t">
          <iframe
            src={pdfUrl}
            className="w-full h-[600px]"
            title={`PDF preview: ${title}`}
          />
        </div>
      )}
    </div>
  );
} 