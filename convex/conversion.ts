"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { ConvexError } from "convex/values";
// Image to PDF libraries
import PDFDocument from 'pdfkit';
// @ts-ignore
import * as CloudmersiveConvertApiClient from 'cloudmersive-convert-api-client';
// @ts-ignore
import { jsPDF } from 'jspdf';
// Adding PDF-lib for PDF operations
// @ts-ignore
import { PDFDocument as PDFLib } from 'pdf-lib';

const cloudmersiveClient = {
  async convertDocumentPdfToDocx(pdfUrl: string, apiKey: string) {
    const response = await fetch('https://api.cloudmersive.com/convert/pdf/to/docx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Apikey': apiKey
      },
      body: JSON.stringify({
        InputUrl: pdfUrl
      })
    });

    if (!response.ok) {
      throw new Error(`Cloudmersive API error: ${response.status} ${response.statusText}`);
    }

    const docxBuffer = await response.arrayBuffer();
    return {
      success: true,
      data: docxBuffer
    };
  }
};

export const convertPdfToWord = action({
  args: {
    conversionId: v.id("conversions"),
  },
  handler: async (ctx, args) => {
    try {
      // Get the conversion record
      const conversion = await ctx.runQuery(api.files.getConversion, { 
        conversionId: args.conversionId 
      });
      if (!conversion) {
        throw new Error("Conversion not found");
      }

      console.log("Starting conversion for:", conversion.fileName);

      // Verify API key is set
      const apiKey = process.env.CLOUDMERSIVE_API_KEY;
      if (!apiKey) {
        throw new Error("Cloudmersive API key not found in environment variables");
      }
      console.log("API Key found:", apiKey.substring(0, 8) + "...");

      // Download the PDF file
      if (!conversion.pdfFileId) {
        throw new Error("PDF file ID is missing");
      }
      const pdfUrl = await ctx.storage.getUrl(conversion.pdfFileId);
      if (!pdfUrl) {
        throw new Error("PDF file not found");
      }

      console.log("Downloading PDF from:", pdfUrl);

      // Download the PDF
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
      }
      const pdfBuffer = await pdfResponse.arrayBuffer();

      console.log("PDF downloaded, size:", pdfBuffer.byteLength, "bytes");

      // Setup Cloudmersive client
      const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
      const Apikey = defaultClient.authentications['Apikey'];
      Apikey.apiKey = apiKey;
      const apiInstance = new CloudmersiveConvertApiClient.ConvertDocumentApi();

      console.log("Converting PDF to Word...");

      // Convert PDF to DOCX
      const result = await new Promise<Buffer>((resolve, reject) => {
        apiInstance.convertDocumentPdfToDocx(Buffer.from(pdfBuffer), (error: Error | null, data: Buffer) => {
          if (error) {
            console.error("Cloudmersive API error:", error);
            reject(error);
          } else {
            console.log("Conversion successful, result size:", data.length, "bytes");
            resolve(data);
          }
        });
      });

      console.log("Storing converted file...");

      // Create a Blob with the correct content type
      const docxBlob = new Blob([Buffer.from(result)], { 
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
      });

      // Store the converted file
      const docxBytes = await ctx.storage.store(docxBlob);

      console.log("File stored with ID:", docxBytes);

      // Update the conversion record
      await ctx.runMutation(api.files.markConversionComplete, {
        conversionId: args.conversionId,
        success: true,
        docxFileId: docxBytes,
      });

      console.log("Conversion completed successfully");
      return docxBytes;

    } catch (error) {
      console.error("Conversion failed with error:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
      await ctx.runMutation(api.files.markConversionComplete, {
        conversionId: args.conversionId,
        success: false,
      });
      throw error;
    }
  },
});

