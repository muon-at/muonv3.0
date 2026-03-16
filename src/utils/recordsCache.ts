import { collection, getDocs, Firestore } from 'firebase/firestore';

export interface HistoricalRecord {
  dayBest: number;
  dayBestEmployee?: string;
  weekBest: number;
  weekBestEmployee?: string;
  monthBest: number;
  monthBestEmployee?: string;
}

export interface DepartmentRecords {
  dayBest: number;
  dayBestEmployee?: string;
  weekBest: number;
  weekBestEmployee?: string;
  monthBest: number;
  monthBestEmployee?: string;
}

export interface RecordsCache {
  employees: {
    [employeeName: string]: HistoricalRecord;
  };
  departments: {
    [deptName: string]: DepartmentRecords;
  };
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
    
    console.log('🔍 SNAPSHOT:', snapshot.size, 'documents in allente_kontraktsarkiv');
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // FIELD NAMES: Ordredato, Selger (with format "Name / Selger"), Avdeling
      const ordredato = data.Ordredato || data.dato || '';
      const selgerRaw = data.Selger || data.selger || '';
      // Parse "Brandon / Selger" → "Brandon"
      const selgerName = selgerRaw.includes(' / ') ? selgerRaw.split(' / ')[0].trim() : selgerRaw;
      
      console.log('📄 Contract doc:', { ordredato, selger: selgerName, avdeling: data.Avdeling });
      
      // Parse date - handle "9/3/2026" or "yyyy-mm-dd"
      let cDate: Date | null = null;
      if (ordredato.includes('/')) {
        const [d, m, y] = ordredato.split('/').map(Number);
        cDate = new Date(y, m - 1, d);
      } else {
        cDate = parseDate(ordredato);
      }
      
      // Include ALL contracts (all years are live and dynamic)
      if (cDate && !isNaN(cDate.getTime())) {
        // Normalize field names for consistent calculation
        contracts.push({
          ...data,
          selger: selgerName,
          dato: cDate.toISOString().split('T')[0], // Normalize to YYYY-MM-DD
          Ordredato: ordredato // Keep original too
        });
      } else {
        console.log('⚠️ Invalid date:', ordredato);
      }
    });
    
    console.log('✅ Loaded contracts:', contracts.length, 'with valid dates');

    // Load employees to get department info
    const empRef = collection(db, 'employees');
    const empSnapshot = await getDocs(empRef);
    const empDepartments: { [emp: string]: string } = {};
    console.log('📋 ALL EMPLOYEES IN DB:');
    empSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('  -', data.externalName, '(dept:', data.department, ')');
      if (data.externalName) {
        empDepartments[data.externalName] = data.department || 'Unknown';
      }
    });
    console.log('✅ empDepartments map:', empDepartments);

    const employeeCache: { [key: string]: HistoricalRecord } = {};
    const departmentCache: { [key: string]: DepartmentRecords } = {};
    
    // Group contracts by employee
    const employeeContracts: { [key: string]: any[] } = {};
    contracts.forEach(c => {
      const emp = c.selger || '';
      if (emp) {
        if (!employeeContracts[emp]) employeeContracts[emp] = [];
        employeeContracts[emp].push(c);
      }
    });
    
    console.log('👥 UNIQUE SELLERS IN CONTRACTS:', Object.keys(employeeContracts));
    console.log('🔗 MATCHING CHECK:');
    Object.keys(employeeContracts).forEach(seller => {
      const foundInDept = empDepartments[seller] ? '✅ FOUND' : '❌ NOT FOUND';
      console.log(`  "${seller}" → ${foundInDept}`);
    });

    // Calculate EMPLOYEE records
    Object.entries(employeeContracts).forEach(([emp, empContracts]) => {
      // Calculate best day
      const dayMap: { [key: string]: number } = {};
      empContracts.forEach(c => {
        const dateStr = c.dato || '';
        dayMap[dateStr] = (dayMap[dateStr] || 0) + 1;
      });
      const dayBest = Math.max(0, ...Object.values(dayMap));

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

      employeeCache[emp] = {
        dayBest,
        weekBest,
        monthBest,
      };
    });

    // Calculate DEPARTMENT records (by totaling all employees in each dept)
    const deptContracts: { [dept: string]: any[] } = {};
    contracts.forEach(c => {
      const emp = c.selger || '';
      const dept = empDepartments[emp] || 'Unknown';
      if (!deptContracts[dept]) deptContracts[dept] = [];
      deptContracts[dept].push(c);
    });

    Object.entries(deptContracts).forEach(([dept, deptContractList]) => {
      // Calculate best day (dept total)
      const dayMap: { [key: string]: number } = {};
      deptContractList.forEach(c => {
        const dateStr = c.dato || '';
        dayMap[dateStr] = (dayMap[dateStr] || 0) + 1;
      });
      const dayBest = Math.max(0, ...Object.values(dayMap));

      // Calculate best week (dept total)
      const weekMap: { [key: string]: number } = {};
      deptContractList.forEach(c => {
        const cDate = parseDate(c.dato || '');
        if (cDate) {
          const weekKey = getWeekKey(cDate);
          weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
        }
      });
      const weekBest = Math.max(0, ...Object.values(weekMap));

      // Calculate best month (dept total)
      const monthMap: { [key: string]: number } = {};
      deptContractList.forEach(c => {
        const cDate = parseDate(c.dato || '');
        if (cDate) {
          const monthKey = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, '0')}`;
          monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
        }
      });
      const monthBest = Math.max(0, ...Object.values(monthMap));

      departmentCache[dept] = {
        dayBest,
        weekBest,
        monthBest,
      };
    });

    const result: RecordsCache = {
      employees: employeeCache,
      departments: departmentCache,
    };

    console.log('✅ Records cache built:', Object.keys(employeeCache).length, 'employees,', Object.keys(departmentCache).length, 'departments');
    return result;
  } catch (err) {
    console.error('Error building records cache:', err);
    return { employees: {}, departments: {} };
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
  cache: RecordsCache,
  isDepartment: boolean = false
): BrokenRecord | null => {
  const records = isDepartment ? cache.departments : cache.employees;
  const historicalRecord = records[employee];
  if (!historicalRecord) return null;

  const bestKey = `${period}Best` as keyof (HistoricalRecord | DepartmentRecords);
  const historicalBest = historicalRecord[bestKey] as number;

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
