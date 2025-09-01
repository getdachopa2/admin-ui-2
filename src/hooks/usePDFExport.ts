import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Türkçe karakter çevirme fonksiyonu
const turkishToAscii = (text: string): string => {
  const turkishChars: { [key: string]: string } = {
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G', 
    'ı': 'i', 'I': 'I',
    'ö': 'o', 'Ö': 'O',
    'ş': 's', 'Ş': 'S',
    'ü': 'u', 'Ü': 'U',
    'İ': 'I'
  };
  
  return text.replace(/[çÇğĞıIöÖşŞüÜİ]/g, (match) => turkishChars[match] || match);
};

interface PDFExportOptions {
  filename?: string;
  title?: string;
  includeTimestamp?: boolean;
  testSummary?: any;
  testSteps?: any[];
  scenarios?: TestScenario[];
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

interface TestScenario {
  id: string;
  name: string;
  endpoint: string;
  status: 'success' | 'failed' | 'pending';
  duration: number;
  details: {
    token?: string;
    hash?: string;
    paymentId?: string;
    orderId?: string;
    amount?: number;
    errorCode?: string;
    errorMessage?: string;
  };
  timestamp: string;
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    body?: any;
  };
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
      testSteps = [],
      scenarios = []
    } = options;

    setIsExporting(true);

    try {
      console.log('[PDF Export] Başlatılıyor...', { elementId, filename, testSteps: testSteps.length });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      try {
        pdf.setFont('helvetica', 'normal');
      } catch (fontError) {
        console.warn('[PDF Export] Font ayarı hatası, default font kullanılıyor:', fontError);
      }
      
      let yPos = 20;
      
      // Header
      try {
        pdf.setFillColor(59, 130, 246);
        pdf.rect(0, 0, 210, 25, 'F');
        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 20, 210, 5, 'F');
        
        pdf.setFontSize(22);
        pdf.setTextColor(255, 255, 255);
        pdf.text(turkishToAscii('KANAL KONTROL BOT'), 20, 15);
        
        pdf.setFontSize(14);
        pdf.setTextColor(219, 234, 254);
        pdf.text(turkishToAscii('Test Raporu'), 20, 22);
        
        yPos = 35;
        
        if (includeTimestamp) {
          pdf.setFontSize(11);
          pdf.setTextColor(107, 114, 128);
          const timestamp = new Date().toLocaleString('tr-TR');
          pdf.text(turkishToAscii(`Olusturulma Tarihi: ${timestamp}`), 20, yPos);
          yPos += 10;
        }
        console.log('[PDF Export] Header oluşturuldu');
      } catch (headerError) {
        console.error('[PDF Export] Header oluşturma hatası:', headerError);
        throw new Error('PDF header oluşturulamadı');
      }

      // Test Summary Section
      if (testSummary) {
        try {
          yPos = addTestSummary(pdf, testSummary, yPos);
        } catch (summaryError) {
          console.error('[PDF Export] Test summary hatası:', summaryError);
        }
      }

      // Test Steps Section
      if (testSteps && testSteps.length > 0) {
        try {
          yPos = addTestSteps(pdf, testSteps, yPos);
        } catch (stepsError) {
          console.error('[PDF Export] Test steps hatası:', stepsError);
        }
      }

      // Test Scenarios Table Section
      if (scenarios && scenarios.length > 0) {
        try {
          yPos = addScenariosTable(pdf, scenarios, yPos);
        } catch (scenariosError) {
          console.error('[PDF Export] Test scenarios hatası:', scenariosError);
        }
      }

      // HTML capture fallback
      if (!testSummary && (!testSteps || testSteps.length === 0)) {
        try {
          const element = document.getElementById(elementId);
          if (!element) {
            throw new Error(`Element with id "${elementId}" not found`);
          }

          const canvas = await html2canvas(element, {
            scale: 1.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0f0f23',
            scrollX: 0,
            scrollY: 0,
            width: Math.min(element.scrollWidth, 1200),
            height: Math.min(element.scrollHeight, 1600)
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 170;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 20, yPos, imgWidth, imgHeight);
        } catch (htmlError) {
          console.error('[PDF Export] HTML capture hatası:', htmlError);
          throw new Error('HTML capture başarısız');
        }
      }

      const finalFilename = includeTimestamp 
        ? `${filename}_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.pdf`
        : `${filename}.pdf`;

      // Add page numbers and footer
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        pdf.setDrawColor(209, 213, 219);
        pdf.line(20, 285, 190, 285);
        
        pdf.setFontSize(9);
        pdf.setTextColor(107, 114, 128);
        pdf.text(turkishToAscii(`Sayfa ${i} / ${pageCount}`), 170, 290);
        
        pdf.text(turkishToAscii('Kanal Kontrol Bot - Test Raporu'), 20, 290);
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
      // 1. GENEL DURUM
      pdf.setFillColor(59, 130, 246);
      pdf.rect(15, yPos - 5, 180, 12, 'F');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text('GENEL DURUM', 20, yPos + 3);
      yPos += 15;
      
      const statusData = [];
      if (summary.totalSteps) statusData.push(['TOPLAM ADIM', String(summary.totalSteps)]);
      if (summary.successfulSteps !== undefined) statusData.push(['BASARILI', String(summary.successfulSteps)]);
      if (summary.failedSteps !== undefined) statusData.push(['BASARISIZ', String(summary.failedSteps)]);
      if (summary.duration) statusData.push(['SURE', String(summary.duration)]);
      if (summary.overallStatus) statusData.push(['SONUC', String(summary.overallStatus).toUpperCase()]);
      
      if (statusData.length > 0) {
        yPos = addStyledTable(pdf, statusData, 20, yPos, ['METRIK', 'DEGER'], [80, 100]);
      }
      
      yPos += 10;
      
      // 2. SENARYOLAR
      pdf.setFillColor(168, 85, 247);
      pdf.rect(15, yPos - 5, 180, 12, 'F');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text('SENARYOLAR', 20, yPos + 3);
      yPos += 15;
      
      const scenarioData = [];
      if (summary.scenarios && Array.isArray(summary.scenarios)) {
        summary.scenarios.forEach((scenario: string) => {
          scenarioData.push([scenario, 'CALISTIRILDI']);
        });
      }
      if (summary.environment) scenarioData.push(['ORTAM', String(summary.environment)]);
      if (summary.channel) scenarioData.push(['KANAL ID', String(summary.channel)]);
      if (summary.application) scenarioData.push(['UYGULAMA', String(summary.application)]);
      
      if (scenarioData.length > 0) {
        yPos = addStyledTable(pdf, scenarioData, 20, yPos, ['SENARYO/AYAR', 'DURUM'], [100, 80]);
      }
      
      yPos += 10;
      
      // 3. KART BILGILERI
      if (summary.cards && Array.isArray(summary.cards) && summary.cards.length > 0) {
        pdf.setFillColor(34, 197, 94);
        pdf.rect(15, yPos - 5, 180, 12, 'F');
        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.text('KULLANILAN KARTLAR', 20, yPos + 3);
        yPos += 15;
        
        const cardData = summary.cards.map((card: any, index: number) => [
          String(index + 1),
          formatCardNumber(card?.cardNumber || card?.name || 'BILINMEYEN'),
          String(card?.cardType || card?.bank || 'STANDART')
        ]);
        
        yPos = addStyledTable(pdf, cardData, 20, yPos, ['#', 'KART NUMARASI', 'BANKA/TIP'], [15, 85, 80]);
      }
      
    } catch (error) {
      console.error('[PDF Export] Summary section hatası:', error);
    }
    
    return yPos + 15;
  };

  // Helper function to add test steps
  const addTestSteps = (pdf: jsPDF, steps: TestStep[], startY: number): number => {
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return startY;
    }
    
    let yPos = startY;
    
    try {
      // Section title
      pdf.setFillColor(239, 68, 68);
      pdf.rect(15, yPos - 5, 180, 12, 'F');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text('DETAYLI TEST ADIMLARI', 20, yPos + 3);
      yPos += 20;
      
      // Success/Error summary
      const successCount = steps.filter(s => s.status === 'success').length;
      const errorCount = steps.filter(s => s.status === 'error').length;
      const pendingCount = steps.filter(s => s.status === 'pending').length;
      
      const summaryData = [
        ['TOPLAM ADIM', String(steps.length)],
        ['BASARILI', String(successCount)],
        ['BASARISIZ', String(errorCount)],
        ['BEKLEMEDE', String(pendingCount)]
      ];
      
      yPos = addStyledTable(pdf, summaryData, 20, yPos, ['DURUM', 'ADET'], [80, 100]);
      yPos += 15;
      
      steps.forEach((step, index) => {
        try {
          if (yPos > 220) {
            pdf.addPage();
            yPos = 20;
          }
          
          const statusColor = getStatusColors(step?.status || 'pending');
          pdf.setFillColor(statusColor.bg.r, statusColor.bg.g, statusColor.bg.b);
          pdf.rect(15, yPos - 5, 180, 12, 'F');
          
          pdf.setFontSize(12);
          pdf.setTextColor(255, 255, 255);
          const stepTitle = `ADIM ${index + 1}: ${getTypeLabel(step?.type || 'unknown')}`;
          pdf.text(stepTitle, 20, yPos + 3);
          
          const statusText = (step?.status || 'PENDING').toUpperCase();
          const statusWidth = pdf.getTextWidth(statusText) + 8;
          pdf.setFillColor(statusColor.text.r, statusColor.text.g, statusColor.text.b);
          pdf.rect(160 - statusWidth, yPos - 2, statusWidth, 8, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.text(statusText, 164 - statusWidth, yPos + 3);
          
          yPos += 15;
          
          const stepInfo = [];
          if (step?.cardNumber) stepInfo.push(['KART NO', formatCardNumber(step.cardNumber)]);
          if (step?.paymentId) stepInfo.push(['PAYMENT ID', String(step.paymentId)]);
          if (step?.timestamp) {
            stepInfo.push(['ZAMAN', new Date(step.timestamp).toLocaleString('tr-TR')]);
          }
          if (step?.message) stepInfo.push(['MESAJ', String(step.message)]);
          
          if (stepInfo.length > 0) {
            yPos = addStyledTable(pdf, stepInfo, 20, yPos, ['ALAN', 'DEGER'], [50, 130]);
          }
          
          if (step?.request || step?.response) {
            yPos += 8;
            
            if (step.request) {
              yPos = addJsonSection(pdf, 'REQUEST', step.request, yPos, { r: 34, g: 197, b: 94 });
            }
            
            if (step.response) {
              yPos = addJsonSection(pdf, 'RESPONSE', step.response, yPos, { r: 59, g: 130, b: 246 });
            }
          }
          
          yPos += 10;
          
        } catch (stepError) {
          console.error(`[PDF Export] Step ${index} işleme hatası:`, stepError);
          yPos += 20;
        }
      });
      
    } catch (error) {
      console.error('[PDF Export] Test steps section hatası:', error);
    }
    
    return yPos;
  };

  const addScenariosTable = (pdf: jsPDF, scenarios: TestScenario[], startY: number): number => {
    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      return startY;
    }
    
    let yPos = startY;
    
    try {
      // Check if we need a new page
      if (yPos > 200) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Section title
      pdf.setFillColor(99, 102, 241);
      pdf.rect(15, yPos - 5, 180, 12, 'F');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(turkishToAscii('TEST SENARYOLARI'), 20, yPos + 3);
      yPos += 20;

      // Success/Error summary
      const successCount = scenarios.filter(s => s.status === 'success').length;
      const failedCount = scenarios.filter(s => s.status === 'failed').length;
      const pendingCount = scenarios.filter(s => s.status === 'pending').length;
      
      const summaryData = [
        ['TOPLAM SENARYO', String(scenarios.length)],
        ['BASARILI', String(successCount)],
        ['BASARISIZ', String(failedCount)],
        ['BEKLEMEDE', String(pendingCount)]
      ];
      
      yPos = addStyledTable(pdf, summaryData, 20, yPos, ['DURUM', 'ADET'], [80, 100]);
      yPos += 15;
      
      // Table headers
      const colWidths = [40, 55, 25, 20, 50];
      let currentX = 20;
      
      pdf.setFillColor(75, 85, 99);
      pdf.rect(20, yPos, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
      
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      const headers = ['SENARYO', 'ENDPOINT', 'DURUM', 'SURE', 'ONEMLI BILGILER'];
      headers.forEach((header, i) => {
        pdf.text(header, currentX + 2, yPos + 5);
        currentX += colWidths[i];
      });
      yPos += 8;
      
      // Table rows
      scenarios.forEach((scenario, index) => {
        try {
          if (yPos > 250) {
            pdf.addPage();
            yPos = 20;
            
            // Redraw headers on new page
            currentX = 20;
            pdf.setFillColor(75, 85, 99);
            pdf.rect(20, yPos, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
            
            pdf.setFontSize(9);
            pdf.setTextColor(255, 255, 255);
            headers.forEach((header, i) => {
              pdf.text(header, currentX + 2, yPos + 5);
              currentX += colWidths[i];
            });
            yPos += 8;
          }
          
          // Row background
          if (index % 2 === 0) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(20, yPos, colWidths.reduce((a, b) => a + b, 0), 12, 'F');
          }
          
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(8);
          
          currentX = 20;
          
          // Scenario name
          pdf.text(turkishToAscii(scenario.name.substring(0, 15)), currentX + 2, yPos + 4);
          currentX += colWidths[0];
          
          // Endpoint
          pdf.text(turkishToAscii(scenario.endpoint.substring(0, 20)), currentX + 2, yPos + 4);
          currentX += colWidths[1];
          
          // Status with color
          const statusColors = getScenarioStatusColors(scenario.status);
          pdf.setFillColor(statusColors.bg.r, statusColors.bg.g, statusColors.bg.b);
          pdf.rect(currentX + 1, yPos + 1, 22, 6, 'F');
          pdf.setTextColor(statusColors.text.r, statusColors.text.g, statusColors.text.b);
          const statusText = getScenarioStatusText(scenario.status);
          pdf.text(turkishToAscii(statusText), currentX + 3, yPos + 4);
          pdf.setTextColor(0, 0, 0);
          currentX += colWidths[2];
          
          // Duration
          const durationText = scenario.duration > 0 ? `${scenario.duration}ms` : '-';
          pdf.text(durationText, currentX + 2, yPos + 4);
          currentX += colWidths[3];
          
          // Important details (first line only for table)
          const details = formatScenarioDetails(scenario);
          if (details.length > 0) {
            pdf.text(turkishToAscii(details[0].substring(0, 25)), currentX + 2, yPos + 4);
            
            // If there are more details, add them in smaller font below
            if (details.length > 1) {
              pdf.setFontSize(6);
              pdf.setTextColor(100, 100, 100);
              let detailY = yPos + 7;
              for (let i = 1; i < Math.min(details.length, 2); i++) {
                pdf.text(turkishToAscii(details[i].substring(0, 25)), currentX + 2, detailY);
                detailY += 3;
              }
              pdf.setTextColor(0, 0, 0);
              pdf.setFontSize(8);
            }
          }
          
          yPos += 12;
          
        } catch (scenarioError) {
          console.error(`[PDF Export] Scenario ${index} işleme hatası:`, scenarioError);
          yPos += 12;
        }
      });

      // Add detailed request/response logs for each scenario
      yPos += 15;
      
      // Detailed Logs Section Title
      if (yPos > 250) {
        pdf.addPage();
        yPos = 20;
      }
      
      pdf.setFillColor(147, 51, 234);
      pdf.rect(15, yPos - 5, 180, 12, 'F');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(turkishToAscii('DETAYLI ISTEK/CEVAP LOGLARI'), 20, yPos + 3);
      yPos += 20;

      scenarios.forEach((scenario, index) => {
        if (yPos > 220) {
          pdf.addPage();
          yPos = 20;
        }

        // Scenario detail header
        const statusColors = getScenarioStatusColors(scenario.status);
        pdf.setFillColor(statusColors.bg.r, statusColors.bg.g, statusColors.bg.b);
        pdf.rect(15, yPos - 5, 180, 10, 'F');
        
        pdf.setFontSize(11);
        pdf.setTextColor(255, 255, 255);
        pdf.text(turkishToAscii(`${index + 1}. ${scenario.name}`), 20, yPos + 2);
        
        const statusText = getScenarioStatusText(scenario.status);
        pdf.setFillColor(statusColors.text.r, statusColors.text.g, statusColors.text.b);
        const statusWidth = pdf.getTextWidth(turkishToAscii(statusText)) + 6;
        pdf.rect(190 - statusWidth, yPos - 2, statusWidth, 6, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.text(turkishToAscii(statusText), 192 - statusWidth, yPos + 2);
        
        yPos += 15;

        // Scenario basic info
        const scenarioInfo = [
          ['Endpoint', scenario.endpoint],
          ['Süre', `${scenario.duration}ms`],
          ['Zaman', scenario.timestamp]
        ];

        if (Object.keys(scenario.details).length > 0) {
          Object.entries(scenario.details).forEach(([key, value]) => {
            if (value) {
              scenarioInfo.push([key, String(value)]);
            }
          });
        }

        yPos = addStyledTable(pdf, scenarioInfo, 20, yPos, ['Alan', 'Değer'], [40, 140]);
        yPos += 10;

        // Request details
        if (scenario.request) {
          yPos = addJsonSection(pdf, 'REQUEST', scenario.request, yPos, { r: 34, g: 197, b: 94 });
          yPos += 5;
        }

        // Response details
        if (scenario.response) {
          yPos = addJsonSection(pdf, 'RESPONSE', scenario.response, yPos, { r: 59, g: 130, b: 246 });
          yPos += 5;
        }

        yPos += 15;
      });
      
    } catch (error) {
      console.error('[PDF Export] Scenarios table section hatası:', error);
    }
    
    return yPos + 10;
  };

  // Helper functions
  const addStyledTable = (pdf: jsPDF, data: string[][], x: number, y: number, headers: string[], colWidths: number[]): number => {
    let currentY = y;
    
    // Header
    pdf.setFillColor(75, 85, 99);
    pdf.rect(x, currentY, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
    
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    let currentX = x;
    headers.forEach((header, i) => {
      pdf.text(header, currentX + 2, currentY + 5);
      currentX += colWidths[i];
    });
    currentY += 8;
    
    // Data rows
    pdf.setTextColor(0, 0, 0);
    data.forEach((row, rowIndex) => {
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(x, currentY, colWidths.reduce((a, b) => a + b, 0), 6, 'F');
      }
      
      currentX = x;
      row.forEach((cell, i) => {
        pdf.text(turkishToAscii(String(cell).substring(0, 30)), currentX + 2, currentY + 4);
        currentX += colWidths[i];
      });
      currentY += 6;
    });
    
    return currentY + 5;
  };

  const addJsonSection = (pdf: jsPDF, title: string, data: any, y: number, color: {r: number, g: number, b: number}): number => {
    let currentY = y;
    
    pdf.setFillColor(color.r, color.g, color.b);
    pdf.rect(15, currentY - 3, 180, 8, 'F');
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(turkishToAscii(title), 20, currentY + 2);
    currentY += 10;
    
    try {
      // Check if we need a new page
      if (currentY > 250) {
        pdf.addPage();
        currentY = 20;
      }

      // For request/response objects, format them nicely
      if (title === 'REQUEST' && data) {
        const requestData = [
          ['Method', data.method || 'N/A'],
          ['URL', data.url || 'N/A']
        ];

        if (data.headers && Object.keys(data.headers).length > 0) {
          requestData.push(['Headers', '']);
          Object.entries(data.headers).forEach(([key, value]) => {
            requestData.push([`  ${key}`, String(value)]);
          });
        }

        if (data.body) {
          requestData.push(['Body', '']);
          if (typeof data.body === 'object') {
            Object.entries(data.body).forEach(([key, value]) => {
              requestData.push([`  ${key}`, String(value)]);
            });
          } else {
            requestData.push(['  Content', String(data.body)]);
          }
        }

        currentY = addStyledTable(pdf, requestData, 20, currentY, ['Field', 'Value'], [40, 140]);
      } 
      else if (title === 'RESPONSE' && data) {
        const responseData = [
          ['Status', `${data.status} ${data.statusText}`]
        ];

        if (data.headers && Object.keys(data.headers).length > 0) {
          responseData.push(['Headers', '']);
          Object.entries(data.headers).forEach(([key, value]) => {
            responseData.push([`  ${key}`, turkishToAscii(String(value))]);
          });
        }

        if (data.body) {
          responseData.push(['Body', '']);
          if (typeof data.body === 'object') {
            Object.entries(data.body).forEach(([key, value]) => {
              responseData.push([`  ${key}`, turkishToAscii(String(value))]);
            });
          } else {
            responseData.push(['  Content', turkishToAscii(String(data.body))]);
          }
        }

        currentY = addStyledTable(pdf, responseData, 20, currentY, ['Field', 'Value'], [40, 140]);
      }
      else {
        // Fallback to JSON string representation for other data
        const jsonString = JSON.stringify(data, null, 2);
        const lines = jsonString.split('\n').slice(0, 15); // Limit lines
        
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        
        lines.forEach(line => {
          if (currentY > 270) {
            pdf.addPage();
            currentY = 20;
          }
          pdf.text(turkishToAscii(line.substring(0, 80)), 20, currentY);
          currentY += 3;
        });
      }
      
    } catch (error) {
      console.error(`[PDF Export] JSON section ${title} hatası:`, error);
      pdf.setFontSize(8);
      pdf.setTextColor(255, 0, 0);
      pdf.text('Error formatting data', 20, currentY);
      currentY += 5;
    }
    
    return currentY + 5;
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'success':
        return { bg: { r: 34, g: 197, b: 94 }, text: { r: 0, g: 100, b: 0 } };
      case 'error':
        return { bg: { r: 239, g: 68, b: 68 }, text: { r: 200, g: 0, b: 0 } };
      default:
        return { bg: { r: 156, g: 163, b: 175 }, text: { r: 100, g: 100, b: 100 } };
    }
  };

  const getScenarioStatusColors = (status: string) => {
    switch (status) {
      case 'success':
        return { bg: { r: 34, g: 197, b: 94 }, text: { r: 255, g: 255, b: 255 } };
      case 'failed':
        return { bg: { r: 239, g: 68, b: 68 }, text: { r: 255, g: 255, b: 255 } };
      case 'pending':
        return { bg: { r: 245, g: 158, b: 11 }, text: { r: 255, g: 255, b: 255 } };
      default:
        return { bg: { r: 156, g: 163, b: 175 }, text: { r: 255, g: 255, b: 255 } };
    }
  };

  const getScenarioStatusText = (status: string): string => {
    switch (status) {
      case 'success': return 'BASARILI';
      case 'failed': return 'HATALI';
      case 'pending': return 'BEKLEMEDE';
      default: return 'BILINMEYEN';
    }
  };

  const formatScenarioDetails = (scenario: TestScenario): string[] => {
    const details = [];
    
    if (scenario.details.token) {
      details.push(`Token: ${scenario.details.token.substring(0, 15)}...`);
    }
    if (scenario.details.hash) {
      details.push(`Hash: ${scenario.details.hash.substring(0, 15)}...`);
    }
    if (scenario.details.paymentId) {
      details.push(`Payment ID: ${scenario.details.paymentId}`);
    }
    if (scenario.details.orderId) {
      details.push(`Order ID: ${scenario.details.orderId}`);
    }
    if (scenario.details.amount) {
      details.push(`Tutar: ${scenario.details.amount} TL`);
    }
    if (scenario.details.errorCode) {
      details.push(`Hata: ${scenario.details.errorCode}`);
    }
    if (scenario.details.errorMessage) {
      details.push(`Mesaj: ${scenario.details.errorMessage.substring(0, 20)}...`);
    }

    return details;
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'token': return 'TOKEN ALMA';
      case 'payment': return 'ODEME';
      case 'cancel': return 'IPTAL';
      case 'refund': return 'IADE';
      default: return type.toUpperCase();
    }
  };

  const formatCardNumber = (cardNumber: string): string => {
    if (!cardNumber) return 'N/A';
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length >= 16) {
      return cleaned.substring(0, 4) + '****' + cleaned.substring(cleaned.length - 4);
    }
    return cardNumber;
  };

  return {
    exportToPDF,
    isExporting
  };
}