// Simplified PDFKit helper that focuses on reliability
const createPdfWithImages = async (imageBuffers: Buffer[], imageTypes?: string[]): Promise<Buffer> => {
  console.log(`Creating PDF with ${imageBuffers.length} images using PDFKit`);
  
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document with font handling disabled to avoid filesystem dependencies
      const doc = new PDFDocument({ 
        autoFirstPage: false, // We'll add pages manually 
        margin: 0,
        pdfVersion: '1.7', // Explicitly set PDF version for better compatibility
        font: '', // Disable default font loading by using empty string
        info: {
          Title: `Image Collection - ${new Date().toISOString().split('T')[0]}`,
          Author: 'AdocsHub',
          Subject: 'Image to PDF Conversion',
          Keywords: 'images, pdf, conversion',
          Creator: 'AdocsHub Image to PDF Converter',
          Producer: 'PDFKit'
        }
      });
      
      // Collect chunks as they are generated
      const chunks: Buffer[] = [];
      
      // Listen for events
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        console.log(`PDF generation completed, total chunks: ${chunks.length}`);
        const finalBuffer = Buffer.concat(chunks);
        console.log(`Final PDF size: ${finalBuffer.length} bytes`);
        resolve(finalBuffer);
      });
      doc.on('error', err => {
        console.error('PDFKit error:', err);
        reject(err);
      });
      
      // Log document settings
      console.log(`PDF document initialized with pageWidth=${doc.page ? doc.page.width : 'N/A'}, pageHeight=${doc.page ? doc.page.height : 'N/A'}`);
      
      // Process each image - IMPORTANT: manually add pages one by one
      for (let i = 0; i < imageBuffers.length; i++) {
        try {
          const imageBuffer = imageBuffers[i];
          const imageType = imageTypes?.[i] || 'image/jpeg';
          console.log(`Adding image ${i + 1}/${imageBuffers.length} to PDF (${imageType}), buffer size: ${imageBuffer.length} bytes`);
          
          // Add a new page for each image (A4 size)
          // The size is important - use points (72 points = 1 inch)
          // A4 is 8.27 × 11.69 inches = 595 × 842 points
          doc.addPage({ size: [595, 842], margin: 0 });
          
          // Get page dimensions
          const pageWidth = doc.page.width;
          const pageHeight = doc.page.height;
          console.log(`Page ${i + 1} dimensions: ${pageWidth}×${pageHeight} points`);
          
          // Define margins (0.5 inch on all sides)
          const margin = 36;
          
          // Calculate available space
          const availableWidth = pageWidth - (2 * margin);
          const availableHeight = pageHeight - (2 * margin);
          
          // Instead of using fit which might cause issues, manually position and size the image
          try {
            // Calculate image position - centered with margins
            console.log(`Placing image ${i + 1} at position x=${margin}, y=${margin} with max dimensions ${availableWidth}×${availableHeight}`);
            
            // Use explicit coordinates and dimensions for reliable placement
            doc.image(imageBuffer, margin, margin, {
              width: availableWidth,
              height: availableHeight,
              fit: [availableWidth, availableHeight], // This ensures the image is scaled properly
              align: 'center',
              valign: 'center'
            });
            
            console.log(`Successfully added image ${i + 1} to page ${i + 1}`);
          } catch (imageErr) {
            // If the standard approach fails, try an alternative method
            console.error(`Error adding image ${i + 1} using standard method:`, imageErr);
            
            try {
              // Alternative approach: simplified placement
              doc.image(imageBuffer, margin, margin, {
                fit: [availableWidth, availableHeight]
              });
              console.log(`Successfully added image ${i + 1} using fallback method`);
            } catch (fallbackErr) {
              console.error(`Fallback method also failed for image ${i + 1}:`, fallbackErr);
              // Add text instead of the image to indicate failure
              doc.fontSize(14).fillColor('red')
                .text(`[Image ${i + 1} could not be added to the PDF]`, 
                      margin, pageHeight/2, { width: availableWidth, align: 'center' });
            }
          }
          
          // Add page number at the bottom
          doc.fontSize(10)
             .fillColor('#999999')
             .text(`Page ${i + 1} of ${imageBuffers.length}`, 
                   0, pageHeight - 25, 
                   { align: 'center' });
          
          console.log(`Completed page ${i + 1}`);
        } catch (err) {
          console.error(`Error processing page ${i + 1}:`, err);
          // Continue with next image even if one fails
        }
      }
      
      // Add some metadata
      doc.info.CreationDate = new Date();
      
      // Finalize the PDF - this triggers the 'end' event
      console.log(`Finalizing PDF with ${imageBuffers.length} pages`);
      doc.end();
      
    } catch (err) {
      console.error(`Error creating PDF:`, err);
      reject(err);
    }
  });
};

