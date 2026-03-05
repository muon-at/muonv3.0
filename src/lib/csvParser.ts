/**
 * Parse CSV file and extract salg records
 * Handles multi-line format where:
 * - Line 1: Order data (Kundenummer, Kunde, Selger, etc.)
 * - Line 2: Timestamp (skip this)
 */

export interface ParsedSalgRecord {
  kundenummer: string;
  kunde: string;
  ordredato: string;
  produkt: string;
  ordertype: string;
  forhandler: string;
  selger: string;
  platform: string;
  status: string;
}

export function parseCSV(csvText: string): ParsedSalgRecord[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  // Find header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  console.log('📋 CSV Headers:', headers);
  
  // Map column names to indices
  const columnMap: { [key: string]: number } = {};
  headers.forEach((header, idx) => {
    const normalized = header.toLowerCase().trim().replace(/\s+/g, '');
    columnMap[normalized] = idx;
  });
  
  console.log('🗺️ Column map:', columnMap);
  
  const records: ParsedSalgRecord[] = [];
  
  // Process data rows (skip header and timestamp rows)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    
    // Get kundenummer - if empty, this is a timestamp row, skip it
    // Search in order: exact "kundenummer" first, then alternatives
    const kundenummerIdx = 
      Object.entries(columnMap).find(([key]) => key === 'kundenummer')?.[1] ||
      Object.entries(columnMap).find(([key]) => key.includes('kundenummer'))?.[1] ||
      Object.entries(columnMap).find(([key]) => key.includes('kundnr'))?.[1] ||
      undefined;
    
    if (kundenummerIdx === undefined) {
      console.warn('⚠️ Could not find kundenummer column');
      continue;
    }
    
    const kundenummer = values[kundenummerIdx]?.trim();
    
    // Skip if no kundenummer (this is a timestamp line)
    if (!kundenummer) {
      console.log('⏭️ Skipping timestamp line:', line.substring(0, 50));
      continue;
    }
    
    // Extract date from ordredato (remove time if present)
    const ordredatoIdx = 
      Object.entries(columnMap).find(([key]) => key === 'ordredato')?.[1] ||
      Object.entries(columnMap).find(([key]) => key.includes('ordredato'))?.[1] ||
      Object.entries(columnMap).find(([key]) => key.includes('date'))?.[1] ||
      undefined;
    
    const ordredatoFull = ordredatoIdx !== undefined ? values[ordredatoIdx]?.trim() : '';
    const ordredato = ordredatoFull?.split(' ')[0] || ''; // Get date part only
    
    // Build record
    const record: ParsedSalgRecord = {
      kundenummer,
      kunde: getColumnValue(values, columnMap, 'kunde', 'customer'),
      ordredato,
      produkt: getColumnValue(values, columnMap, 'produkter', 'produkt', 'product'),
      ordertype: getColumnValue(values, columnMap, 'ordretype', 'ordertype', 'type'),
      forhandler: getColumnValue(values, columnMap, 'forhandler', 'reseller'),
      selger: getColumnValue(values, columnMap, 'selger', 'seller'),
      platform: getColumnValue(values, columnMap, 'chosen platform', 'valgt platform', 'platform'),
      status: getColumnValue(values, columnMap, 'status'),
    };
    
    console.log('✅ Parsed record:', record.kundenummer, record.kunde);
    records.push(record);
  }
  
  console.log('🎉 Total records parsed:', records.length);
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function getColumnValue(
  values: string[],
  columnMap: { [key: string]: number },
  ...possibleNames: string[]
): string {
  for (const name of possibleNames) {
    const normalized = name.toLowerCase().replace(/\s+/g, '');
    
    // Try exact match first
    if (columnMap[normalized] !== undefined) {
      const idx = columnMap[normalized];
      return values[idx]?.trim() || '';
    }
    
    // Then try substring match
    const key = Object.keys(columnMap).find(k => k.includes(normalized));
    if (key) {
      const idx = columnMap[key];
      return values[idx]?.trim() || '';
    }
  }
  return '';
}
