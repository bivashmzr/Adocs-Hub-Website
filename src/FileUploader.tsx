import { FormEvent, useRef, useState, useEffect } from "react";
import { useMutation, useConvex, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { ConversionsList } from "./ConversionsList";

interface FileUploaderProps {
  type: "pdf_to_word" | "image_to_pdf";
}

export function FileUploader({ type }: FileUploaderProps) {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const startConversion = useMutation(api.files.startConversion);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeToastId = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastConvertedFile, setLastConvertedFile] = useState<{
    url: string | null;
    fileName: string | null;
    storageId: string | null;
    conversionId: string | null;
  }>({
    url: null,
    fileName: null,
    storageId: null,
    conversionId: null
  });

  // Force refresh of conversions list
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Automatically get conversions list
  const conversions = useQuery(api.files.listConversions, { type });

  // Poll for conversion status if we have a pending conversion
  useEffect(() => {
    if (!lastConvertedFile.conversionId) return;
    
    const checkStatus = async () => {
      try {
        const conversion = await convex.query(api.files.getConversion, { 
          conversionId: lastConvertedFile.conversionId 
        });
        
        if (conversion && conversion.status === "completed" && conversion.docxUrl) {
          setLastConvertedFile(prev => ({
            ...prev,
            url: conversion.docxUrl
          }));
          
          // Update toast if one is active
          if (activeToastId.current) {
            toast.success('PDF converted to Word successfully!', { id: activeToastId.current });
            activeToastId.current = null;
          }
          
          // Stop checking once completed
          return true;
        } else if (conversion && conversion.status === "failed") {
          // Handle failed conversion
          if (activeToastId.current) {
            toast.error('Conversion failed on the server. Please try again.', { id: activeToastId.current });
            activeToastId.current = null;
          }
          return true;
        }
        // Continue checking if still processing
        return false;
      } catch (error) {
        console.error("Error checking conversion status:", error);
        return true; // Stop on error
      }
    };
    
    // Check immediately
    checkStatus().then(done => {
      if (!done) {
        // Set up interval to check every 3 seconds
        const interval = setInterval(async () => {
          const done = await checkStatus();
          if (done) clearInterval(interval);
        }, 3000);
        
        // Clean up interval
        return () => clearInterval(interval);
      }
    });
  }, [lastConvertedFile.conversionId, convex]);

  // Clear the success message after 10 minutes
  useEffect(() => {
    if (lastConvertedFile.url) {
      const timer = setTimeout(() => {
        setLastConvertedFile({ 
          url: null, 
          fileName: null, 
          storageId: null, 
          conversionId: null 
        });
      }, 10 * 60 * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [lastConvertedFile]);

  async function handleFileUpload(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    setLastConvertedFile({ 
      url: null, 
      fileName: null, 
      storageId: null, 
      conversionId: null 
    });
    
    // Show a progress toast
    const progressToastId = toast.loading('Uploading PDF...');
    activeToastId.current = progressToastId;
    
    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.status} ${result.statusText}`);
      }
      
      const { storageId } = await result.json();
      
      toast.loading('Starting conversion...', { id: progressToastId });
      
      // Start the conversion
      const conversionId = await startConversion({ 
        pdfFileId: storageId,
        fileName: file.name
      });
      
      toast.loading('Converting PDF to Word...', { id: progressToastId });
      
      // Save conversion info and trigger refresh
      setLastConvertedFile({
        fileName: file.name,
        storageId: storageId,
        url: null, // Will be set when conversion completes
        conversionId: conversionId
      });
      
      // Force refresh of conversions list
      setRefreshTrigger(prev => prev + 1);
      
      // Wait a bit to see if conversion completes quickly
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get updated conversion status
      const conversion = await convex.query(api.files.getConversion, { 
        conversionId: conversionId 
      });
      
      if (conversion && conversion.status === "completed" && conversion.docxUrl) {
        // Conversion completed quickly
        setLastConvertedFile(prev => ({
          ...prev,
          url: conversion.docxUrl
        }));
        toast.success('PDF converted to Word successfully!', { id: progressToastId });
      } else {
        // Conversion is still processing
        toast.success('PDF uploaded. Converting to Word...', { id: progressToastId });
        // Polling will update UI when finished
      }
    } catch (error) {
      console.error("Error during upload/conversion:", error);
      toast.error('Upload or conversion failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: progressToastId });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload() {
    if (!lastConvertedFile.url || !lastConvertedFile.fileName) {
      toast.error("No Word document available for download");
      return;
    }

    try {
      // Show download toast
      const toastId = toast.loading("Preparing download...");
      
      // Fetch the file to ensure it's complete
      const response = await fetch(lastConvertedFile.url);
      
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
      
      // Set the filename, ensuring it has .docx extension
      let fileName = lastConvertedFile.fileName;
      if (!fileName.toLowerCase().endsWith('.docx')) {
        fileName = fileName.replace(/\.[^.]+$/, '') + '.docx';
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleChange(e: FormEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (file) handleFileUpload(file);
  }

  function openFileDialog() {
    if (fileInput.current) {
      fileInput.current.click();
    }
  }

  async function handleOpenInNewTab() {
    if (lastConvertedFile.url) {
      window.open(lastConvertedFile.url, '_blank');
    } else {
      toast.error("No converted document available to view");
    }
  }

  return (
    <div className="space-y-8">
      {/* Enhanced File Upload Area */}
      <div 
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/50'}
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary-100/40 rounded-full filter blur-xl"></div>
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-secondary-100/40 rounded-full filter blur-xl"></div>
        </div>
        
        <div className="relative">
          <input
            ref={fileInput}
            type="file"
            accept=".pdf"
            onChange={handleChange}
            className="hidden"
          />
          
          <div className="max-w-xs mx-auto">
            <div className="mb-6 bg-white shadow-sm p-5 rounded-lg border border-gray-100 transform transition-transform duration-300 hover:scale-105">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-100 to-primary-50 rounded-lg flex items-center justify-center border border-primary-200">
                <svg
                  className="w-10 h-10 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {isUploading ? "Uploading..." : "Drop your PDF file here"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              or click to select a PDF file to convert to Word
            </p>
            <div className="flex justify-center items-center text-xs text-gray-500">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Max size: 50MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Result Section (with enhanced UI) */}
      {lastConvertedFile.url && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-soft p-6 animate-fade-in">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Conversion Successful!</h3>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-5 border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-white rounded shadow-sm mr-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate">{lastConvertedFile.fileName}</h4>
                <p className="text-xs text-gray-500">Word Document (.docx)</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
            <button
              onClick={handleDownload}
              className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm transition-all duration-300 hover:shadow flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Word Document
            </button>
            <button
              onClick={handleOpenInNewTab}
              className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg shadow-sm transition-all duration-300 hover:shadow flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in New Tab
            </button>
          </div>
        </div>
      )}

      {/* Conversion History Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-soft p-6">
        <div className="flex items-center mb-5">
          <svg className="w-5 h-5 text-primary-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-800">Conversion History</h3>
        </div>
        <ConversionsList forceRefresh={refreshTrigger} type={type} />
      </div>
    </div>
  );
}