// Cloudmersive API approach for image to PDF conversion
const convertImagesWithApi = async (apiKey: string, imageBuffers: Buffer[]): Promise<Buffer> => {
  console.log(`Converting ${imageBuffers.length} images to PDF using Cloudmersive API`);
  
  try {
    // Set up the API client
    const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
    const Apikey = defaultClient.authentications['Apikey'];
    Apikey.apiKey = apiKey;
    
    // Create individual PDFs for each image
    const pdfPages: Buffer[] = [];
    
    for (let i = 0; i < imageBuffers.length; i++) {
      console.log(`Converting image ${i + 1}/${imageBuffers.length} to PDF page`);
      
      // Correct instantiation and method call
      const imageApi = new CloudmersiveConvertApiClient.ConvertImageApi();
      const singleImagePdf = await new Promise<Buffer>((resolve, reject) => {
        // Check if the function exists before calling it
        if (typeof imageApi.imageCreatePdfFromImage === 'function') {
          imageApi.imageCreatePdfFromImage(imageBuffers[i], (error: Error | null, data: Buffer) => {
            if (error) {
              console.error(`Error converting image ${i} to PDF:`, error);
              reject(error);
            } else {
              console.log(`Successfully converted image ${i + 1} to PDF, size: ${data.length} bytes`);
              resolve(data);
            }
          });
        } else if (typeof imageApi.convertImageImageToPdf === 'function') {
          imageApi.convertImageImageToPdf(imageBuffers[i], (error: Error | null, data: Buffer) => {
            if (error) {
              console.error(`Error converting image ${i} to PDF:`, error);
              reject(error);
            } else {
              console.log(`Successfully converted image ${i + 1} to PDF, size: ${data.length} bytes`);
              resolve(data);
            }
          });
        } else {
          reject(new Error('No appropriate Cloudmersive API method found for image to PDF conversion'));
        }
      });
      
      pdfPages.push(singleImagePdf);
    }
    
    // If only one image, return its PDF directly
    if (pdfPages.length === 1) {
      return pdfPages[0];
    }
    
    // Merge all PDFs together
    console.log(`Merging ${pdfPages.length} PDFs with Cloudmersive`);
    
    // Create request object properly
    const mergeRequest = {
      InputFile1: pdfPages[0]
    };
    
    // If we have more than 2 pages, handle them properly
    if (pdfPages.length > 2) {
      // For more than 2 files, we use mergeDocumentPdfMulti
      const mergeApi = new CloudmersiveConvertApiClient.MergeDocumentApi();
      const mergedPdf = await new Promise<Buffer>((resolve, reject) => {
        // We need to pass an array of files for multi-merge
        mergeApi.mergeDocumentPdfMulti({
          InputFile1: pdfPages[0],
          InputFile2: pdfPages[1],
          InputFile3: pdfPages.length > 2 ? pdfPages[2] : undefined,
          InputFile4: pdfPages.length > 3 ? pdfPages[3] : undefined,
          InputFile5: pdfPages.length > 4 ? pdfPages[4] : undefined,
          InputFile6: pdfPages.length > 5 ? pdfPages[5] : undefined,
          InputFile7: pdfPages.length > 6 ? pdfPages[6] : undefined,
          InputFile8: pdfPages.length > 7 ? pdfPages[7] : undefined,
          InputFile9: pdfPages.length > 8 ? pdfPages[8] : undefined,
          InputFile10: pdfPages.length > 9 ? pdfPages[9] : undefined
        }, (error: Error | null, data: Buffer) => {
          if (error) {
            console.error('Error merging PDFs:', error);
            reject(error);
          } else {
            console.log(`Successfully merged ${Math.min(pdfPages.length, 10)} PDFs, size: ${data.length} bytes`);
            resolve(data);
          }
        });
      });
      
      // If we have more than 10 pages, merge them in batches
      if (pdfPages.length > 10) {
        console.log('More than 10 PDFs, merging in batches');
        let currentPdf = mergedPdf;
        
        // Process remaining PDFs in batches of 9 (plus the current merged PDF)
        for (let i = 10; i < pdfPages.length; i += 9) {
          const batch = pdfPages.slice(i, i + 9);
          console.log(`Processing batch of ${batch.length} PDFs (${i}-${i + batch.length - 1})`);
          
          currentPdf = await new Promise<Buffer>((resolve, reject) => {
            mergeApi.mergeDocumentPdfMulti({
              InputFile1: currentPdf,
              InputFile2: batch[0],
              InputFile3: batch.length > 1 ? batch[1] : undefined,
              InputFile4: batch.length > 2 ? batch[2] : undefined,
              InputFile5: batch.length > 3 ? batch[3] : undefined,
              InputFile6: batch.length > 4 ? batch[4] : undefined,
              InputFile7: batch.length > 5 ? batch[5] : undefined,
              InputFile8: batch.length > 6 ? batch[6] : undefined,
              InputFile9: batch.length > 7 ? batch[7] : undefined,
              InputFile10: batch.length > 8 ? batch[8] : undefined
            }, (error: Error | null, data: Buffer) => {
              if (error) {
                console.error(`Error merging batch ${i}-${i + batch.length - 1}:`, error);
                reject(error);
              } else {
                console.log(`Successfully merged batch ${i}-${i + batch.length - 1}, size: ${data.length} bytes`);
                resolve(data);
              }
            });
          });
        }
        
        return currentPdf;
      }
      
      return mergedPdf;
    } else if (pdfPages.length === 2) {
      // For exactly 2 files, we can use mergeDocumentPdf
      const mergeApi = new CloudmersiveConvertApiClient.MergeDocumentApi();
      return await new Promise<Buffer>((resolve, reject) => {
        mergeApi.mergeDocumentPdf(pdfPages[0], pdfPages[1], (error: Error | null, data: Buffer) => {
          if (error) {
            console.error('Error merging 2 PDFs:', error);
            reject(error);
          } else {
            console.log(`Successfully merged 2 PDFs, size: ${data.length} bytes`);
            resolve(data);
          }
        });
      });
    }
    
    // This should never happen as we've handled all cases
    throw new Error('Invalid PDF merge state');
  } catch (error) {
    console.error('Error in convertImagesWithApi:', error);
    throw error;
  }
};

