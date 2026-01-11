import { useState, useRef, FormEvent, useEffect } from "react";
import { useMutation, useConvex, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { convertImagesToPdf, getImageUrls, generatePdfFromImages, uploadPdf } from "../lib/generatePdf";
import { ConversionsList } from "../ConversionsList";

export function ImageToPdfUploader() {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const startImageToPdfConversion = useMutation(api.files.startImageToPdfConversion);
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
  
  // Automatically get conversions list
  const conversions = useQuery(api.files.listConversions, { type: "image_to_pdf" });

  const MAX_FILES = 50;
  const MAX_FILE_SIZE_MB = 10;

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
      toast.error('Please select at least one image');
      return;
    }

    // Filter for image files
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Please upload image files (JPEG, PNG, etc.)');
      return;
    }

    // Check if adding these files would exceed the limit
    if (selectedFiles.length + imageFiles.length > MAX_FILES) {
      toast.error(`You can select up to ${MAX_FILES} images. Please remove some files.`);
      return;
    }

    // Check file sizes
    const oversizedFiles = imageFiles.filter(file => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`Some files exceed the ${MAX_FILE_SIZE_MB}MB limit. Please select smaller files.`);
      return;
    }

    // Add new files to the list (avoid duplicates based on name and size)
    const newFiles = imageFiles.filter(newFile => 
      !selectedFiles.some(existingFile => 
        existingFile.name === newFile.name && existingFile.size === newFile.size
      )
    );

    setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
  }

  async function handleConversion() {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    setIsUploading(true);
    setUploadProgress({});
    setLastConvertedPdf({ url: null, fileName: null, storageId: null });
    
    try {
      // Upload all image files to Convex storage
      const storageIds = [];
      let totalUploaded = 0;
      
      // Create a toast for overall progress
      const progressToastId = toast.loading(`Uploading images: 0/${selectedFiles.length}`);
      
      for (const [index, file] of selectedFiles.entries()) {
        // Update the progress toast
        toast.loading(`Uploading images: ${index + 1}/${selectedFiles.length}`, { id: progressToastId });
        
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
                const response = JSON.parse(xhr.responseText);
                resolve(response.storageId);
              } else {
                reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
              }
            };
            
            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(file);
          });
          
          storageIds.push(uploadResult);
          totalUploaded++;
          
          // Update the progress toast
          toast.loading(`Uploading images: ${totalUploaded}/${selectedFiles.length}`, { id: progressToastId });
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      // Update toast to show conversion has started
      toast.loading('Converting images to PDF...', { id: progressToastId });
      
      if (storageIds.length === 0) {
        toast.error('No files were uploaded successfully', { id: progressToastId });
        setIsUploading(false);
        return;
      }

      // Generate a meaningful file name based on the number of images
      const fileName = selectedFiles.length === 1 
        ? `${selectedFiles[0].name.split('.')[0]}.pdf`
        : `Combined_${selectedFiles.length}_Images_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      // First try server-side conversion
      try {
        // This triggers server-side conversion and stores the result
        const conversionId = await startImageToPdfConversion({
          sourceFileIds: storageIds,
          fileName: fileName
        });
        
        toast.loading('Processing on server...', { id: progressToastId });
        
        // Wait a moment for the server to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force refresh the conversions list
        setRefreshTrigger(prev => prev + 1);
        
        // Get the conversion result
        const conversion = await convex.query(api.files.getConversion, { conversionId });
        
        if (conversion && conversion.status === "completed" && conversion.pdfUrl) {
          // Server-side conversion succeeded
          setLastConvertedPdf({
            url: conversion.pdfUrl,
            fileName: fileName,
            storageId: conversion.pdfFileId || null
          });
          
          toast.success('PDF successfully created and saved.', { id: progressToastId });
          setSelectedFiles([]);
          setIsUploading(false);
          return;
        }
        
        // If server-side failed or is still processing, fall back to client-side
        toast.loading('Falling back to client-side conversion...', { id: progressToastId });
      } catch (serverError) {
        console.error("Server-side conversion failed:", serverError);
        toast.loading('Falling back to client-side conversion...', { id: progressToastId });
      }
      
      // Client-side conversion as a fallback
      try {
        // Use the client-side conversion function
        toast.loading('Generating PDF in your browser...', { id: progressToastId });
        
        // Get image URLs
        const imageUrls = await getImageUrls(convex, storageIds);
        
        // Generate PDF from images
        const pdfBuffer = await generatePdfFromImages(imageUrls);
        
        // Upload the PDF
        const { storageId, url } = await uploadPdf(convex, pdfBuffer, fileName);
        
        // Update state with the new PDF info
        setLastConvertedPdf({
          url,
          fileName,
          storageId
        });
        
        // Update the conversion status in the database to mark it as complete
        // This is important since we're handling the conversion client-side
        try {
          await convex.mutation(api.files.updateConversionJob, {
            jobId: conversionId,
            pdfFileId: storageId,
            status: "completed"
          });
          
          // Force refresh the conversions list
          setRefreshTrigger(prev => prev + 1);
        } catch (updateError) {
          console.error("Failed to update conversion status:", updateError);
          // Continue anyway since we have the PDF
        }
        
        toast.success('PDF successfully created!', { id: progressToastId });
        setSelectedFiles([]);
      } catch (clientError) {
        console.error("Client-side conversion failed:", clientError);
        
        // Show a more detailed error message with debugging info
        const errorMessage = clientError instanceof Error 
          ? clientError.message 
          : 'Unknown error';
          
        // Try one more time with fewer images if we have many
        if (selectedFiles.length > 5) {
          toast.error(`Conversion failed: ${errorMessage}. Try converting fewer images at once.`, { id: progressToastId });
        } else {
          toast.error(`Conversion failed: ${errorMessage}`, { id: progressToastId });
        }
      }
    } catch (error) {
      console.error("Overall process failed:", error);
      toast.error('The conversion process encountered an error');
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

  function openFileDialog() {
    if (fileInput.current) {
      fileInput.current.click();
    }
  }

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

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
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-secondary-100/40 rounded-full filter blur-xl"></div>
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-primary-100/40 rounded-full filter blur-xl"></div>
        </div>
        
        <div className="relative">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
            multiple
          />
          
          <div className="max-w-xs mx-auto">
            <div className="mb-6 bg-white shadow-sm p-5 rounded-lg border border-gray-100 transform transition-transform duration-300 hover:scale-105">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-secondary-100 to-secondary-50 rounded-lg flex items-center justify-center border border-secondary-200">
                <svg
                  className="w-10 h-10 text-secondary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {isUploading ? "Uploading..." : "Drop your images here"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              or click to select images to convert to PDF
            </p>
            <div className="flex justify-center items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center">
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span>Max: {MAX_FILES} files</span>
              </div>
              <div className="flex items-center">
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
                <span>Max: {MAX_FILE_SIZE_MB}MB each</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Files List with enhanced UI */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-soft p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-primary-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Selected Images</h3>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleRemoveAllFiles}
                className="py-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-md flex items-center transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove All
              </button>
              <button
                onClick={handleConversion}
                disabled={isUploading}
                className="py-1 px-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md flex items-center shadow-sm hover:shadow transition-all"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Convert to PDF
              </button>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="bg-gray-50 rounded-lg p-3 border border-gray-100 relative group hover:border-primary-200 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-white shadow-sm rounded flex items-center justify-center">
                      {file.type.includes('image/') ? (
                        <svg className="w-6 h-6 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="w-6 h-6 rounded-full bg-white hover:bg-gray-200 text-gray-400 hover:text-gray-600 flex items-center justify-center shadow-sm transform transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              
                {/* Upload Progress */}
                {isUploading && uploadProgress[file.name] !== undefined && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-primary-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 text-right mt-1">{uploadProgress[file.name]}%</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{selectedFiles.length}</span> {selectedFiles.length === 1 ? 'image' : 'images'} selected
            </div>
            <button
              onClick={handleConversion}
              disabled={isUploading}
              className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm transition-all duration-300 hover:shadow flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Create PDF Now
            </button>
          </div>
        </div>
      )}

      {/* Result Section (with enhanced UI) */}
      {lastConvertedPdf.url && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-soft p-6 animate-fade-in">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">PDF Created Successfully!</h3>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-5 border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-white rounded shadow-sm mr-3">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate">{lastConvertedPdf.fileName}</h4>
                <p className="text-xs text-gray-500">PDF Document</p>
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
              Download PDF
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
        <ConversionsList forceRefresh={refreshTrigger} type="image_to_pdf" />
      </div>
    </div>
  );
} 