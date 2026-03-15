import { collection, getDocs, Firestore } from 'firebase/firestore';

export interface HistoricalRecord {
  dayBest: number;
  weekBest: number;
  monthBest: number;
}

export interface RecordsCache {
  [employeeName: string]: HistoricalRecord;
}

export interface BrokenRecord {
  employee: string;
  period: 'day' | 'week' | 'month';
  oldRecord: number;
  newRecord: number;
  hasEmojis: boolean;
  timestamp: Date;
}

// Helper: Parse date safely
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

// Helper: Get week start (Monday)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};



// Helper: Get all Mondays of a year for week indexing
const getWeekKey = (date: Date): string => {
  const weekStart = getWeekStart(date);
  return weekStart.toISOString().split('T')[0];
};

/**
 * Build historical records cache from all contracts
 * Scans 2024-2025 and calculates best day/week/month per employee
 */
export const buildRecordsCache = async (db: Firestore): Promise<RecordsCache> => {
  try {
    console.log('📊 Building historical records cache...');
    
    const salesRef = collection(db, 'allente_kontraktsarkiv');
    const snapshot = await getDocs(salesRef);
    const contracts: any[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const cDate = parseDate(data.dato || '');
      
      // Only include contracts from 2024-2025
      if (cDate && cDate.getFullYear() >= 2024) {
        contracts.push(data);
      }
    });

    const cache: RecordsCache = {};
    
    // Group contracts by employee
    const employeeContracts: { [key: string]: any[] } = {};
    contracts.forEach(c => {
      const emp = c.selger || '';
      if (emp) {
        if (!employeeContracts[emp]) employeeContracts[emp] = [];
        employeeContracts[emp].push(c);
      }
    });

    // For each employee, find best day/week/month
    Object.entries(employeeContracts).forEach(([emp, empContracts]) => {
      const dayBests: number[] = [];
      const weekBests: number[] = [];
      const monthBests: number[] = [];

      // Get date range
      const dates = empContracts
        .map(c => parseDate(c.dato || ''))
        .filter((d): d is Date => d !== null);
      
      if (dates.length === 0) return;

      // Calculate best day
      const dayMap: { [key: string]: number } = {};
      empContracts.forEach(c => {
        const dateStr = c.dato || '';
        dayMap[dateStr] = (dayMap[dateStr] || 0) + 1;
      });
      const dayBest = Math.max(0, ...Object.values(dayMap));
      dayBests.push(dayBest);

      // Calculate best week
      const weekMap: { [key: string]: number } = {};
      empContracts.forEach(c => {
        const cDate = parseDate(c.dato || '');
        if (cDate) {
          const weekKey = getWeekKey(cDate);
          weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
        }
      });
      const weekBest = Math.max(0, ...Object.values(weekMap));
      weekBests.push(weekBest);

      // Calculate best month
      const monthMap: { [key: string]: number } = {};
      empContracts.forEach(c => {
        const cDate = parseDate(c.dato || '');
        if (cDate) {
          const monthKey = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, '0')}`;
          monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
        }
      });
      const monthBest = Math.max(0, ...Object.values(monthMap));
      monthBests.push(monthBest);

      cache[emp] = {
        dayBest: Math.max(...dayBests),
        weekBest: Math.max(...weekBests),
        monthBest: Math.max(...monthBests),
      };
    });

    console.log('✅ Records cache built:', Object.keys(cache).length, 'employees');
    return cache;
  } catch (err) {
    console.error('Error building records cache:', err);
    return {};
  }
};

/**
 * Check if a current performance breaks a historical record
 */
export const checkRecordBreak = (
  employee: string,
  period: 'day' | 'week' | 'month',
  currentCount: number,
  currentWithEmojis: number,
  cache: RecordsCache
): BrokenRecord | null => {
  const historicalRecord = cache[employee];
  if (!historicalRecord) return null;

  const bestKey = `${period}Best` as keyof HistoricalRecord;
  const historicalBest = historicalRecord[bestKey];

  // Check if record is broken (with or without emojis)
  if (currentWithEmojis > historicalBest) {
    return {
      employee,
      period,
      oldRecord: historicalBest,
      newRecord: currentWithEmojis,
      hasEmojis: currentWithEmojis > currentCount,
      timestamp: new Date(),
    };
  }

  return null;
};

/**
 * Format record message for Discord
 */
export const formatRecordMessage = (record: BrokenRecord, department?: string, project?: string): string => {
  const periodText = {
    day: 'Dag',
    week: 'Uke',
    month: 'Måned',
  }[record.period];

  const location = department ? `på ${department}` : project ? `på ${project}` : '';
  const emojiText = record.hasEmojis ? ' (med emojis)' : '';

  return `🔥 NEW RECORD 🔥\n${record.employee} slo rekord ${location}!\n${periodText}: ${record.oldRecord} → **${record.newRecord}**${emojiText}`;
};
