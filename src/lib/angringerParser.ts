export interface AngringerRecord {
  kundenummer: string;
  produkt: string;
  selger: string;
  salesdate: string;
  regretdate: string;
  period: number; // Days between salesdate and regretdate
  plattform: string;
}

export function parseAngringerCSV(csvContent: string): AngringerRecord[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV must have headers and at least one data row');
  }

  // Parse header to find column indices
  const headerLine = lines[0];
  // Try both tab and comma as separators
  let headers = headerLine.split('\t').map(h => h.trim());
  if (headers.length < 3) {
    headers = headerLine.split(',').map(h => h.trim());
  }
  
  console.log('📋 CSV Headers found:', headers);
  
  const getColumnIndex = (columnName: string): number => {
    const lowerName = columnName.toLowerCase();
    return headers.findIndex(h => h.toLowerCase().includes(lowerName));
  };

  // Find all needed column indices
  const tempIdIndex = getColumnIndex('customer.temp_id');
  const productIndex = getColumnIndex('product');
  const salespersonIndex = getColumnIndex('salespaerson'); // Note: typo in original
  const salesdateIndex = getColumnIndex('salesdate');
  const regretdateIndex = getColumnIndex('regretdate');
  const categoryIndex = getColumnIndex('product.category');

  if (
    tempIdIndex === -1 ||
    productIndex === -1 ||
    salespersonIndex === -1 ||
    salesdateIndex === -1 ||
    regretdateIndex === -1 ||
    categoryIndex === -1
  ) {
    throw new Error(
      `Missing required columns. Found: ${headers.join(', ')}`
    );
  }

  const records: AngringerRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Use same separator as headers
    let values = line.split('\t').map(v => v.trim());
    if (values.length < 3) {
      values = line.split(',').map(v => v.trim());
    }
    
    if (i === 1) {
      console.log('📊 Sample row 1 values:', values);
      console.log('  Mapping: TempID=[' + values[tempIdIndex] + '], Product=[' + values[productIndex] + '], Person=[' + values[salespersonIndex] + ']');
    }

    // Get values from correct columns
    const kundenummer = values[tempIdIndex] || '';
    const produkt = values[productIndex] || '';
    const selger = values[salespersonIndex] || '';
    const salesdateStr = values[salesdateIndex] || '';
    const regretdateStr = values[regretdateIndex] || '';
    const plattform = values[categoryIndex] || '';

    // Skip if missing critical fields
    if (!kundenummer || !produkt || !selger) continue;

    // Parse dates and calculate period
    const salesDate = parseDate(salesdateStr);
    const regretDate = parseDate(regretdateStr);
    const period = calculateDays(salesDate, regretDate);

    records.push({
      kundenummer,
      produkt,
      selger: normalizeSelger(selger),
      salesdate: salesDate,
      regretdate: regretDate,
      period,
      plattform,
    });
  }

  return records;
}

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Handle various formats: DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD
  let parts: string[] = [];
  
  if (dateStr.includes('/')) {
    parts = dateStr.split('/');
  } else if (dateStr.includes('.')) {
    parts = dateStr.split('.');
  } else if (dateStr.includes('-')) {
    // Already ISO format or similar
    return dateStr;
  }

  if (parts.length === 3) {
    // Assume DD/MM/YYYY or DD.MM.YYYY
    const day = String(parts[0]).padStart(2, '0');
    const month = String(parts[1]).padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

function calculateDays(salesDateStr: string, regretDateStr: string): number {
  if (!salesDateStr || !regretDateStr) return 0;

  try {
    const salesDate = new Date(salesDateStr);
    const regretDate = new Date(regretDateStr);
    
    const diffMs = regretDate.getTime() - salesDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (err) {
    return 0;
  }
}

function normalizeSelger(selger: string): string {
  // Normalize whitespace around "/"
  return selger.replace(/\s*\/\s*/g, ' / ').trim();
}
