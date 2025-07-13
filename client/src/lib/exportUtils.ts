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
  
  // Header with gradient effect (simulated with colors)
  doc.setFillColor(51, 65, 85); // slate-700
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('💰 MONLY AI - Transaction Report', 20, 16);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Date range info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Report Period: ${formatDate(options.dateRange.start)} - ${formatDate(options.dateRange.end)}`, 20, 35);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, 20, 42);
  
  // Calculate summary
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = totalIncome - totalExpense;
  
  // Summary cards
  const summaryY = 55;
  const cardWidth = 50;
  const cardHeight = 25;
  
  // Income card
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.rect(20, summaryY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(167, 243, 208); // emerald-300
  doc.rect(20, summaryY, cardWidth, cardHeight);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.setFontSize(8);
  doc.text('TOTAL INCOME', 22, summaryY + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalIncome, options.userCurrency, options.currencySymbol), 22, summaryY + 16);
  
  // Expense card
  doc.setFillColor(254, 242, 242); // red-50
  doc.rect(75, summaryY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(252, 165, 165); // red-300
  doc.rect(75, summaryY, cardWidth, cardHeight);
  doc.setTextColor(220, 38, 38); // red-600
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL EXPENSE', 77, summaryY + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalExpense, options.userCurrency, options.currencySymbol), 77, summaryY + 16);
  
  // Balance card
  doc.setFillColor(239, 246, 255); // blue-50
  doc.rect(130, summaryY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(147, 197, 253); // blue-300
  doc.rect(130, summaryY, cardWidth, cardHeight);
  doc.setTextColor(balance >= 0 ? 5 : 220, balance >= 0 ? 150 : 38, balance >= 0 ? 105 : 38);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
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
      fillColor: [51, 65, 85], // slate-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
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
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
      `Page ${i} of ${pageCount} | Monly AI Financial Report`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
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
    ['MONLY AI - TRANSACTION REPORT'],
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
    ['SUMMARY'],
    ['Total Income', formatCurrency(totalIncome, options.userCurrency, options.currencySymbol)],
    ['Total Expense', formatCurrency(totalExpense, options.userCurrency, options.currencySymbol)],
    ['Net Balance', formatCurrency(balance, options.userCurrency, options.currencySymbol)],
    [''],
    ['TRANSACTION DETAILS'],
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
