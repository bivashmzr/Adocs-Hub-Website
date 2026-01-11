import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface FilePreviewProps {
  url: string;
  fileName: string;
}

export function FilePreview({ url, fileName }: FilePreviewProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">{fileName}</span>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Preview in new tab
        </a>
      </div>
      <div className="h-[200px] bg-gray-50 flex items-center justify-center">
        <iframe 
          src={url} 
          className="w-full h-full" 
          title={`Preview of ${fileName}`}
        />
      </div>
    </div>
  );
} 