// Simple PDF generation that doesn't rely on fonts
const createSimplePdf = async (imageBuffers: Buffer[], imageTypes?: string[]): Promise<Buffer> => {
  console.log(`Creating basic PDF with ${imageBuffers.length} images`);
  
  // Create a simple PDF with minimal header
  const pdfHeader = Buffer.from('%PDF-1.7\n');
  const pdfFooter = Buffer.from('\n%%EOF\n');
  
  // Object ID counter
  let objectId = 1;
  
  // Create objects array to track all PDF objects
  const objects: { id: number; offset: number; buffer: Buffer }[] = [];
  
  // Create a catalog object
  const catalogObj = Buffer.from(
    `${objectId} 0 obj\n<<\n/Type /Catalog\n/Pages ${objectId + 1} 0 R\n>>\nendobj\n`
  );
  objects.push({ id: objectId++, offset: pdfHeader.length, buffer: catalogObj });
  
  // Page IDs will start from objectId+1 (after Pages object)
  const pageIds: number[] = [];
  for (let i = 0; i < imageBuffers.length; i++) {
    pageIds.push(objectId + 1 + i * 2); // Each page needs 2 objects (page and image)
  }
  
  // Create Pages object with references to all pages
  const pagesObj = Buffer.from(
    `${objectId} 0 obj\n<<\n/Type /Pages\n/Count ${imageBuffers.length}\n/Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}]\n>>\nendobj\n`
  );
  objects.push({ id: objectId++, offset: pdfHeader.length + catalogObj.length, buffer: pagesObj });
  
  // Create page and image objects for each image
  let currentOffset = pdfHeader.length + catalogObj.length + pagesObj.length;
  
  for (let i = 0; i < imageBuffers.length; i++) {
    const pageObjId = objectId++;
    const imageObjId = objectId++;
    
    // Add image object (using raw image data with simple filter)
    const imageType = imageTypes?.[i] || 'image/jpeg';
    // Note: this is an oversimplification - real PDF images need proper encoding
    // This just demonstrates the structure
    const imageObj = Buffer.from(
      `${imageObjId} 0 obj\n<<\n/Type /XObject\n/Subtype /Image\n/Width 600\n/Height 800\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Filter /DCTDecode\n/Length ${imageBuffers[i].length}\n>>\nstream\n`
    );
    
    // Create page object pointing to the image object
    const pageObj = Buffer.from(
      `${pageObjId} 0 obj\n<<\n/Type /Page\n/Parent ${objectId - imageBuffers.length * 2 - 1} 0 R\n/MediaBox [0 0 595 842]\n/Contents ${imageObjId} 0 R\n>>\nendobj\n`
    );
    
    objects.push({ id: pageObjId, offset: currentOffset, buffer: pageObj });
    currentOffset += pageObj.length;
    
    // The image object with stream needs to include the image data
    const imageDataObj = Buffer.concat([
      imageObj,
      imageBuffers[i],
      Buffer.from('\nendstream\nendobj\n')
    ]);
    
    objects.push({ id: imageObjId, offset: currentOffset, buffer: imageDataObj });
    currentOffset += imageDataObj.length;
  }
  
  // Create xref table
  const xrefOffset = currentOffset;
  let xrefTable = `xref\n0 ${objects.length + 1}\n0000000000 65535 f\n`;
  
  objects.forEach(obj => {
    // Pad offset to 10 digits
    xrefTable += `${obj.offset.toString().padStart(10, '0')} 00000 n\n`;
  });
  
  // Create trailer
  const trailer = `trailer\n<<\n/Size ${objects.length + 1}\n/Root 1 0 R\n>>\nstartxref\n${xrefOffset}\n`;
  
  // Combine all parts
  const pdfParts = [
    pdfHeader,
    ...objects.map(obj => obj.buffer),
    Buffer.from(xrefTable),
    Buffer.from(trailer),
    pdfFooter
  ];
  
  return Buffer.concat(pdfParts);
};

