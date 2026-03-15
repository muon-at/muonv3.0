import { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MinSide.css';

interface SalesRecord {
  dato?: string;
  selger?: string;
  id?: string;
  produkt?: string;
  [key: string]: any;
}

interface BadgeDefinition {
  emoji: string;
  navn: string;
  verdi: string;
  beskrivelse: string;
}

// Badge definitions - only show badges with descriptions (from Admin panel)
const badgeDefinitions: BadgeDefinition[] = [
  { emoji: '🏆', navn: 'BEST', verdi: 'Løpende', beskrivelse: 'Den som har flest salg totalt (kun en)' },
  { emoji: '👑', navn: 'MVP MÅNED', verdi: 'Historisk', beskrivelse: 'Har vært best i minst en måned' },
  { emoji: '⭐', navn: 'MVP DAG', verdi: 'Historisk', beskrivelse: 'Har vært best på minst en dag' },
  { emoji: '🎓', navn: 'FØRSTE SALGET', verdi: '1+', beskrivelse: '1+ salg totalt' },
  { emoji: '🚀', navn: '5 SALG', verdi: '5+', beskrivelse: '5+ salg på EN dag' },
  { emoji: '🎯', navn: '10 SALG', verdi: '10+', beskrivelse: '10+ salg på EN dag' },
  { emoji: '🔥', navn: '15 SALG', verdi: '15+', beskrivelse: '15+ salg på EN dag' },
  { emoji: '💎', navn: '20 SALG', verdi: '20+', beskrivelse: '20+ salg på EN dag' },
];

// Normalize name for Firestore doc ID (remove slashes and special chars)
const normalizeName = (name: string): string => {
  return name.replace(/[\/\\]/g, '_').trim().toLowerCase();
};

const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  const trimmed = dateStr.trim();
  
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const ddmmyyyy2Match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy2Match) {
    const [, day, month, year] = ddmmyyyy2Match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return new Date(dateStr);
};

