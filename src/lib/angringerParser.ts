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
    const index = headers.findIndex(h => h.toLowerCase().includes(lowerName));
    console.log(`  📌 Column "${columnName}" found at index ${index}`);
    return index;
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
    
    if (i === 1) {
      console.log('📅 Date calculation sample:', {
        original_sales: salesdateStr,
        parsed_sales: salesDate,
        original_regret: regretdateStr,
        parsed_regret: regretDate,
        period_days: period
      });
    }

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
  
  // Handle various formats: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, DD.MM.YYYY, YYYY-MM-DD
  let parts: string[] = [];
  
  if (dateStr.includes('/')) {
    parts = dateStr.split('/');
  } else if (dateStr.includes('.')) {
    parts = dateStr.split('.');
  } else if (dateStr.includes('-')) {
    // Could be YYYY-MM-DD (ISO) or DD-MM-YYYY
    parts = dateStr.split('-');
  }

  if (parts.length === 3) {
    const part1 = parseInt(parts[0], 10);
    const part2 = parseInt(parts[1], 10);
    const part3 = parseInt(parts[2], 10);
    
    let year: string, month: string, day: string;
    
    // Detect YYYY format (first part > 1900)
    if (part1 > 1900) {
      // YYYY/MM/DD or YYYY-MM-DD
      year = String(part1);
      month = String(part2).padStart(2, '0');
      day = String(part3).padStart(2, '0');
    } else {
      // Last part is year
      year = String(part3);
      
      // Detect format: if first part > 12, it's DD/MM/YYYY; otherwise check second part
      if (part1 > 12) {
        // DD/MM/YYYY
        day = String(part1).padStart(2, '0');
        month = String(part2).padStart(2, '0');
      } else if (part2 > 12) {
        // MM/DD/YYYY (American)
        month = String(part1).padStart(2, '0');
        day = String(part2).padStart(2, '0');
      } else {
        // Ambiguous - assume DD/MM/YYYY (European)
        day = String(part1).padStart(2, '0');
        month = String(part2).padStart(2, '0');
      }
    }
    
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

function calculateDays(salesDateStr: string, regretDateStr: string): number {
  if (!salesDateStr || !regretDateStr) return 0;

  try {
    // Parse ISO dates more explicitly
    const [salesYear, salesMonth, salesDay] = salesDateStr.split('-').map(Number);
    const [regretYear, regretMonth, regretDay] = regretDateStr.split('-').map(Number);
    
    const salesDate = new Date(salesYear, salesMonth - 1, salesDay);
    const regretDate = new Date(regretYear, regretMonth - 1, regretDay);
    
    const diffMs = regretDate.getTime() - salesDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays); // Return 0 if negative
  } catch (err) {
    console.error('Error calculating days:', salesDateStr, regretDateStr, err);
    return 0;
  }
}

function normalizeSelger(selger: string): string {
  // Normalize whitespace around "/"
  return selger.replace(/\s*\/\s*/g, ' / ').trim();
}