// jsPDF approach for more reliable PDF generation
const createPdfWithJsPdf = async (imageBuffers: Buffer[], imageTypes?: string[]): Promise<Buffer | null> => {
  console.log(`Creating PDF with ${imageBuffers.length} images using jsPDF`);
  
  try {
    // Create new PDF document (A4 size)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10; // margin in mm
    
    // Calculate available area
    const availableWidth = pageWidth - (2 * margin);
    const availableHeight = pageHeight - (2 * margin);
    
    // Process each image
    for (let i = 0; i < imageBuffers.length; i++) {
      // Add new page for each image except the first one
      if (i > 0) {
        doc.addPage();
      }
      
      try {
        // Convert image buffer to base64 data URL
        const imageType = imageTypes?.[i] || 'image/jpeg';
        const mimeType = imageType.includes('png') ? 'image/png' : 
                        imageType.includes('webp') ? 'image/webp' : 'image/jpeg';
        const base64Image = `data:${mimeType};base64,${imageBuffers[i].toString('base64')}`;
        
        // Add image to the PDF (centered with margins)
        doc.addImage(
          base64Image, 
          mimeType.split('/')[1].toUpperCase(), 
          margin, 
          margin, 
          availableWidth, 
          availableHeight, 
          `img${i}`, 
          'FAST'
        );
        
        // Add page number at the bottom
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i + 1} of ${imageBuffers.length}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        
        console.log(`Successfully added image ${i + 1} to PDF using jsPDF`);
      } catch (err) {
        console.error(`Error adding image ${i + 1} to PDF with jsPDF:`, err);
        // Continue with next image even if one fails
      }
    }
    
    // Convert the PDF to ArrayBuffer and then to Node.js Buffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    
    // Basic validation of PDF file
    if (pdfBuffer.length < 1000) {
      console.error(`PDF file seems too small (${pdfBuffer.length} bytes), might be corrupt`);
      // Return null instead of trying to reassign
      return null;
    }

    return pdfBuffer;
  } catch (error) {
    console.error("Error in createPdfWithJsPdf:", error);
    return null;
  }
};

