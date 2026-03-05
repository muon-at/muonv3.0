/**
 * Parse CSV file and extract kontrakt records
 * New format:
 * - Row 1: Headers
 * - Row 2+: Kontraktdata (Status required)
 * - Rows without Status in column A are skipped (timestamp rows)
 * 
 * Column mapping (by index):
 * A=Status, B=Ordredato, C=Id, D=Kundenummer, E=Kunde, F=Produkter, 
 * G=Ordretype, H=Forhandler, I=Selger, J=Plattform
 */

export interface ParsedSalgRecord {
  id: string;
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
  
  if (lines.length < 2) {
    console.warn('⚠️ CSV file is empty or has only header');
    return [];
  }
  
  const records: ParsedSalgRecord[] = [];
  
  // Process data rows (skip header at index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    
    // Column A = Status - if empty, skip (it's a timestamp row)
    const status = values[0]?.trim();
    if (!status) {
      console.log('⏭️ Skipping row without Status:', line.substring(0, 50));
      continue;
    }
    
    // Extract values by column index
    const ordredato = values[1]?.trim() || ''; // B - Ordredato
    const idRaw = values[2]?.trim() || ''; // C - Id (might be in scientific notation)
    const kundenummerRaw = values[3]?.trim() || ''; // D - Kundenummer
    const kunde = values[4]?.trim() || ''; // E - Kunde
    const produkt = values[5]?.trim() || ''; // F - Produkter
    const ordertype = values[6]?.trim() || ''; // G - Ordretype
    const forhandler = values[7]?.trim() || ''; // H - Forhandler
    const selger = values[8]?.trim() || ''; // I - Selger
    const platform = values[9]?.trim() || ''; // J - Plattform
    
    // Convert scientific notation to regular number
    const id = convertScientificNotation(idRaw);
    const kundenummer = convertScientificNotation(kundenummerRaw);
    
    if (!kundenummer) {
      console.warn('⚠️ Skipping row with empty kundenummer');
      continue;
    }
    
    // Build record
    const record: ParsedSalgRecord = {
      id,
      kundenummer,
      kunde,
      ordredato,
      produkt,
      ordertype,
      forhandler,
      selger,
      platform,
      status,
    };
    
    console.log('✅ Parsed kontrakt:', record.kundenummer, '|', record.id);
    records.push(record);
  }
  
  console.log('🎉 Total kontrakter parsed:', records.length);
  return records;
}

function convertScientificNotation(value: string): string {
  if (!value) return '';
  
  // Check if it's scientific notation (e.g., "1.6E+09")
  const scientificMatch = value.match(/^([0-9.]+)E([+-]?\d+)$/i);
  if (scientificMatch) {
    const num = parseFloat(value);
    return Math.floor(num).toString();
  }
  
  return value;
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