export default function MinSide() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [badgeStatus, setBadgeStatus] = useState<{ [key: string]: boolean }>({});
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    return parseInt(sessionStorage.getItem('maal_weekly') || '0') || 0;
  });
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    return parseInt(sessionStorage.getItem('maal_monthly') || '0') || 0;
  });
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const [progressData, setProgressData] = useState({
    dailyProgress: 0,
    dailyGoal: 0,
    weeklyProgress: 0,
    weeklyGoalValue: 0,
    monthlyProgress: 0,
    monthlyGoalValue: 0,
  });

  const [runRates, setRunRates] = useState({
    dailyTo16: 0,
    dailyTo21: 0,
    weekly: 0,
    monthly: 0,
  });

  const [earnings, setEarnings] = useState({
    total: 0,
    daily: 0,
    dailyTo16: 0,
    dailyTo21: 0,
    weekly: 0,
    monthly: 0,
  });

  const [departmentStats, setDepartmentStats] = useState({
    dayTotal: 0,
    dayContracts: 0,
    dayTopThree: [] as Array<{ name: string; count: number; contracts: number }>,
    weekTotal: 0,
    weekContracts: 0,
    weekTopThree: [] as Array<{ name: string; count: number; contracts: number }>,
    monthTotal: 0,
    monthContracts: 0,
    monthTopThree: [] as Array<{ name: string; count: number; contracts: number }>,
  });

  // Load saved goals from Firestore
  const loadSavedGoals = async () => {
    try {
      const externalName = user?.externalName || user?.name || '';
      if (!externalName) return;
      
      const normalizedName = normalizeName(externalName);
      const goalsRef = doc(db, 'employee_goals', normalizedName);
      const goalsDoc = await getDoc(goalsRef);
      
      if (goalsDoc.exists()) {
        const data = goalsDoc.data();
        if (data.weeklyGoal) setWeeklyGoal(data.weeklyGoal);
        if (data.monthlyGoal) setMonthlyGoal(data.monthlyGoal);
        console.log('✅ Goals loaded from Firestore:', data);
      }
    } catch (err) {
      console.error('Error loading goals:', err);
    }
  };

  useEffect(() => {
    loadEmployeeData();
    loadSavedGoals();
    loadDepartmentStats();
    // Load cached badges from Firestore
    loadCachedBadges();
  }, [user]);

  // Count working days this week (Monday to today)
  const countWorkingDaysThisWeek = (date: Date) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
    
    let count = 0;
    for (let d = new Date(weekStart); d <= date; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  // Count working days (weekdays only, no weekends)
  const countWorkingDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let count = 0;
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++; // Skip Sunday (0) and Saturday (6)
    }
    return count;
  };

  // Count working days from start of month to today
  const countWorkingDaysThisMonth = (date: Date) => {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    
    let count = 0;
    for (let d = new Date(monthStart); d <= date; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  // Calculate run rates
  const calculateRunRates = (
    emojiCount: number,
    salesWeekly: number,
    salesMonthly: number
  ) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0); // 09:00
    const hoursWorked = Math.max(0, (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60));
    
    // Daily to 16:00 (6 working hours: 9-10, 10-11, 11-12, 12-13, 14-15, 15-16)
    const dailyTo16 = hoursWorked > 0 ? (emojiCount / hoursWorked) * 6 : 0;
    
    // Daily to 21:00 (10 working hours: 9-10, 10-11, 11-12, 12-13, 14-15, 15-16, 16-17, 17-18, 18-19, 19-21)
    const dailyTo21 = hoursWorked > 0 ? (emojiCount / hoursWorked) * 10 : 0;
    
    // Weekly: (today's emoji + week sales) / 5 days (hardcoded for consistency, allows testing on any day)
    const totalSalesWeek = emojiCount + salesWeekly;
    const weekly = totalSalesWeek / 5;
    
    // Monthly: (today's emoji + month sales) / actual working days in month (excluding weekends)
    const workingDaysMonth = countWorkingDaysThisMonth(now);
    const totalWorkingDaysInMonth = countWorkingDaysInMonth(now);
    const totalSalesMonth = emojiCount + salesMonthly;
    const monthly = workingDaysMonth > 0 ? (totalSalesMonth / workingDaysMonth) * totalWorkingDaysInMonth : 0;
    
    return {
      dailyTo16: Math.round(dailyTo16 * 100) / 100,
      dailyTo21: Math.round(dailyTo21 * 100) / 100,
      weekly: Math.round(weekly * 100) / 100,
      monthly: Math.round(monthly * 100) / 100,
    };
  };

  // Auto-sync goals to sessionStorage (instant persistence)
  useEffect(() => {
    sessionStorage.setItem('maal_weekly', weeklyGoal.toString());
    sessionStorage.setItem('maal_monthly', monthlyGoal.toString());
  }, [weeklyGoal, monthlyGoal]);

  // Update progress data when goals change
  useEffect(() => {
    setProgressData(prev => ({
      ...prev,
      dailyGoal: weeklyGoal > 0 ? Math.ceil(weeklyGoal / 5) : 0,
      weeklyGoalValue: weeklyGoal,
      monthlyGoalValue: monthlyGoal,
    }));
  }, [weeklyGoal, monthlyGoal]);

  // Update run rates every minute (real-time tracking)
  useEffect(() => {
    const timer = setInterval(() => {
      const rates = calculateRunRates(
        progressData.dailyProgress,
        progressData.weeklyProgress - progressData.dailyProgress,
        progressData.monthlyProgress - progressData.dailyProgress
      );
      setRunRates(rates);
    }, 60000); // Update every minute
    
    // Calculate immediately on load
    const rates = calculateRunRates(
      progressData.dailyProgress,
      progressData.weeklyProgress - progressData.dailyProgress,
      progressData.monthlyProgress - progressData.dailyProgress
    );
    setRunRates(rates);
    
    return () => clearInterval(timer);
  }, [progressData]);

  const loadCachedBadges = async () => {
    try {
      const externalName = user?.externalName || '';
      if (!externalName) return;
      
      const normalizedName = normalizeName(externalName);
      // Load badges from user_earned_badges collection (cached from last calculation)
      const badgeDocRef = doc(db, 'user_earned_badges', normalizedName);
      const badgeSnapshot = await getDoc(badgeDocRef);
      
      if (badgeSnapshot.exists()) {
        const badgeData = badgeSnapshot.data();
        const userEarnedBadges = badgeData.badges || [];
        const statusMap = badgeData.badgeMap || {};
        
        setEarnedBadges(userEarnedBadges);
        setBadgeStatus(statusMap);
      }
    } catch (err) {
      console.error('Error loading cached badges:', err);
    }
  };

  const saveBadges = async (badgeMap: { [key: string]: boolean }) => {
    try {
      const externalName = user?.externalName || '';
      if (!externalName) return;
      
      const normalizedName = normalizeName(externalName);
      // Save earned badges to user_earned_badges collection
      const earnedBadges = Object.keys(badgeMap).filter(emoji => badgeMap[emoji]);
      const badgesRef = doc(db, 'user_earned_badges', normalizedName);
      await setDoc(badgesRef, { 
        badges: earnedBadges, 
        badgeMap: badgeMap,
        updatedAt: new Date() 
      });
    } catch (err) {
      console.error('Error saving badges:', err);
    }
  };

  // Load department stats (all employees in same department)
  const loadDepartmentStats = async () => {
    try {
      if (!user?.department) return;

      const department = user.department;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Load all contracts
      const salesRef = collection(db, 'allente_kontraktsarkiv');
      const snapshot = await getDocs(salesRef);
      const contracts: SalesRecord[] = [];
      snapshot.forEach((doc) => {
        contracts.push({ id: doc.id, ...doc.data() });
      });

      // Get all employees in this department from Firestore
      const employeesRef = collection(db, 'employees');
      const empSnapshot = await getDocs(employeesRef);
      const deptEmployees = new Set<string>();
      
      empSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.department === department && data.externalName) {
          deptEmployees.add(data.externalName);
        }
      });

      // Build employee stats
      const employeeStats: { [key: string]: { dayCount: number; weekCount: number; monthCount: number; dayContracts: number; weekContracts: number; monthContracts: number } } = {};

      for (const empName of deptEmployees) {
        employeeStats[empName] = {
          dayCount: 0,
          weekCount: 0,
          monthCount: 0,
          dayContracts: 0,
          weekContracts: 0,
          monthContracts: 0,
        };

        // Load emoji counts for this employee
        for (let d = new Date(monthStart); d <= today; d.setDate(d.getDate() + 1)) {
          const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
          try {
            const emojiDocRef = doc(db, 'emoji_counts_daily', dateStr);
            const emojiSnapshot = await getDoc(emojiDocRef);
            if (emojiSnapshot.exists()) {
              const data = emojiSnapshot.data();
              const counts = data.counts?.[empName.toLowerCase()] || {};
              const total = (counts['🔔'] || 0) + (counts['💎'] || 0);
              
              if (total > 0) {
                employeeStats[empName].monthCount += total;
                if (d >= weekStart) {
                  employeeStats[empName].weekCount += total;
                }
                if (d.getTime() === today.getTime()) {
                  employeeStats[empName].dayCount += total;
                }
              }
            }
          } catch (err) {
            // Silently skip missing dates
          }
        }

        // Count contracts
        const empContracts = contracts.filter(c => (c.selger || '').startsWith(empName));
        employeeStats[empName].dayContracts = empContracts.filter(c => {
          const cDate = parseDate(c.dato || '');
          return cDate.getTime() === today.getTime();
        }).length;
        employeeStats[empName].weekContracts = empContracts.filter(c => {
          const cDate = parseDate(c.dato || '');
          return cDate >= weekStart && cDate <= today;
        }).length;
        employeeStats[empName].monthContracts = empContracts.filter(c => {
          const cDate = parseDate(c.dato || '');
          return cDate >= monthStart && cDate <= today;
        }).length;
      }

      // Calculate totals
      const dayTotal = Array.from(deptEmployees).reduce((sum, emp) => sum + employeeStats[emp].dayCount, 0);
      const dayContracts = Array.from(deptEmployees).reduce((sum, emp) => sum + employeeStats[emp].dayContracts, 0);
      const weekTotal = Array.from(deptEmployees).reduce((sum, emp) => sum + employeeStats[emp].weekCount, 0);
      const weekContracts = Array.from(deptEmployees).reduce((sum, emp) => sum + employeeStats[emp].weekContracts, 0);
      const monthTotal = Array.from(deptEmployees).reduce((sum, emp) => sum + employeeStats[emp].monthCount, 0);
      const monthContracts = Array.from(deptEmployees).reduce((sum, emp) => sum + employeeStats[emp].monthContracts, 0);

      // Build top 3 lists
      const getTop3 = (key: 'dayCount' | 'weekCount' | 'monthCount', contractKey: 'dayContracts' | 'weekContracts' | 'monthContracts') => {
        return Array.from(deptEmployees)
          .map(emp => ({
            name: emp,
            count: employeeStats[emp][key],
            contracts: employeeStats[emp][contractKey],
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
      };

      setDepartmentStats({
        dayTotal,
        dayContracts,
        dayTopThree: getTop3('dayCount', 'dayContracts'),
        weekTotal,
        weekContracts,
        weekTopThree: getTop3('weekCount', 'weekContracts'),
        monthTotal,
        monthContracts,
        monthTopThree: getTop3('monthCount', 'monthContracts'),
      });
    } catch (err) {
      console.error('Error loading department stats:', err);
    }
  };

  // Load emoji counts for today
  const loadEmployeeData = async () => {
    try {
      const salesRef = collection(db, 'allente_kontraktsarkiv');
      const snapshot = await getDocs(salesRef);
      
      const contracts: SalesRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        contracts.push({ id: doc.id, ...data });
      });

      // Filter for this employee
      const employeeContracts = contracts.filter(c => {
        const selger = c.selger || '';
        const externalName = user?.externalName || '';
        return selger === externalName || selger.startsWith(externalName + ' /');
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year

      const salesThisWeek = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= weekStart && date <= today;
      }).length;

      const salesThisMonth = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= monthStart && date <= today;
      }).length;

      const salesThisYear = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= yearStart && date <= today;
      }).length;

      const total = employeeContracts.length;

      // Calculate best day (highest number of contracts on any single date)
      const dayMap: { [key: string]: number } = {};
      employeeContracts.forEach(c => {
        const dateStr = c.dato || '';
        if (dateStr) {
          dayMap[dateStr] = (dayMap[dateStr] || 0) + 1;
        }
      });
      const bestDay = Math.max(0, ...Object.values(dayMap));
      console.log('📅 Best day for', user?.name, ':', bestDay, 'contracts');

      // Load products with provisjon
      let produktProvisjon: { [key: string]: number } = {};
      try {
        const produktRef = collection(db, 'allente_products');
        const produktSnapshot = await getDocs(produktRef);
        produktSnapshot.forEach((doc) => {
          const data = doc.data();
          const provisjon = parseFloat(data.provisjon || 0);
          produktProvisjon[doc.id] = provisjon;
        });
        console.log('💼 Products loaded:', produktProvisjon);
      } catch (err) {
        console.error('Error loading products:', err);
      }

      // Load gift count (🎁) for today
      let giftCountToday = 0;
      try {
        const today_str = today.toISOString().split('T')[0];
        const emojiCountsRef = doc(db, 'emoji_counts_daily', today_str);
        const emojiDoc = await getDoc(emojiCountsRef);
        if (emojiDoc.exists()) {
          const data = emojiDoc.data();
          const counts = data.counts || {};
          const userName = user?.name || '';
          const userEmojis = counts[userName] || { '🎁': 0 };
          giftCountToday = userEmojis['🎁'] || 0;
        }
      } catch (err) {
        console.error('Error loading gift count:', err);
      }

      // Get emoji counts for today with breakdown
      let bellCountToday = 0, gemCountToday = 0;
      let bellCountWeek = 0, gemCountWeek = 0;
      let bellCountMonth = 0, gemCountMonth = 0;
      try {
        const userName = user?.name || '';
        
        // Load emojis for ALL days in the week
        for (let d = new Date(weekStart); d <= today; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const emojiCountsRef = doc(db, 'emoji_counts_daily', dateStr);
          const emojiDoc = await getDoc(emojiCountsRef);
          if (emojiDoc.exists()) {
            const data = emojiDoc.data();
            const counts = data.counts || {};
            const userEmojis = counts[userName] || { '🔔': 0, '💎': 0 };
            bellCountWeek += userEmojis['🔔'] || 0;
            gemCountWeek += userEmojis['💎'] || 0;
          }
        }
        
        // Load emojis for ALL days in the month
        for (let d = new Date(monthStart); d <= today; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const emojiCountsRef = doc(db, 'emoji_counts_daily', dateStr);
          const emojiDoc = await getDoc(emojiCountsRef);
          if (emojiDoc.exists()) {
            const data = emojiDoc.data();
            const counts = data.counts || {};
            const userEmojis = counts[userName] || { '🔔': 0, '💎': 0 };
            bellCountMonth += userEmojis['🔔'] || 0;
            gemCountMonth += userEmojis['💎'] || 0;
          }
        }
        
        // Today's emojis
        const today_str = today.toISOString().split('T')[0];
        const emojiCountsRef = doc(db, 'emoji_counts_daily', today_str);
        const emojiDoc = await getDoc(emojiCountsRef);
        if (emojiDoc.exists()) {
          const data = emojiDoc.data();
          const counts = data.counts || {};
          const userEmojis = counts[userName] || { '🔔': 0, '💎': 0 };
          bellCountToday = userEmojis['🔔'] || 0;
          gemCountToday = userEmojis['💎'] || 0;
        }
      } catch (err) {
        console.error('Error loading emoji counts:', err);
      }

      // Calculate earnings
      // Get provisjon per product from contracts
      const contractEarnings = employeeContracts.reduce((sum, c) => {
        const produktName = c.produkt || '';
        const provisjon = produktProvisjon[produktName] || 0;
        return sum + provisjon;
      }, 0);

      // Emoji values: 🔔=800, 💎=1000, 🎁=-200
      const emojiEarningsToday = (bellCountToday * 800) + (gemCountToday * 1000) - (giftCountToday * 200);
      const totalEarnings = contractEarnings + emojiEarningsToday;

      // Week earnings
      const contractsWeek = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= weekStart && date <= today;
      });
      const weekEarnings = contractsWeek.reduce((sum, c) => {
        const produktName = c.produkt || '';
        const provisjon = produktProvisjon[produktName] || 0;
        return sum + provisjon;
      }, 0) + emojiEarningsToday; // Add today's emoji earnings

      // Month earnings
      const contractsMonth = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= monthStart && date <= today;
      });
      const monthEarnings = contractsMonth.reduce((sum, c) => {
        const produktName = c.produkt || '';
        const provisjon = produktProvisjon[produktName] || 0;
        return sum + provisjon;
      }, 0) + emojiEarningsToday; // Add today's emoji earnings

      // Calculate hours worked today
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
      const hoursWorked = Math.max(0, (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60));

      // Daily earnings runrate
      const dailyEarningsTo16 = hoursWorked > 0 ? (emojiEarningsToday / hoursWorked) * 6 : 0;
      const dailyEarningsTo21 = hoursWorked > 0 ? (emojiEarningsToday / hoursWorked) * 10 : 0;

      // Weekly earnings runrate
      const workingDaysWeek = Math.max(1, countWorkingDaysThisWeek(now));
      const weeklyEarningsRunrate = (weekEarnings / workingDaysWeek) * 5;

      // Monthly earnings runrate
      const workingDaysMonth = countWorkingDaysThisMonth(now);
      const totalWorkingDaysInMonth = countWorkingDaysInMonth(now);
      const monthlyEarningsRunrate = workingDaysMonth > 0 ? (monthEarnings / workingDaysMonth) * totalWorkingDaysInMonth : 0;

      setEarnings({
        total: Math.round(totalEarnings),
        daily: Math.round(emojiEarningsToday),
        dailyTo16: Math.round(dailyEarningsTo16 * 100) / 100,
        dailyTo21: Math.round(dailyEarningsTo21 * 100) / 100,
        weekly: Math.round(weeklyEarningsRunrate),
        monthly: Math.round(monthlyEarningsRunrate),
      });

      console.log('💰 Earnings calculated:', {
        contractEarnings,
        emojiEarningsToday,
        totalEarnings,
        weekEarnings,
        monthEarnings,
      });

      // Calculate progress data for bars (status = emojis + contracts)
      const dailyGoalCalc = weeklyGoal > 0 ? Math.ceil(weeklyGoal / 5) : 0;
      const emojiCountToday = bellCountToday + gemCountToday;
      const emojiCountWeek = bellCountWeek + gemCountWeek;
      const emojiCountMonth = bellCountMonth + gemCountMonth;
      
      setProgressData({
        dailyProgress: emojiCountToday,
        dailyGoal: dailyGoalCalc,
        weeklyProgress: emojiCountWeek + salesThisWeek,
        weeklyGoalValue: weeklyGoal,
        monthlyProgress: emojiCountMonth + salesThisMonth,
        monthlyGoalValue: monthlyGoal,
      });

      setStats([
        { value: bestDay, label: 'Dag', color: '#E8956E', icon: '📊' },
        { value: salesThisWeek, label: 'Uke', color: '#E8956E', icon: '📈' },
        { value: salesThisMonth, label: 'Måned', color: '#E8956E', icon: '🎯' },
        { value: salesThisYear, label: 'År', color: '#5B7FFF', icon: '📅' },
        { value: total, label: 'Allente', color: '#A855C9', icon: '⭐' },
      ]);

      // Calculate all employee stats for comparison
      const employeeStats: { [name: string]: { today: number; month: number; total: number; bestDay: number; salesByDay: { [date: string]: number } } } = {};
      
      contracts.forEach(c => {
        const selger = c.selger || '';
        const date = parseDate(c.dato || '');
        const dateStr = date ? date.toISOString().split('T')[0] : '';
        
        if (!employeeStats[selger]) {
          employeeStats[selger] = { today: 0, month: 0, total: 0, bestDay: 0, salesByDay: {} };
        }
        
        if (date && date.getTime() === today.getTime()) {
          employeeStats[selger].today++;
        }
        if (date && date >= monthStart && date <= today) {
          employeeStats[selger].month++;
        }
        employeeStats[selger].total++;
        
        // Track sales by day to find best day
        if (dateStr) {
          employeeStats[selger].salesByDay[dateStr] = (employeeStats[selger].salesByDay[dateStr] || 0) + 1;
        }
      });
      
      // Calculate best day for each employee
      Object.keys(employeeStats).forEach(selger => {
        const salesByDay = employeeStats[selger].salesByDay;
        employeeStats[selger].bestDay = Math.max(0, ...Object.values(salesByDay));
        

      });

      // Find best performers
      let bestOverall = '';
      let maxTotal = -1;
      let bestThisMonth = '';
      let maxMonth = -1;

      Object.entries(employeeStats).forEach(([name, stats]) => {
        if (stats.total > maxTotal) {
          maxTotal = stats.total;
          bestOverall = name;
        }
        if (stats.month > maxMonth) {
          maxMonth = stats.month;
          bestThisMonth = name;
        }
      });

      // Calculate badges based on definitions
      const earnedBadgesList: { badge: string; earned: boolean }[] = [];
      const externalName = user?.externalName || '';
      
      // Find matching employee in stats (might be "Name / rolle" format)
      let userStatsKey = externalName;
      if (!employeeStats[externalName]) {
        // Try to find by name prefix (handle "Name / rolle" format)
        const matchingKey = Object.keys(employeeStats).find(k => 
          k.startsWith(externalName) || k.includes(externalName)
        );
        if (matchingKey) {
          userStatsKey = matchingKey;
        }
      }
      
      const userBestDay = employeeStats[userStatsKey]?.bestDay || 0;
      
      console.log(`🔍 Looking up externalName="${externalName}" in employeeStats:`, {
        externalName,
        userStatsKey,
        found: employeeStats[userStatsKey] ? 'YES' : 'NO',
        userStats: employeeStats[userStatsKey],
        userBestDay,
        sampleKeys: Object.keys(employeeStats).slice(0, 3)
      });
      
      badgeDefinitions.forEach(def => {
        let earned = false;
        
        if (def.navn === 'BEST') {
          earned = userStatsKey !== '' && employeeStats[userStatsKey]?.total > 0 && bestOverall === userStatsKey;
        } else if (def.navn === 'MVP MÅNED') {
          earned = userStatsKey !== '' && employeeStats[userStatsKey]?.month > 0 && bestThisMonth === userStatsKey;
        } else if (def.navn === 'MVP DAG') {
          // MVP DAG: Ever had a best day (historisk) - if bestDay > 5
          earned = userBestDay >= 6;  // If they had 6+ salg on their best day
        } else if (def.navn === 'FØRSTE SALGET') {
          earned = total > 0;
        } else if (def.navn === '5 SALG') {
          // 5+ salg på EN dag (historisk best day)
          earned = userBestDay >= 5;
        } else if (def.navn === '10 SALG') {
          // 10+ salg på EN dag (historisk best day)
          earned = userBestDay >= 10;
        } else if (def.navn === '15 SALG') {
          // 15+ salg på EN dag (historisk best day)
          earned = userBestDay >= 15;
        } else if (def.navn === '20 SALG') {
          // 20+ salg på EN dag (historisk best day)
          earned = userBestDay >= 20;
        }
        
        earnedBadgesList.push({ badge: def.emoji, earned });
      });

      // Badge calculation complete
      setEarnedBadges(earnedBadgesList.map(b => b.badge));
      
      // Store earned status map for styling
      const statusMap: { [key: string]: boolean } = {};
      earnedBadgesList.forEach(b => {
        statusMap[b.badge] = b.earned;
      });
      setBadgeStatus(statusMap);
      console.log('✅ Badge Status Map:', statusMap);
      
      // Save badges to Firestore for all employees to see on their Min Side
      await saveBadges(statusMap);
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading employee data:', err);
      setLoading(false);
    }
  };

  if (loading) return <div className="minside-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Laster...</div></div>;

  console.log('🏅 Rendering MinSide with earnedBadges:', earnedBadges);

  return (
    <div className="minside-container">
      {/* HEADER - SHOW USER NAME + ROLE + EARNED BADGES */}
      <div className="page-header-standard minside-header-large">
        <div className="header-left">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <h1>{user?.name}</h1>
              {/* All Badges in Header - Earned and Unearned */}
              {earnedBadges.length > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {earnedBadges.map((badge, idx) => {
                    const isEarned = badgeStatus[badge] !== false;
                    // Find badge definition to get name
                    const badgeDef = badgeDefinitions.find(b => b.emoji === badge);
                    const badgeName = badgeDef?.navn || `Badge ${idx + 1}`;
                    const tooltipText = `${badge} ${badgeName}${isEarned ? '' : ' (locked)'}`;
                    
                    return (
                      <span 
                        key={idx} 
                        style={{ 
                          fontSize: '2rem', 
                          lineHeight: '1',
                          opacity: isEarned ? 1 : 0.3,
                          filter: isEarned ? 'none' : 'grayscale(100%)',
                          transition: 'opacity 0.3s ease',
                          cursor: 'pointer'
                        }} 
                        title={tooltipText}
                      >
                        {badge}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="subtitle">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="main-tabs">
        <button 
          className={`main-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Mine Stats
        </button>
        <button 
          className={`main-tab ${activeTab === 'target' ? 'active' : ''}`}
          onClick={() => setActiveTab('target')}
        >
          🎯 Mål
        </button>
        <button 
          className={`main-tab ${activeTab === 'avd' ? 'active' : ''}`}
          onClick={() => setActiveTab('avd')}
        >
          🏢 Min Avdeling
        </button>
        <button 
          className={`main-tab ${activeTab === 'project' ? 'active' : ''}`}
          onClick={() => setActiveTab('project')}
        >
          💼 Prosjekt
        </button>
      </div>



      {/* MAIN CONTENT - STATS TAB */}
      {activeTab === 'stats' && (
      <div className="minside-main">
        <div className="stats-and-earnings-container">
          <div className="stats-left-section">
            <div className="stats-circles">
          <div className="trophy-placeholder">🏆</div>
          {stats.map((stat, idx) => (
            <div key={idx} className="stat-circle" style={{ backgroundColor: stat.color }}>
              <div className="stat-number">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
          <div className="trophy-placeholder">🏆</div>
        </div>

        {/* PROGRESS BARS */}
        <div className="progress-section">
          <div className="progress-item">
            <div className="progress-label">
              <span>Dagens Mål</span>
              <span>{progressData.dailyGoal > 0 ? Math.round((progressData.dailyProgress / progressData.dailyGoal) * 100) : 0}%</span>
            </div>
            <div className="progress-bar blue">
              <div className="progress-fill" style={{ width: `${progressData.dailyGoal > 0 ? Math.min((progressData.dailyProgress / progressData.dailyGoal) * 100, 100) : 0}%` }}></div>
            </div>
            <div className="progress-text">{progressData.dailyProgress} / {progressData.dailyGoal} <span className="checkmark">{progressData.dailyProgress >= progressData.dailyGoal ? '✓ Mål nådd' : ''}</span></div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>Ukes Mål</span>
              <span>{progressData.weeklyGoalValue > 0 ? Math.round((progressData.weeklyProgress / progressData.weeklyGoalValue) * 100) : 0}%</span>
            </div>
            <div className="progress-bar green">
              <div className="progress-fill" style={{ width: `${progressData.weeklyGoalValue > 0 ? Math.min((progressData.weeklyProgress / progressData.weeklyGoalValue) * 100, 100) : 0}%` }}></div>
            </div>
            <div className="progress-text">{progressData.weeklyProgress} / {progressData.weeklyGoalValue} <span className="checkmark">{progressData.weeklyProgress >= progressData.weeklyGoalValue ? '✓ Mål nådd' : ''}</span></div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>Måneds Mål</span>
              <span>{progressData.monthlyGoalValue > 0 ? Math.round((progressData.monthlyProgress / progressData.monthlyGoalValue) * 100) : 0}%</span>
            </div>
            <div className="progress-bar orange">
              <div className="progress-fill" style={{ width: `${progressData.monthlyGoalValue > 0 ? Math.min((progressData.monthlyProgress / progressData.monthlyGoalValue) * 100, 100) : 0}%` }}></div>
            </div>
            <div className="progress-text">{progressData.monthlyProgress} / {progressData.monthlyGoalValue} <span className="checkmark">{progressData.monthlyProgress >= progressData.monthlyGoalValue ? '✓ Mål nådd' : ''}</span></div>
          </div>
        </div>

        {/* SALES & EARNINGS BOXES - 3 COMPACT BOXES (DAG, UKE, MÅNED) */}
        <div className="sales-earnings-section">
          {/* BOX 1: I DAG - 2 COLUMNS */}
          <div className="sales-box">
            <div className="sales-box-header">I DAG</div>
            <div className="sales-box-content-2col">
              {/* SALG COLUMN */}
              <div className="sales-column">
                <div className="sales-column-title">Salg</div>
                <div className="sales-row">
                  <span className="sales-label">Total:</span>
                  <span className="sales-value">{progressData.dailyProgress}</span>
                </div>
                <div className="sales-row small">
                  <span className="sales-label">→ 16:00:</span>
                  <span className="sales-value">{runRates.dailyTo16.toFixed(1)}</span>
                </div>
                <div className="sales-row small">
                  <span className="sales-label">→ 21:00:</span>
                  <span className="sales-value">{runRates.dailyTo21.toFixed(1)}</span>
                </div>
              </div>

              {/* LØNN COLUMN */}
              <div className="sales-column">
                <div className="sales-column-title">Lønn</div>
                <div className="sales-row">
                  <span className="sales-label">Total:</span>
                  <span className="sales-value">{earnings.daily.toLocaleString('no-NO')} kr</span>
                </div>
                <div className="sales-row small">
                  <span className="sales-label">→ 16:00:</span>
                  <span className="sales-value">{earnings.dailyTo16.toLocaleString('no-NO')} kr</span>
                </div>
                <div className="sales-row small">
                  <span className="sales-label">→ 21:00:</span>
                  <span className="sales-value">{earnings.dailyTo21.toLocaleString('no-NO')} kr</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOX 2: UKEN */}
          <div className="sales-box">
            <div className="sales-box-header">UKEN</div>
            <div className="sales-box-content">
              <div className="sales-row">
                <span className="sales-label">Salg til nå:</span>
                <span className="sales-value">{progressData.weeklyProgress}</span>
              </div>
              <div className="sales-row">
                <span className="sales-label">Lønn til nå:</span>
                <span className="sales-value">{earnings.weekly.toLocaleString('no-NO')} kr</span>
              </div>
              <div className="sales-divider"></div>
              <div className="sales-row small">
                <span className="sales-label">Runrate salg:</span>
                <span className="sales-value">{runRates.weekly.toFixed(1)}</span>
              </div>
              <div className="sales-row small">
                <span className="sales-label">Runrate lønn:</span>
                <span className="sales-value">{(earnings.weekly).toLocaleString('no-NO')} kr</span>
              </div>
            </div>
          </div>

          {/* BOX 3: MÅNEDEN */}
          <div className="sales-box">
            <div className="sales-box-header">MÅNEDEN</div>
            <div className="sales-box-content">
              <div className="sales-row">
                <span className="sales-label">Salg til nå:</span>
                <span className="sales-value">{progressData.monthlyProgress}</span>
              </div>
              <div className="sales-row">
                <span className="sales-label">Lønn til nå:</span>
                <span className="sales-value">{earnings.monthly.toLocaleString('no-NO')} kr</span>
              </div>
              <div className="sales-divider"></div>
              <div className="sales-row small">
                <span className="sales-label">Runrate salg:</span>
                <span className="sales-value">{runRates.monthly.toFixed(1)}</span>
              </div>
              <div className="sales-row small">
                <span className="sales-label">Runrate lønn:</span>
                <span className="sales-value">{(earnings.monthly).toLocaleString('no-NO')} kr</span>
              </div>
            </div>
          </div>
        </div>
          </div>

          {/* EARNINGS BOX - RIGHT SECTION */}
          <div className="earnings-right-section">
            <div className="earnings-box">
              <div className="earnings-header">
                <span className="earnings-icon">💰</span>
                <div>
                  <h3>Min Lønn</h3>
                  <p className="earnings-subtitle">Utvikling</p>
                </div>
                <span className="earnings-icon">💰</span>
              </div>

              {/* Three Column Layout: DAG | UKE | MÅNED */}
              <div className="earnings-overview">
                {/* DAG */}
                <div className="earnings-period">
                  <div className="earnings-period-label">DAG</div>
                  <div className="earnings-period-stat">
                    <span className="earnings-period-value">{earnings.daily.toLocaleString('no-NO')}</span>
                    <span className="earnings-period-unit">kr</span>
                  </div>
                  <div className="earnings-period-runrate">
                    <div className="earnings-period-rate">
                      <span className="earnings-period-time">→ 16:00</span>
                      <span className="earnings-period-amount">{earnings.dailyTo16.toLocaleString('no-NO')}</span>
                    </div>
                    <div className="earnings-period-rate">
                      <span className="earnings-period-time">→ 21:00</span>
                      <span className="earnings-period-amount">{earnings.dailyTo21.toLocaleString('no-NO')}</span>
                    </div>
                  </div>
                </div>

                {/* UKE */}
                <div className="earnings-period">
                  <div className="earnings-period-label">UKE</div>
                  <div className="earnings-period-header">Til nå</div>
                  <div className="earnings-period-stat">
                    <span className="earnings-period-value">{earnings.weekly.toLocaleString('no-NO')}</span>
                    <span className="earnings-period-unit">kr</span>
                  </div>
                  <div className="earnings-period-runrate">
                    <div className="earnings-period-runrate-label">Runrate</div>
                    <span className="earnings-period-runrate-value">{earnings.weekly.toLocaleString('no-NO')} kr</span>
                  </div>
                </div>

                {/* MÅNED */}
                <div className="earnings-period">
                  <div className="earnings-period-label">MÅNED</div>
                  <div className="earnings-period-header">Til nå</div>
                  <div className="earnings-period-stat">
                    <span className="earnings-period-value">{earnings.monthly.toLocaleString('no-NO')}</span>
                    <span className="earnings-period-unit">kr</span>
                  </div>
                  <div className="earnings-period-runrate">
                    <div className="earnings-period-runrate-label">Runrate</div>
                    <span className="earnings-period-runrate-value">{earnings.monthly.toLocaleString('no-NO')} kr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'avd' && (
      <div className="tab-content">
        <div className="content-title">
          <h3>{user?.department}</h3>
        </div>

        {/* DAY / WEEK / MONTH - Compact 3 column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
          {/* DAY */}
          <div>
            <h4 style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.95rem' }}>📅 DAY</h4>
            <div style={{ textAlign: 'center', marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.25rem' }}>Total</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#333' }}>{departmentStats.dayTotal + departmentStats.dayContracts}</div>
            </div>
            {departmentStats.dayTopThree.length > 0 && (
              <div>
                {departmentStats.dayTopThree.map((emp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid #eee' }}>
                    <span>#{idx + 1} {emp.name.split(' ')[0]}</span>
                    <span style={{ color: '#666' }}>{emp.count + emp.contracts}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* WEEK */}
          <div>
            <h4 style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.95rem' }}>📊 WEEK</h4>
            <div style={{ textAlign: 'center', marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.25rem' }}>Total</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#333' }}>{departmentStats.weekTotal + departmentStats.weekContracts}</div>
            </div>
            {departmentStats.weekTopThree.length > 0 && (
              <div>
                {departmentStats.weekTopThree.map((emp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid #eee' }}>
                    <span>#{idx + 1} {emp.name.split(' ')[0]}</span>
                    <span style={{ color: '#666' }}>{emp.count + emp.contracts}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MONTH */}
          <div>
            <h4 style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.95rem' }}>📈 MONTH</h4>
            <div style={{ textAlign: 'center', marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.25rem' }}>Total</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#333' }}>{departmentStats.monthTotal + departmentStats.monthContracts}</div>
            </div>
            {departmentStats.monthTopThree.length > 0 && (
              <div>
                {departmentStats.monthTopThree.map((emp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid #eee' }}>
                    <span>#{idx + 1} {emp.name.split(' ')[0]}</span>
                    <span style={{ color: '#666' }}>{emp.count + emp.contracts}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === 'project' && (
      <div className="tab-content">
        <div className="content-title">
          <h3>Prosjekt: {user?.project}</h3>
          <p className="content-subtitle">Se alle kontrakter fra prosjektet ditt</p>
        </div>
        <p>Innhold for prosjekt kommer snart...</p>
      </div>
      )}

      {activeTab === 'target' && (
      <div className="tab-content">
        <div className="goals-header" style={{ marginBottom: '2rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🎯</span>
          <div>
            <h3>Mine Mål</h3>
            <p>Ukesmål & Månedsmål</p>
          </div>
        </div>

        <div className="goals-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div className="goal-stat">
            <span className="goal-label">UKESMÅL</span>
            <span className="goal-value">{weeklyGoal}</span>
            <span className="goal-unit">ordrer/uke</span>
          </div>
          <div className="goal-stat">
            <span className="goal-label">MÅNEDSMÅL</span>
            <span className="goal-value">{monthlyGoal}</span>
            <span className="goal-unit">ordrer/måned</span>
          </div>
        </div>

        <button 
          className="edit-goals-btn" 
          onClick={async () => {
            if (showGoalEdit) {
              // Save mode: save and close
              try {
                const externalName = user?.externalName || user?.name || '';
                if (externalName) {
                  const normalizedName = normalizeName(externalName);
                  const goalsRef = doc(db, 'employee_goals', normalizedName);
                  await setDoc(goalsRef, {
                    weeklyGoal,
                    monthlyGoal,
                    updatedAt: new Date(),
                  }, { merge: true });
                  console.log('✅ Goals saved:', { weeklyGoal, monthlyGoal });
                }
              } catch (err) {
                console.error('❌ Error saving goals:', err);
              }
              setShowGoalEdit(false);
            } else {
              // Edit mode: open
              setShowGoalEdit(true);
            }
          }}
        >
          {showGoalEdit ? 'Lagre' : 'Endre mål'}
        </button>

        {showGoalEdit && (
          <div className="goal-edit-form">
            <input 
              type="number" 
              value={weeklyGoal} 
              onChange={(e) => setWeeklyGoal(parseInt(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              placeholder="Ukesmål"
              autoFocus
            />
            <input 
              type="number" 
              value={monthlyGoal} 
              onChange={(e) => setMonthlyGoal(parseInt(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              placeholder="Månedsmål"
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