// Change from internalAction back to action for public API access
export const convertImagesToPdf = action({
  args: {
    conversionId: v.id("conversions"),
  },
  handler: async (ctx, args) => {
    const conversion = await ctx.runQuery(api.files.getConversionJob, {
      conversionId: args.conversionId,
    });
    
    if (!conversion || conversion.type !== "image_to_pdf") {
      console.error("Invalid conversion job");
      throw new ConvexError("Invalid conversion job");
    }
    
    try {
      // Get URLs for all source images
      const urls = await Promise.all(
        conversion.sourceFileIds?.map((id) => 
          ctx.storage.getUrl(id)
        ) || []
      );
      
      if (urls.length === 0) {
        throw new ConvexError("No source images found");
      }
      
      // Convert images to PDF (you must implement this logic yourself)
      const pdfBuffer = await convertImagesToPdfBuffer(urls);
      
      // Upload PDF to storage
      const uploadUrl = await ctx.storage.generateUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: new Blob([pdfBuffer], { type: "application/pdf" }),
      });
      const { storageId } = await uploadRes.json();
      
      // Update job as complete
      await ctx.runMutation(api.files.updateConversionJob, {
        jobId: args.conversionId,
        pdfFileId: storageId,
        status: "completed",
      });
      
      return storageId;
    } catch (err: any) {
      console.error("Image to PDF conversion failed:", err);
      await ctx.runMutation(api.files.updateConversionJob, {
        jobId: args.conversionId,
        status: "failed",
        error: err.message || "Unknown error",
      });
      throw err;
    }
  },
});

