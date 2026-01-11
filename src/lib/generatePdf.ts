import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { jsPDF } from "jspdf";

// Function to get signed URLs for images
export const getImageUrls = async (
  convex: ConvexClient,
  imageFileIds: string[]
): Promise<string[]> => {
  console.log(`Getting URLs for ${imageFileIds.length} images: ${JSON.stringify(imageFileIds)}`);
  
  try {
    const urls = await Promise.all(
      imageFileIds.map(async (id) => {
        try {
          console.log(`Requesting URL for image: ${id}`);
          const url = await convex.query(api.files.getUrl, { storageId: id });
          console.log(`Retrieved URL for image ${id}: ${url ? 'SUCCESS' : 'NULL'}`);
          return url;
        } catch (error) {
          console.error(`Error getting URL for image ${id}:`, error);
          // Return null or empty string for failed URL retrievals
          // This allows the calling code to handle missing URLs
          return null;
        }
      })
    );
    
    console.log(`Retrieved ${urls.filter(Boolean).length}/${imageFileIds.length} valid URLs`);
    return urls;
  } catch (error) {
    console.error("Error in getImageUrls:", error);
    throw new Error(`Failed to retrieve image URLs: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Client-side PDF generation with simplified approach
export const generatePdfFromImages = async (imageUrls: string[]): Promise<ArrayBuffer> => {
  console.log(`Starting simplified PDF generation with ${imageUrls.length} images`);
  
  // Create a new PDF document with A4 size
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 10; // margin in mm
  
  // First convert all images to HTMLImageElement objects
  const imagePromises = imageUrls.map((url, index) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      console.log(`Processing image ${index + 1}/${imageUrls.length}...`);
      const img = new Image();
      
      // Set crossOrigin to anonymous to prevent tainted canvas issues
      img.crossOrigin = "anonymous"; 
      
      img.onload = () => {
        console.log(`Successfully loaded image ${index + 1} (${img.width}x${img.height})`);
        resolve(img);
      };
      
      img.onerror = (e) => {
        console.error(`Failed to load image ${index + 1} from URL: ${url}`, e);
        // Instead of failing, create a placeholder image
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ff0000';
          ctx.font = '30px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`Error loading image ${index + 1}`, canvas.width / 2, canvas.height / 2);
          
          const placeholderImg = new Image();
          placeholderImg.src = canvas.toDataURL('image/png');
          placeholderImg.onload = () => resolve(placeholderImg);
        } else {
          // If canvas context fails, reject
          reject(new Error(`Could not create placeholder for image ${index + 1}`));
        }
      };
      
      // Set src after setting handlers
      img.src = url;
    });
  });
  
  try {
    // Wait for all images to load (or for placeholders to be created)
    const images = await Promise.all(imagePromises);
    console.log(`Successfully processed ${images.length} images. Creating PDF...`);
    
    // Add each image to a separate page
    for (let i = 0; i < images.length; i++) {
      // Add new page for images after the first one
      if (i > 0) {
        doc.addPage();
      }
      
      try {
        const img = images[i];
        
        // Calculate dimensions for fitting image on page with margins
        const availableWidth = pageWidth - (2 * margin);
        const availableHeight = pageHeight - (2 * margin);
        
        // Calculate image dimensions while preserving aspect ratio
        let imgWidth = availableWidth;
        let imgHeight = (img.height * imgWidth) / img.width;
        
        // If height exceeds available height, adjust dimensions based on height
        if (imgHeight > availableHeight) {
          imgHeight = availableHeight;
          imgWidth = (img.width * imgHeight) / img.height;
        }
        
        // Calculate position to center the image
        const x = margin + (availableWidth - imgWidth) / 2;
        const y = margin + (availableHeight - imgHeight) / 2;
        
        console.log(`Adding image ${i + 1} to page ${i + 1} at position (${x.toFixed(1)}, ${y.toFixed(1)}) with size ${imgWidth.toFixed(1)}x${imgHeight.toFixed(1)}mm`);
        
        // Add image to PDF
        doc.addImage(
          img,
          'JPEG',
          x,
          y,
          imgWidth,
          imgHeight
        );
        
        // Add page number
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i + 1} of ${images.length}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      } catch (error) {
        console.error(`Error adding image ${i + 1} to PDF:`, error);
        // Add error text if image fails
        doc.setFontSize(14);
        doc.setTextColor(255, 0, 0);
        doc.text(`Error adding image ${i + 1} to PDF`, pageWidth / 2, pageHeight / 2, { align: 'center' });
      }
    }
    
    console.log('PDF generation completed successfully');
    return doc.output('arraybuffer');
    
  } catch (error) {
    console.error('Error during PDF generation:', error);
    
    // Create a simple error PDF if all else fails
    const errorDoc = new jsPDF();
    errorDoc.setFontSize(16);
    errorDoc.setTextColor(255, 0, 0);
    errorDoc.text('Error generating PDF from images', 20, 20);
    errorDoc.setFontSize(12);
    errorDoc.setTextColor(0);
    errorDoc.text(`Attempted to process ${imageUrls.length} images`, 20, 40);
    errorDoc.text(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 20, 60);
    
    return errorDoc.output('arraybuffer');
  }
};

// Function to upload the generated PDF to Convex storage
export async function uploadPdf(convex: ConvexClient, pdfBuffer: ArrayBuffer, fileName: string): Promise<{ storageId: string, url: string }> {
  // Generate upload URL
  const uploadUrl = await convex.mutation(api.files.generateUploadUrl);
  
  // Upload the PDF
  const res = await fetch(uploadUrl, {
    method: "POST",
    body: new Blob([pdfBuffer], { type: "application/pdf" }),
  });
  const { storageId } = await res.json();
  
  // Save the PDF file info in the database
  await convex.mutation(api.files.startPdfStorage, {
    pdfFileId: storageId,
    fileName
  });
  
  // Get the URL for the file
  const url = await convex.query(api.files.getUrl, { storageId });
  
  return {
    storageId,
    url
  };
}

// Client-side function to convert images to PDF
export async function convertImagesToPdf(
  convex: ConvexClient, 
  sourceFileIds: string[],
  fileName: string
): Promise<{ storageId: string, url: string }> {
  // Get signed URLs for all images
  const imageUrls = await getImageUrls(convex, sourceFileIds);
  
  // Generate PDF from images (client-side)
  const pdfBuffer = await generatePdfFromImages(imageUrls);
  
  // Upload the PDF to Convex storage
  return await uploadPdf(convex, pdfBuffer, fileName);
} 