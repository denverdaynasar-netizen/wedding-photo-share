import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { WeddingEvent } from '@/types';

export async function generateQrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 600,
    margin: 2,
    color: {
      dark: '#1A1A1A',
      light: '#FFFFFF',
    },
  });
}

export async function downloadQrPng(url: string, fileName: string): Promise<void> {
  const dataUrl = await generateQrPngDataUrl(url);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${fileName}-qr.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function generateTableCardPdf(event: WeddingEvent, guestUrl: string): Promise<void> {
  const qrDataUrl = await generateQrPngDataUrl(guestUrl);

  // A6 size: 105mm width, 148mm height
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6',
  });

  const pageWidth = 105;
  const pageHeight = 148;

  // Background tint (warm ivory/linen)
  doc.setFillColor(253, 252, 250);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative border
  doc.setDrawColor(200, 165, 120);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  doc.setLineWidth(0.2);
  doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

  // Header Title
  doc.setTextColor(35, 30, 25);
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  
  // Truncate or split long event name
  const titleLines = doc.splitTextToSize(event.name, pageWidth - 24);
  doc.text(titleLines, pageWidth / 2, 22, { align: 'center' });

  // Accent divider line
  doc.setDrawColor(200, 165, 120);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 18, 30, pageWidth / 2 + 18, 30);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 80, 70);
  doc.text('CAPTURE & SHARE THE MOMENT', pageWidth / 2, 36, { align: 'center' });

  // QR Code Image (centered, 48x48 mm)
  const qrSize = 48;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = 42;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // Scan instruction
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(40, 35, 30);
  doc.text('Scan to share your photos', pageWidth / 2, 98, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 100, 95);
  doc.text('Open your camera, point at the code, and tap the link.', pageWidth / 2, 105, { align: 'center' });

  // Access code if present
  if (event.eventCode && event.eventCode.trim() !== '') {
    doc.setFillColor(245, 240, 230);
    doc.roundedRect(pageWidth / 2 - 25, 112, 50, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(70, 50, 30);
    doc.text(`ACCESS CODE: ${event.eventCode.toUpperCase()}`, pageWidth / 2, 118, { align: 'center' });
  }

  // Footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 140, 135);
  doc.text('No app download required • Photos uploaded directly to couple’s drive', pageWidth / 2, 137, { align: 'center' });

  doc.save(`${event.slug}-table-card-A6.pdf`);
}