// Add a helper function to convert images to PDF
async function convertImagesToPdfBuffer(urls: (string | null)[]): Promise<ArrayBuffer> {
  console.log(`Converting ${urls.length} images to PDF`);
  
  // Filter out null URLs
  const validUrls = urls.filter(Boolean) as string[];
  
  if (validUrls.length === 0) {
    throw new Error("No valid image URLs to convert");
  }
  
  try {
    // Approach 1: Use Cloudmersive API if available
    const apiKey = process.env.CLOUDMERSIVE_API_KEY;
    if (apiKey) {
      try {
        console.log("Attempting to use Cloudmersive API");
        return await convertWithCloudmersive(validUrls, apiKey);
      } catch (error) {
        console.error("Cloudmersive conversion failed:", error);
        // Fall back to other methods
      }
    }
    
    // Approach 2: Try using PDFKit library
    try {
      console.log("Attempting to use PDFKit");
      return await convertWithPdfKit(validUrls);
    } catch (error) {
      console.error("PDFKit conversion failed:", error);
      // Fall back to simple PDF
    }
    
    // Basic fallback approach
    console.log("Using fallback PDF generation");
    return createSimplePdfFromUrls(validUrls);
  } catch (error) {
    console.error("All PDF generation methods failed:", error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Implementation for Cloudmersive API
async function convertWithCloudmersive(urls: string[], apiKey: string): Promise<ArrayBuffer> {
  const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
  const Apikey = defaultClient.authentications['Apikey'];
  Apikey.apiKey = apiKey;
  
  // Download images first
  const imageBuffers = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      return new Uint8Array(await response.arrayBuffer());
    })
  );
  
  // Use Cloudmersive to convert to PDF
  const imageApi = new CloudmersiveConvertApiClient.ConvertImageApi();
  
  if (imageBuffers.length === 1) {
    // Single image conversion
    return new Promise((resolve, reject) => {
      imageApi.convertImageImageToPdf(Buffer.from(imageBuffers[0]), (error: Error | null, data: Buffer) => {
        if (error) {
          reject(error);
        } else {
          resolve(data.buffer);
        }
      });
    });
  } else {
    // Multiple image conversion
    throw new Error("Multiple image conversion with Cloudmersive not implemented");
  }
}

