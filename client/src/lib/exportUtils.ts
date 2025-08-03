import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface JSPDF {
    autoTable: (options: any) => JSPDF;
  }
}

export interface TransactionData {
  id: number;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string | number;
  category?: {
    name: string;
    icon?: string;
  };
  currency?: string;
}

export interface ExportOptions {
  dateRange: {
    start: string;
    end: string;
  };
  userCurrency: string;
  currencySymbol: string;
}

// Format currency helper
const formatCurrency = (amount: number, currency: string, symbol: string): string => {
  if (currency === 'IDR') {
    return `${symbol}${amount.toLocaleString('id-ID')}`;
  }
  return `${symbol}${amount.toLocaleString('en-US')}`;
};

// Format date helper
const formatDate = (date: string | number): string => {
  let dateObj: Date;
  
  if (typeof date === 'number') {
    if (date > 9999999999) {
      dateObj = new Date(date);
    } else {
      dateObj = new Date(date * 1000);
    }
  } else {
    dateObj = new Date(date);
  }
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Format filename helper - remove special characters
const formatFilename = (dateStart: string, dateEnd: string): string => {
  const cleanStart = formatDate(dateStart).replace(/[^a-zA-Z0-9]/g, '_');
  const cleanEnd = formatDate(dateEnd).replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanStart}_to_${cleanEnd}`;
};

// Export to PDF with professional styling
export const exportToPDF = (
  transactions: TransactionData[],
  options: ExportOptions
): void => {
  const doc = new jsPDF();
  
  // Company/App branding
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header with modern gradient effect
  // Primary gradient background (emerald to blue)
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Add secondary gradient overlay for depth
  doc.setFillColor(59, 130, 246); // blue-500
  doc.rect(pageWidth * 0.7, 0, pageWidth * 0.3, 35, 'F');
  
  // Create professional logo container with shadow effect
  // Shadow for logo container
  doc.setFillColor(0, 0, 0, 0.1); // black with transparency simulation
  doc.roundedRect(16, 9, 12, 12, 2, 2, 'F');
  
  // Main logo container (white rounded square)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, 8, 12, 12, 2, 2, 'F');
  
  // Logo "M" letter with perfect centering
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('M', 19.5, 16.5);
  
  // App name with professional typography
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Monly AI', 32, 16);
  
  // Subtitle with better spacing
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(240, 253, 250); // emerald-50 for subtle contrast
  doc.text('Transaction Report', 32, 26);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Date range info with better positioning
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Report Period: ${formatDate(options.dateRange.start)} - ${formatDate(options.dateRange.end)}`, 20, 45);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, 20, 52);
  
  // Calculate summary
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = totalIncome - totalExpense;
  
  // Summary cards with enhanced styling
  const summaryY = 65;
  const cardWidth = 50;
  const cardHeight = 25;
  
  // Income card with subtle shadow and gradient
  // Card shadow
  doc.setFillColor(0, 0, 0, 0.05);
  doc.rect(21, summaryY + 1, cardWidth, cardHeight, 'F');
  // Main card
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.rect(20, summaryY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.5);
  doc.rect(20, summaryY, cardWidth, cardHeight);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL INCOME', 22, summaryY + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalIncome, options.userCurrency, options.currencySymbol), 22, summaryY + 16);
  
  // Expense card with subtle shadow
  // Card shadow
  doc.setFillColor(0, 0, 0, 0.05);
  doc.rect(76, summaryY + 1, cardWidth, cardHeight, 'F');
  // Main card
  doc.setFillColor(254, 242, 242); // red-50
  doc.rect(75, summaryY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(239, 68, 68); // red-500
  doc.setLineWidth(0.5);
  doc.rect(75, summaryY, cardWidth, cardHeight);
  doc.setTextColor(220, 38, 38); // red-600
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL EXPENSE', 77, summaryY + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalExpense, options.userCurrency, options.currencySymbol), 77, summaryY + 16);
  
  // Balance card with conditional styling
  // Card shadow
  doc.setFillColor(0, 0, 0, 0.05);
  doc.rect(131, summaryY + 1, cardWidth, cardHeight, 'F');
  // Main card
  doc.setFillColor(239, 246, 255); // blue-50
  doc.rect(130, summaryY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(59, 130, 246); // blue-500
  doc.setLineWidth(0.5);
  doc.rect(130, summaryY, cardWidth, cardHeight);
  doc.setTextColor(balance >= 0 ? 5 : 220, balance >= 0 ? 150 : 38, balance >= 0 ? 105 : 38);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('NET BALANCE', 132, summaryY + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(balance, options.userCurrency, options.currencySymbol), 132, summaryY + 16);
  
  // Prepare table data
  const tableData = transactions.map((transaction, index) => [
    index + 1,
    formatDate(transaction.date),
    transaction.description,
    transaction.category?.name || 'Uncategorized',
    transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
    formatCurrency(transaction.amount, options.userCurrency, options.currencySymbol)
  ]);
  
  // Table
  autoTable(doc, {
    startY: summaryY + 35,
    head: [['#', 'Date', 'Description', 'Category', 'Type', 'Amount']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: [51, 65, 85], // slate-700
    },
    headStyles: {
      fillColor: [16, 185, 129], // emerald-500 to match header gradient
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      lineWidth: 0.1,
      lineColor: [255, 255, 255]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 50 },
      3: { cellWidth: 30 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 35 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    margin: { left: 20, right: 20 },
  });
  
  // Footer with enhanced styling
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Add a subtle line above footer
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.line(20, doc.internal.pageSize.getHeight() - 20, pageWidth - 20, doc.internal.pageSize.getHeight() - 20);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
      `Page ${i} of ${pageCount}`,
      20,
      doc.internal.pageSize.getHeight() - 10
    );
    
    // Right side footer
    doc.text(
      `Monly AI Financial Report - ${new Date().getFullYear()}`,
      pageWidth - 20,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }
  
  // Save the PDF
  const fileName = `Monly_AI_Transactions_${formatFilename(options.dateRange.start, options.dateRange.end)}.pdf`;
  doc.save(fileName);
};

// Export to Excel with professional styling
export const exportToExcel = (
  transactions: TransactionData[],
  options: ExportOptions
): void => {
  // Calculate summary
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = totalIncome - totalExpense;
  
  // Prepare summary data
  const summaryData = [
    ['🟢 MONLY AI - TRANSACTION REPORT'],
    [''],
    [`Report Period: ${formatDate(options.dateRange.start)} - ${formatDate(options.dateRange.end)}`],
    [`Generated on: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`],
    [''],
    ['📊 FINANCIAL SUMMARY'],
    ['Total Income', formatCurrency(totalIncome, options.userCurrency, options.currencySymbol)],
    ['Total Expense', formatCurrency(totalExpense, options.userCurrency, options.currencySymbol)],
    ['Net Balance', formatCurrency(balance, options.userCurrency, options.currencySymbol)],
    [''],
    ['📋 TRANSACTION DETAILS'],
    ['No.', 'Date', 'Description', 'Category', 'Type', 'Amount'],
  ];
  
  // Prepare transaction data
  const transactionData = transactions.map((transaction, index) => [
    index + 1,
    formatDate(transaction.date),
    transaction.description,
    transaction.category?.name || 'Uncategorized',
    transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
    formatCurrency(transaction.amount, options.userCurrency, options.currencySymbol)
  ]);
  
  // Combine all data
  const allData = [...summaryData, ...transactionData];
  
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(allData);
  
  // Set column widths
  const columnWidths = [
    { wch: 5 },   // No.
    { wch: 12 },  // Date
    { wch: 30 },  // Description
    { wch: 15 },  // Category
    { wch: 10 },  // Type
    { wch: 18 },  // Amount
  ];
  worksheet['!cols'] = columnWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
  
  // Save the file
  const fileName = `Monly_AI_Transactions_${formatFilename(options.dateRange.start, options.dateRange.end)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
