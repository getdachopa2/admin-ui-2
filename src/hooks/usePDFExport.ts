import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFExportOptions {
  filename?: string;
  title?: string;
  includeTimestamp?: boolean;
  testSummary?: any;
  testSteps?: any[];
}

interface TestStep {
  id: string;
  type: 'token' | 'payment' | 'cancel' | 'refund';
  cardNumber?: string;
  paymentId?: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  request?: any;
  response?: any;
  message?: string;
}

export function usePDFExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async (
    elementId: string,
    options: PDFExportOptions = {}
  ) => {
    const {
      filename = 'test-raporu',
      title = 'Test Raporu',
      includeTimestamp = true,
      testSummary,
      testSteps = []
    } = options;

    setIsExporting(true);

    try {
      console.log('[PDF Export] Başlatılıyor...', { elementId, filename, testSteps: testSteps.length });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Türkçe karakter desteği için font ayarları
      try {
        // Internal fonts that support Unicode better
        pdf.setFont('helvetica', 'normal');
      } catch (fontError) {
        console.warn('[PDF Export] Font ayarı hatası, default font kullanılıyor:', fontError);
      }
      
      let yPos = 20;
      
      // Header with gradient-like effect
      try {
        pdf.setFillColor(59, 130, 246);
        pdf.rect(0, 0, 210, 25, 'F');
        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 20, 210, 5, 'F');
        
        // Title - emoji yerine text kullan
        pdf.setFontSize(22);
        pdf.setTextColor(255, 255, 255);
        pdf.text('KANAL KONTROL BOT', 20, 15);
        
        // Subtitle
        pdf.setFontSize(14);
        pdf.setTextColor(219, 234, 254);
        pdf.text('Test Raporu', 20, 22);
        
        yPos = 35;
        
        if (includeTimestamp) {
          // Timestamp - emoji yerine text kullan
          pdf.setFontSize(11);
          pdf.setTextColor(107, 114, 128);
          const timestamp = new Date().toLocaleString('tr-TR');
          pdf.text(`Olusturulma Tarihi: ${timestamp}`, 20, yPos);
          yPos += 10;
        }
        console.log('[PDF Export] Header oluşturuldu');
      } catch (headerError) {
        console.error('[PDF Export] Header oluşturma hatası:', headerError);
        throw new Error('PDF header oluşturulamadı: ' + (headerError instanceof Error ? headerError.message : 'Bilinmeyen hata'));
      }

      // Test Summary Section
      if (testSummary) {
        try {
          console.log('[PDF Export] Test summary ekleniyor...');
          yPos = addTestSummary(pdf, testSummary, yPos);
          console.log('[PDF Export] Test summary eklendi, yPos:', yPos);
        } catch (summaryError) {
          console.error('[PDF Export] Test summary hatası:', summaryError);
          // Summary hatası kritik değil, devam et
        }
      }

      // Test Steps Section
      if (testSteps && testSteps.length > 0) {
        try {
          console.log('[PDF Export] Test steps ekleniyor, step sayısı:', testSteps.length);
          yPos = addTestSteps(pdf, testSteps, yPos);
          console.log('[PDF Export] Test steps eklendi, yPos:', yPos);
        } catch (stepsError) {
          console.error('[PDF Export] Test steps hatası:', stepsError);
          // Steps hatası da kritik değil, devam et
        }
      }

      // If no custom content provided, use HTML capture
      if (!testSummary && (!testSteps || testSteps.length === 0)) {
        try {
          console.log('[PDF Export] HTML capture kullanılıyor...');
          const element = document.getElementById(elementId);
          if (!element) {
            throw new Error(`Element with id "${elementId}" not found`);
          }

          const canvas = await html2canvas(element, {
            scale: 1.5, // Lower scale to reduce memory usage
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0f0f23',
            scrollX: 0,
            scrollY: 0,
            width: Math.min(element.scrollWidth, 1200), // Limit width
            height: Math.min(element.scrollHeight, 1600) // Limit height
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 170;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 20, yPos, imgWidth, imgHeight);
          console.log('[PDF Export] HTML capture eklendi');
        } catch (htmlError) {
          console.error('[PDF Export] HTML capture hatası:', htmlError);
          throw new Error('HTML capture başarısız: ' + (htmlError instanceof Error ? htmlError.message : 'Bilinmeyen hata'));
        }
      }

      // Generate filename with timestamp
      const finalFilename = includeTimestamp 
        ? `${filename}_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.pdf`
        : `${filename}.pdf`;

      // Add page numbers and footer
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        // Footer line
        pdf.setDrawColor(209, 213, 219);
        pdf.line(20, 285, 190, 285);
        
        // Page number
        pdf.setFontSize(9);
        pdf.setTextColor(107, 114, 128);
        pdf.text(`Sayfa ${i} / ${pageCount}`, 170, 290);
        
        // Footer text
        pdf.text('Kanal Kontrol Bot - Test Raporu', 20, 290);
      }

      pdf.save(finalFilename);

    } catch (error) {
      console.error('PDF export failed:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  // Helper function to add test summary
  const addTestSummary = (pdf: jsPDF, summary: any, startY: number): number => {
    if (!summary) return startY;
    
    let yPos = startY + 10;
    
    try {
      // Section title with background
      pdf.setFillColor(59, 130, 246); // Blue background
      pdf.rect(15, yPos - 5, 180, 12, 'F');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255); // White text
      pdf.text('TEST OZETI', 20, yPos + 3);
      yPos += 15;
      
      // Summary table
      const summaryData = [];
      if (summary.scenario) summaryData.push(['SENARYO', String(summary.scenario)]);
      if (summary.environment) summaryData.push(['ORTAM', String(summary.environment)]);
      if (summary.channel) summaryData.push(['KANAL', String(summary.channel)]);
      if (summary.application) summaryData.push(['UYGULAMA', String(summary.application)]);
      if (summary.cards && Array.isArray(summary.cards) && summary.cards.length > 0) {
        summaryData.push(['TEST KARTLARI', `${summary.cards.length} ADET`]);
      }
      if (summary.cancelRefund && Array.isArray(summary.cancelRefund) && summary.cancelRefund.length > 0) {
        summaryData.push(['IPTAL/IADE', `${summary.cancelRefund.length} ISLEM`]);
      }
      
      if (summaryData.length > 0) {
        yPos = addStyledTable(pdf, summaryData, 20, yPos, ['OZELLIK', 'DEGER'], [50, 130]);
      }
      
      // Cards detail if available
      if (summary.cards && Array.isArray(summary.cards) && summary.cards.length > 0) {
        yPos += 5;
        pdf.setFillColor(34, 197, 94); // Green background
        pdf.rect(15, yPos - 5, 180, 10, 'F');
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.text('TEST KARTLARI DETAYI', 20, yPos + 2);
        yPos += 12;
        
        const cardData = summary.cards.map((card: any, index: number) => [
          String(index + 1),
          formatCardNumber(card?.cardNumber || card?.name || 'BILINMEYEN'),
          String(card?.cardType || 'STANDART')
        ]);
        
        yPos = addStyledTable(pdf, cardData, 20, yPos, ['#', 'KART NUMARASI', 'TIP'], [15, 85, 80]);
      }
    } catch (error) {
      console.error('[PDF Export] Summary section hatası:', error);
    }
    
    return yPos + 15;
  };

  // Helper function to add test steps with styled table
  const addTestSteps = (pdf: jsPDF, steps: TestStep[], startY: number): number => {
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return startY;
    }
    
    let yPos = startY;
    
    try {
      // Section title with background
      pdf.setFillColor(168, 85, 247); // Purple background
      pdf.rect(15, yPos - 5, 180, 12, 'F');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text('TEST ADIMLARI', 20, yPos + 3);
      yPos += 20;
      
      steps.forEach((step, index) => {
        try {
          // Check if we need a new page
          if (yPos > 240) {
            pdf.addPage();
            yPos = 20;
          }
          
          // Step header with colored background
          const statusColor = getStatusColors(step?.status || 'pending');
          pdf.setFillColor(statusColor.bg.r, statusColor.bg.g, statusColor.bg.b);
          pdf.rect(15, yPos - 5, 180, 10, 'F');
          
          pdf.setFontSize(11);
          pdf.setTextColor(255, 255, 255);
          const stepTitle = `${index + 1}. ${getTypeLabel(step?.type || 'unknown')} - ${(step?.status || 'PENDING').toUpperCase()}`;
          pdf.text(stepTitle, 20, yPos + 1);
          yPos += 12;
          
          // Step info table
          const stepInfo = [];
          if (step?.cardNumber) stepInfo.push(['KART', formatCardNumber(step.cardNumber)]);
          if (step?.paymentId) stepInfo.push(['PAYMENT ID', String(step.paymentId)]);
          if (step?.timestamp) {
            stepInfo.push(['ZAMAN', new Date(step.timestamp).toLocaleString('tr-TR')]);
          }
          if (step?.message) stepInfo.push(['MESAJ', String(step.message)]);
          
          if (stepInfo.length > 0) {
            yPos = addStyledTable(pdf, stepInfo, 20, yPos, ['OZELLIK', 'DEGER'], [40, 140]);
          }
          
          // Request/Response sections
          if (step?.request || step?.response) {
            yPos += 5;
            
            if (step.request) {
              try {
                yPos = addJsonSection(pdf, 'Request', step.request, yPos, { r: 34, g: 197, b: 94 }); // Green
              } catch (reqError) {
                console.error(`[PDF Export] Request section hatası (step ${index}):`, reqError);
              }
            }
            
            if (step.response) {
              try {
                yPos = addJsonSection(pdf, 'Response', step.response, yPos, { r: 59, g: 130, b: 246 }); // Blue
              } catch (resError) {
                console.error(`[PDF Export] Response section hatası (step ${index}):`, resError);
              }
            }
          }
          
          yPos += 10; // Space between steps
        } catch (stepError) {
          console.error(`[PDF Export] Step ${index} işleme hatası:`, stepError);
          yPos += 15; // Skip this step but continue
        }
      });
    } catch (error) {
      console.error('[PDF Export] Test steps section hatası:', error);
    }
    
    return yPos;
  };

  // Helper function to add styled table
  const addStyledTable = (pdf: jsPDF, data: string[][], x: number, startY: number, headers: string[], colWidths: number[]): number => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return startY;
    }
    
    try {
      let yPos = startY;
      
      // Header row
      pdf.setFillColor(75, 85, 99); // Gray background
      const headerHeight = 8;
      let currentX = x;
      
      headers.forEach((header, i) => {
        pdf.rect(currentX, yPos, colWidths[i], headerHeight, 'F');
        pdf.setDrawColor(156, 163, 175); // Gray border
        pdf.rect(currentX, yPos, colWidths[i], headerHeight, 'S');
        
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text(String(header || ''), currentX + 2, yPos + 5);
        currentX += colWidths[i];
      });
      yPos += headerHeight;
      
      // Data rows
      data.forEach((row, rowIndex) => {
        if (!row || !Array.isArray(row)) return;
        
        currentX = x;
        const rowHeight = 6;
        
        // Alternate row colors
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(249, 250, 251); // Light gray
          pdf.rect(x, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        }
        
        row.forEach((cell, cellIndex) => {
          if (cellIndex >= colWidths.length) return;
          
          pdf.setDrawColor(209, 213, 219); // Light border
          pdf.rect(currentX, yPos, colWidths[cellIndex], rowHeight, 'S');
          
          pdf.setFontSize(9);
          pdf.setTextColor(55, 65, 81);
          
          // Truncate long text
          let cellText = String(cell || '');
          if (cellText.length > 25) {
            cellText = cellText.substring(0, 22) + '...';
          }
          
          pdf.text(cellText, currentX + 2, yPos + 4);
          currentX += colWidths[cellIndex];
        });
        yPos += rowHeight;
      });
      
      return yPos + 5;
    } catch (error) {
      console.error('[PDF Export] Table oluşturma hatası:', error);
      return startY + 20; // Skip table but continue
    }
  };

  // Helper function to add JSON section with collapsible style
  const addJsonSection = (pdf: jsPDF, title: string, data: any, startY: number, color: {r: number, g: number, b: number}): number => {
    let yPos = startY;
    
    // Section header
    pdf.setFillColor(color.r, color.g, color.b);
    pdf.rect(25, yPos - 3, 160, 8, 'F');
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title, 28, yPos + 2);
    yPos += 10;
    
    // JSON content with border
    pdf.setDrawColor(color.r, color.g, color.b);
    pdf.setLineWidth(0.5);
    
    const jsonText = JSON.stringify(data, null, 2);
    const maxWidth = 155;
    yPos = addFormattedJson(pdf, jsonText, 30, yPos, maxWidth, color);
    
    return yPos + 5;
  };

  // Enhanced JSON formatter with syntax highlighting
  const addFormattedJson = (pdf: jsPDF, text: string, x: number, startY: number, maxWidth: number, borderColor: {r: number, g: number, b: number}): number => {
    pdf.setFontSize(8);
    let yPos = startY;
    const lineHeight = 3.5;
    const lines = text.split('\n');
    
    // Background for JSON
    const contentHeight = lines.length * lineHeight + 4;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(x - 2, yPos - 2, maxWidth + 4, contentHeight, 'F');
    
    // Border
    pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    pdf.rect(x - 2, yPos - 2, maxWidth + 4, contentHeight, 'S');
    
    lines.forEach((line, index) => {
      if (yPos > 275) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Simple syntax coloring
      if (line.includes('"') && line.includes(':')) {
        // Property names in blue
        pdf.setTextColor(37, 99, 235);
      } else if (line.includes('true') || line.includes('false')) {
        // Booleans in purple
        pdf.setTextColor(147, 51, 234);
      } else if (line.match(/\d+/)) {
        // Numbers in red
        pdf.setTextColor(220, 38, 127);
      } else {
        // Default text
        pdf.setTextColor(75, 85, 99);
      }
      
      const truncatedLine = line.length > 70 ? line.substring(0, 67) + '...' : line;
      pdf.text(truncatedLine, x, yPos);
      yPos += lineHeight;
    });
    
    return yPos + 2;
  };

  // Helper function to get status colors
  const getStatusColors = (status: string) => {
    switch (status) {
      case 'success':
        return { bg: { r: 34, g: 197, b: 94 }, text: { r: 255, g: 255, b: 255 } };
      case 'error':
        return { bg: { r: 239, g: 68, b: 68 }, text: { r: 255, g: 255, b: 255 } };
      default:
        return { bg: { r: 245, g: 158, b: 11 }, text: { r: 255, g: 255, b: 255 } };
    }
  };

  // Helper function to get type icons
  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'token': return '🔑';
      case 'payment': return '💳';
      case 'cancel': return '❌';
      case 'refund': return '💰';
      default: return '📝';
    }
  };

  // Helper function to add formatted text with word wrapping (kept for compatibility)
  const addFormattedText = (pdf: jsPDF, text: string, x: number, startY: number, maxWidth: number): number => {
    return addFormattedJson(pdf, text, x, startY, maxWidth, { r: 156, g: 163, b: 175 });
  };

  // Helper function to get type label in Turkish
  const getTypeLabel = (type: string): string => {
    if (!type) return 'BILINMEYEN';
    
    switch (type.toLowerCase()) {
      case 'token': return 'TOKEN ALMA';
      case 'payment': return 'ODEME';
      case 'cancel': return 'IPTAL';
      case 'refund': return 'IADE';
      default: return (type || 'BILINMEYEN').toUpperCase();
    }
  };

  // Helper function to format card number
  const formatCardNumber = (cardNumber: string): string => {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return 'BILINMEYEN KART';
    }
    
    // Only format if it looks like a card number (16 digits)
    if (cardNumber.length === 16 && /^\d+$/.test(cardNumber)) {
      return cardNumber.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1****$4');
    }
    
    return cardNumber;
  };

  return {
    exportToPDF,
    isExporting
  };
}