// Implementation for PDFKit
async function convertWithPdfKit(urls: string[]): Promise<ArrayBuffer> {
  // Download the images
  const images = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        type: response.headers.get('content-type') || 'image/jpeg'
      };
    })
  );
  
  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({
        autoFirstPage: false,
        margin: 0,
        font: '', // Empty string to avoid font loading issues
      });
      
      // Collect chunks
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Add each image to a page
      for (const image of images) {
        doc.addPage({ margin: 0 });
        doc.image(image.buffer, 0, 0, {
          fit: [doc.page.width, doc.page.height],
          align: 'center',
          valign: 'center'
        });
      }
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Simple fallback method
function createSimplePdfFromUrls(urls: string[]): Promise<ArrayBuffer> {
  console.log("Creating simple PDF from URLs as last resort fallback");
  
  // Create a very simple PDF with just text
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  
  return new Promise<ArrayBuffer>((resolve, reject) => {
    (async () => {
      try {
        // Create a new PDFDocument
        const pdfDoc = await PDFDocument.create();
        
        // Add a cover page
        const page = pdfDoc.addPage();
        
        // Get the font
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        // Get the page dimensions
        const { width, height } = page.getSize();
        
        // Draw the title
        page.drawText('PDF Document', {
          x: 50,
          y: height - 100,
          size: 28,
          font: font,
          color: rgb(0, 0, 0),
        });
        
        // Add information about the images
        page.drawText(`Contains ${urls.length} image${urls.length !== 1 ? 's' : ''}`, {
          x: 50,
          y: height - 150,
          size: 14,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
        });
        
        page.drawText(`Generated on ${new Date().toLocaleDateString()}`, {
          x: 50,
          y: height - 180,
          size: 14,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
        });
        
        // Add a note about the fallback
        page.drawText('Note: Server-side image embedding failed.', {
          x: 50,
          y: height - 230,
          size: 12,
          font: font,
          color: rgb(0.8, 0.2, 0.2),
        });
        
        page.drawText('Please try client-side conversion instead.', {
          x: 50,
          y: height - 250,
          size: 12,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        // Add image URLs as text for reference
        const imageUrlsPage = pdfDoc.addPage();
        
        imageUrlsPage.drawText('Image References:', {
          x: 50,
          y: height - 70,
          size: 14,
          font: font,
          color: rgb(0, 0, 0),
        });
        
        let yPosition = height - 100;
        
        // List the URLs (truncated if necessary)
        for (let i = 0; i < urls.length && i < 30; i++) {
          const url = urls[i];
          const displayUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
          
          imageUrlsPage.drawText(`${i + 1}. ${displayUrl}`, {
            x: 50,
            y: yPosition,
            size: 8,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
          });
          
          yPosition -= 15;
          
          // If we're running out of space, add a note and stop
          if (yPosition < 50) {
            imageUrlsPage.drawText(`... and ${urls.length - i - 1} more`, {
              x: 50,
              y: 30,
              size: 10,
              font: font,
              color: rgb(0.5, 0.5, 0.5),
            });
            break;
          }
        }
        
        // Serialize the PDFDocument to bytes
        const pdfBytes = await pdfDoc.save();
        
        // Convert to ArrayBuffer
        resolve(pdfBytes.buffer);
      } catch (err) {
        console.error('Error creating simple PDF:', err);
        // Safely handle the error message
        const errorMessage = err instanceof Error ? err.message : String(err);
        reject(new Error('Simple PDF generation failed: ' + errorMessage));
      }
    })();
  });
}

export const mergePdfFiles = action({
  args: {
    conversionId: v.id("conversions"),
  },
  handler: async (ctx, args) => {
    try {
      // Get the conversion record
      const conversion = await ctx.runQuery(api.files.getConversion, { 
        conversionId: args.conversionId 
      });
      
      if (!conversion) {
        throw new Error("Conversion not found");
      }
      
      console.log("Starting PDF merger for:", conversion.fileName);
      
      // Validate source files exist
      if (!conversion.sourceFileIds || conversion.sourceFileIds.length < 2) {
        throw new Error("At least two PDF files are required for merging");
      }
      
      // Get URLs for all the PDF files
      const pdfUrls = await Promise.all(
        conversion.sourceFileIds.map(async (fileId) => {
          const url = await ctx.storage.getUrl(fileId);
          if (!url) {
            throw new Error(`PDF file not found for ID: ${fileId}`);
          }
          return url;
        })
      );
      
      console.log(`Found ${pdfUrls.length} PDF files to merge`);
      
      // Download all PDF files
      const pdfBuffers = await Promise.all(
        pdfUrls.map(async (url, index) => {
          console.log(`Downloading PDF ${index + 1}/${pdfUrls.length} from: ${url}`);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download PDF ${index + 1}: ${response.status} ${response.statusText}`);
          }
          return new Uint8Array(await response.arrayBuffer());
        })
      );
      
      console.log("All PDFs downloaded, starting merge process");
      
      // Create a new PDF document
      const mergedPdf = await PDFLib.create();
      
      // Add each PDF document to the merged PDF
      for (let i = 0; i < pdfBuffers.length; i++) {
        try {
          console.log(`Processing PDF ${i + 1}/${pdfBuffers.length}`);
          const pdf = await PDFLib.load(pdfBuffers[i]);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          
          // Add each page to the merged document
          for (const page of pages) {
            mergedPdf.addPage(page);
          }
          
          console.log(`Added ${pages.length} pages from PDF ${i + 1}`);
        } catch (error) {
          console.error(`Error processing PDF ${i + 1}:`, error);
          // Continue with next PDF even if one fails
        }
      }
      
      // Save the merged PDF
      console.log("Saving merged PDF");
      const mergedPdfBytes = await mergedPdf.save();
      
      // Store the merged PDF
      const mergedPdfBlob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      const storedPdfId = await ctx.storage.store(mergedPdfBlob);
      
      console.log("Merged PDF stored with ID:", storedPdfId);
      
      // Update the conversion record
      await ctx.runMutation(api.files.updateConversionJob, {
        jobId: args.conversionId,
        pdfFileId: storedPdfId,
        status: "completed"
      });
      
      console.log("PDF merger completed successfully");
      return storedPdfId;
      
    } catch (error) {
      console.error("PDF merger failed with error:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
      
      // Update the conversion record with failure
      await ctx.runMutation(api.files.updateConversionJob, {
        jobId: args.conversionId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error during PDF merging"
      });
      
      throw error;
    }
  },
});
