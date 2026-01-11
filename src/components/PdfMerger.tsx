import { useState, useRef, FormEvent, useEffect } from "react";
import { useMutation, useConvex, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { ConversionsList } from "../ConversionsList";

// Simple version without drag and drop
export function PdfMerger() {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const startPdfMergerConversion = useMutation(api.files.startPdfMergerConversion);
  const fileInput = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [lastConvertedPdf, setLastConvertedPdf] = useState<{ 
    url: string | null; 
    fileName: string | null;
    storageId: string | null;
  }>({ 
    url: null, 
    fileName: null,
    storageId: null
  });
  
  // Force refresh of conversions list
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const conversions = useQuery(api.files.listConversions, { 
    type: "pdf_merger" 
  });

  const MAX_FILES = 20;
  const MAX_FILE_SIZE_MB = 50;

  // Clear the success message after 10 minutes
  useEffect(() => {
    if (lastConvertedPdf.url) {
      const timer = setTimeout(() => {
        setLastConvertedPdf({ url: null, fileName: null, storageId: null });
      }, 10 * 60 * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [lastConvertedPdf]);

  async function handleFilesUpload(files: FileList | null) {
    if (!files || files.length === 0) {
      toast.error('Please select at least one PDF file');
      return;
    }

    // Filter for PDF files
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      toast.error('Please upload PDF files only');
      return;
    }

    // Check if adding these files would exceed the limit
    if (selectedFiles.length + pdfFiles.length > MAX_FILES) {
      toast.error(`You can select up to ${MAX_FILES} PDF files. Please remove some files.`);
      return;
    }

    // Check file sizes
    const oversizedFiles = pdfFiles.filter(file => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`Some files exceed the ${MAX_FILE_SIZE_MB}MB limit. Please select smaller files.`);
      return;
    }

    // Add new files to the list (avoid duplicates based on name and size)
    const newFiles = pdfFiles.filter(newFile => 
      !selectedFiles.some(existingFile => 
        existingFile.name === newFile.name && existingFile.size === newFile.size
      )
    );

    setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
  }

  async function handleMerge() {
    if (selectedFiles.length < 2) {
      toast.error('Please select at least two PDF files to merge');
      return;
    }

    setIsUploading(true);
    setUploadProgress({});
    setLastConvertedPdf({ url: null, fileName: null, storageId: null });
    
    try {
      // Upload all PDF files to Convex storage
      const storageIds = [];
      let totalUploaded = 0;
      
      // Create a toast for overall progress
      const progressToastId = toast.loading(`Uploading PDFs: 0/${selectedFiles.length}`);
      
      for (const [index, file] of selectedFiles.entries()) {
        // Update the progress toast
        toast.loading(`Uploading PDFs: ${index + 1}/${selectedFiles.length}`, { id: progressToastId });
        
        try {
          const postUrl = await generateUploadUrl();
          
          // Use XMLHttpRequest to track upload progress
          const uploadResult = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', postUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            
            // Track progress for this file
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(prev => ({
                  ...prev,
                  [file.name]: percentComplete
                }));
              }
            });
            
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const response = JSON.parse(xhr.responseText);
                  resolve(response.storageId);
                } catch (parseError) {
                  console.error('Error parsing response:', parseError);
                  reject(new Error('Failed to parse response'));
                }
              } else {
                console.error(`Upload failed with status: ${xhr.status}`);
                reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
              }
            };
            
            xhr.onerror = () => {
              reject(new Error('Network error during upload'));
            };
            xhr.send(file);
          });
          
          storageIds.push(uploadResult);
          totalUploaded++;
          
          // Update the progress toast
          toast.loading(`Uploading PDFs: ${totalUploaded}/${selectedFiles.length}`, { id: progressToastId });
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      // Update toast to show merging has started
      toast.loading('Merging PDF files...', { id: progressToastId });
      
      if (storageIds.length < 2) {
        toast.error('At least two PDF files need to be uploaded successfully', { id: progressToastId });
        setIsUploading(false);
        return;
      }

      // Generate a meaningful file name
      const fileName = `Merged_${selectedFiles.length}_PDFs_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      // Start server-side PDF merging
      const conversionId = await startPdfMergerConversion({
        sourceFileIds: storageIds,
        fileName: fileName
      });
      
      toast.success('PDFs uploaded and merge started', { id: progressToastId });
      
      // Force refresh the conversions list
      setRefreshTrigger(prev => prev + 1);
      
      // Get the conversion result after a delay to allow processing
      setTimeout(async () => {
        try {
          const conversion = await convex.query(api.files.getConversion, { conversionId });
          
          if (conversion && conversion.status === "completed" && conversion.pdfUrl) {
            setLastConvertedPdf({
              url: conversion.pdfUrl,
              fileName: fileName,
              storageId: conversion.pdfFileId || null
            });
          }
        } catch (error) {
          console.error("Error checking conversion status:", error);
        }
      }, 3000);
      
      setSelectedFiles([]);
    } catch (error) {
      console.error("Overall process failed:", error);
      toast.error('The merging process encountered an error');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload() {
    if (lastConvertedPdf.url && lastConvertedPdf.fileName) {
      const link = document.createElement('a');
      link.href = lastConvertedPdf.url;
      link.download = lastConvertedPdf.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  async function handleOpenInNewTab() {
    if (lastConvertedPdf.url) {
      window.open(lastConvertedPdf.url, '_blank');
    }
  }

  function handleRemoveFile(index: number) {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  }

  function handleRemoveAllFiles() {
    setSelectedFiles([]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFilesUpload(e.dataTransfer.files);
  }

  function handleChange(e: FormEvent<HTMLInputElement>) {
    const files = (e.target as HTMLInputElement).files;
    handleFilesUpload(files);
  }

  return (
    <div className="space-y-8">
      {/* File Upload Area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'}
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInput.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInput} 
          className="hidden" 
          onChange={handleChange} 
          accept="application/pdf" 
          multiple 
          disabled={isUploading}
        />
        <div className="flex flex-col items-center justify-center gap-4 py-4">
          <div className="bg-indigo-100 p-4 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-14 h-14 text-indigo-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Drop PDF files here to merge them</h3>
            <p className="text-gray-500 mt-2">or click to browse files from your computer</p>
            <div className="mt-3 bg-indigo-50 py-2 px-4 rounded-md inline-block">
              <p className="text-sm text-indigo-600 font-medium">Maximum {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each</p>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Selected Files ({selectedFiles.length})</h3>
            <button 
              className="text-sm text-red-500 hover:text-red-700"
              onClick={handleRemoveAllFiles}
              disabled={isUploading}
            >
              Remove All
            </button>
          </div>
          
          <div className="flex items-center bg-amber-50 border border-amber-200 rounded-md p-3 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-amber-700">
              Files will be merged in the order shown below. The first file will be the first page in the merged PDF.
            </p>
          </div>
          
          <div className="space-y-2 my-4">
            {selectedFiles.map((file, index) => (
              <div 
                key={`${file.name}-${file.size}-${index}`}
                className="border rounded-lg p-3 bg-white flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-medium">
                    {index + 1}
                  </div>
                  <div className="p-2 bg-indigo-100 rounded flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  {uploadProgress[file.name] !== undefined && uploadProgress[file.name] < 100 && (
                    <div className="w-24 bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full" 
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      ></div>
                    </div>
                  )}
                </div>
                <button 
                  className="text-gray-400 hover:text-red-500 ml-2 p-2 rounded-full hover:bg-red-50"
                  onClick={() => handleRemoveFile(index)}
                  disabled={isUploading}
                  aria-label="Remove file"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          
          {/* Prominent Merge Button */}
          <div className="mt-6 flex justify-center">
            <button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-8 rounded-lg font-medium text-lg shadow-md transition-colors w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleMerge}
              disabled={isUploading || selectedFiles.length < 2}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Merging...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                  </svg>
                  Merge PDFs
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {lastConvertedPdf.url && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-green-800">PDF Successfully Merged!</h3>
            <p className="text-green-700">{lastConvertedPdf.fileName}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="px-4 py-2 text-indigo-500 border border-indigo-500 rounded-md hover:bg-indigo-50"
            >
              View
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
            >
              Download
            </button>
          </div>
        </div>
      )}
      
      {/* Previous Conversions */}
      <div>
        <h3 className="font-semibold mb-4">Your Previous Merges</h3>
        <ConversionsList forceRefresh={refreshTrigger} type="pdf_merger" />
      </div>
    </div>
  );
} 