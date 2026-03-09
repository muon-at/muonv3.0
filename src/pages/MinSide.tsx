import { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MinSide.css';
import AvdelingDashboard from './AvdelingDashboard';
import ProsjektDashboard from './ProsjektDashboard';

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
  // Try to restore from sessionStorage on mount
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    const stored = sessionStorage.getItem('maal_weekly');
    return stored ? parseInt(stored) : 0;
  });
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const stored = sessionStorage.getItem('maal_monthly');
    return stored ? parseInt(stored) : 0;
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

  // Load saved goals from Firestore
  const loadSavedGoals = async () => {
    console.log('🎯 loadSavedGoals() called! User:', user);
    
    try {
      // ✅ USE USER ID as document ID (always unique and consistent)
      const goalKey = user?.id || '';
      console.log('🔑 Goal key (user.id):', goalKey);
      
      if (!goalKey) {
        console.warn('⚠️ No user ID found for goals');
        // Try localStorage as fallback
        const stored = localStorage.getItem(`goals_${user?.name}`);
        console.log('💾 Trying localStorage for:', user?.name, '→', stored);
        if (stored) {
          const parsed = JSON.parse(stored);
          setWeeklyGoal(parsed.weeklyGoal || 0);
          setMonthlyGoal(parsed.monthlyGoal || 0);
          console.log('✅ Goals loaded from localStorage:', parsed);
        }
        return;
      }
      
      console.log('🔍 Loading goals for user ID:', goalKey);
      
      const goalsRef = doc(db, 'employee_goals', goalKey);
      const goalsDoc = await getDoc(goalsRef);
      
      if (goalsDoc.exists()) {
        const data = goalsDoc.data();
        setWeeklyGoal(data.weeklyGoal || 0);
        setMonthlyGoal(data.monthlyGoal || 0);
        // Also cache in localStorage as backup
        localStorage.setItem(`goals_${user?.name}`, JSON.stringify(data));
        console.log('✅ Goals loaded from Firestore:', { goalKey, data });
      } else {
        console.log('ℹ️ No goals found in Firestore for:', goalKey);
        // Try localStorage as fallback
        const stored = localStorage.getItem(`goals_${user?.name}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setWeeklyGoal(parsed.weeklyGoal || 0);
          setMonthlyGoal(parsed.monthlyGoal || 0);
          console.log('💾 Goals loaded from localStorage backup:', parsed);
        }
      }
    } catch (err) {
      console.error('❌ Error loading goals:', err);
    }
  };

  // Load data on mount and when user ID changes
  useEffect(() => {
    if (user?.id) {
      console.log('👤 User loaded, loading goals...');
      loadSavedGoals();  // Load goals as soon as user.id is available
    }
    loadEmployeeData();
    loadCachedBadges();
  }, [user?.id]);  // ✅ Changed: Trigger when user.id changes (not whole user object)

  // Sync goals to sessionStorage whenever they change
  useEffect(() => {
    console.log('💾 Syncing goals to sessionStorage:', { weeklyGoal, monthlyGoal });
    sessionStorage.setItem('maal_weekly', weeklyGoal.toString());
    sessionStorage.setItem('maal_monthly', monthlyGoal.toString());
  }, [weeklyGoal, monthlyGoal]);

  // Also reload goals when activeTab changes to 'target' (Mål tab)
  useEffect(() => {
    if (activeTab === 'target') {
      loadSavedGoals();  // ✅ Reload when switching to Mål tab
      console.log('📊 Reloading goals when opening Mål tab');
    }
  }, [activeTab]);

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
      
      // Load badges from user_earned_badges collection (cached from last calculation)
      const badgeDocRef = doc(db, 'user_earned_badges', externalName);
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
      
      // Save earned badges to user_earned_badges collection
      const earnedBadges = Object.keys(badgeMap).filter(emoji => badgeMap[emoji]);
      const badgesRef = doc(db, 'user_earned_badges', externalName);
      await setDoc(badgesRef, { 
        badges: earnedBadges, 
        badgeMap: badgeMap,
        updatedAt: new Date() 
      });
    } catch (err) {
      console.error('Error saving badges:', err);
    }
  };

  // Load emoji counts for today
  const loadEmojiCountsForToday = async () => {
    try {
      const today = new Date();
      const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const emojiCountsRef = doc(db, 'emoji_counts_daily', dateKey);
      const emojiDoc = await getDoc(emojiCountsRef);
      
      if (emojiDoc.exists()) {
        const data = emojiDoc.data();
        const counts = data.counts || {};
        
        // Get current user's name (try both externalName and full name)
        const userName = user?.name || '';
        const userEmojis = counts[userName] || { '🔔': 0, '💎': 0 };
        
        console.log('📊 Emoji counts for', userName, ':', userEmojis);
        
        // Return sum of 🔔 (1 pt) + 💎 (1 pt)
        return (userEmojis['🔔'] || 0) + (userEmojis['💎'] || 0);
      }
      return 0;
    } catch (err) {
      console.error('Error loading emoji counts:', err);
      return 0;
    }
  };

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

      // Load emoji counts for today (🔔 + 💎)
      const emojiCountToday = await loadEmojiCountsForToday();

      // Count contracts this week
      const contractsThisWeek = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= weekStart && date <= today;
      }).length;
      
      // Add emojis from today to weekly progress
      const salesThisWeek = contractsThisWeek + emojiCountToday;
      console.log('📊 Weekly Progress:', { contractsThisWeek, emojiCountToday, total: salesThisWeek });

      // Count contracts this month
      const contractsThisMonth = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= monthStart && date <= today;
      }).length;
      
      // Add emojis from today to monthly progress
      const salesThisMonth = contractsThisMonth + emojiCountToday;
      console.log('📈 Monthly Progress:', { contractsThisMonth, emojiCountToday, total: salesThisMonth });

      // Calculate BEST WEEK HISTORICALLY (any Monday-Sunday period)
      const weekMap: { [key: string]: number } = {};
      employeeContracts.forEach(c => {
        const date = parseDate(c.dato || '');
        if (date) {
          // Find Monday of this week
          const dayOfWeek = date.getDay();
          const mondayDate = new Date(date);
          mondayDate.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          const weekKey = mondayDate.toISOString().split('T')[0];
          weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
        }
      });
      const bestWeek = Math.max(0, ...Object.values(weekMap));
      console.log('📊 Best week for', user?.name, ':', bestWeek, 'contracts');

      // Calculate BEST MONTH HISTORICALLY (any calendar month)
      const monthMap: { [key: string]: number } = {};
      employeeContracts.forEach(c => {
        const date = parseDate(c.dato || '');
        if (date) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
        }
      });
      const bestMonth = Math.max(0, ...Object.values(monthMap));
      console.log('📈 Best month for', user?.name, ':', bestMonth, 'contracts');

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

      // Load products with provisjon (store as-is with escape chars, handle in matching)
      let produktProvisjon: { [key: string]: number } = {};
      try {
        const produktRef = collection(db, 'allente_products');
        const produktSnapshot = await getDocs(produktRef);
        produktSnapshot.forEach((doc) => {
          const data = doc.data();
          const provisjon = parseFloat(data.provisjon || 0);
          // Store with original key (will handle escape chars in matching logic)
          produktProvisjon[doc.id] = provisjon;
        });
        console.log('💼 Products loaded:', Object.keys(produktProvisjon).length, 'produkter');
        console.log('🔑 Sample keys:', Object.keys(produktProvisjon).slice(0, 3));
      } catch (err) {
        console.error('Error loading products:', err);
      }

      // Get emoji counts for today with breakdown
      let bellCountToday = 0, gemCountToday = 0, giftCountTodayEarnings = 0;
      try {
        const today_str = today.toISOString().split('T')[0];
        const emojiCountsRef = doc(db, 'emoji_counts_daily', today_str);
        const emojiDoc = await getDoc(emojiCountsRef);
        if (emojiDoc.exists()) {
          const data = emojiDoc.data();
          const counts = data.counts || {};
          const userName = user?.name || '';
          const userEmojis = counts[userName] || { '🔔': 0, '💎': 0, '🎁': 0 };
          bellCountToday = userEmojis['🔔'] || 0;
          gemCountToday = userEmojis['💎'] || 0;
          const giftCount = userEmojis['🎁'] || 0;
          giftCountTodayEarnings = giftCount;
          console.log('🎊 Emoji counts for today:', { bellCountToday, gemCountToday, giftCount, userName });
        }
      } catch (err) {
        console.error('Error loading emoji counts:', err);
      }

      // Calculate earnings
      // Debug: Show product names and matching
      console.log('🔍 MATCHING DEBUG:');
      console.log('  Contract samples:', employeeContracts.slice(0, 3).map(c => c.produkt));
      console.log('  Product keys sample:', Object.keys(produktProvisjon).slice(0, 3));
      
      // Get provisjon per product from contracts
      const contractEarnings = employeeContracts.reduce((sum, c) => {
        let produktName = c.produkt || '';
        
        // Try exact match first
        let provisjon = produktProvisjon[produktName] || 0;
        
        // If no exact match, try partial match (contract name starts with key)
        if (provisjon === 0) {
          for (const key in produktProvisjon) {
            // Clean key: remove escape quotes
            const cleanKey = key.replace(/\\"/g, '"').replace(/^"|"$/g, '');
            // Check if contract name starts with this product key
            if (produktName.startsWith(cleanKey)) {
              provisjon = produktProvisjon[key];
              break;
            }
          }
        }
        
        if (provisjon === 0 && produktName) {
          console.warn(`  ⚠️ No provisjon match for: "${produktName}"`);
        }
        return sum + provisjon;
      }, 0);
      console.log('💼 Contract earnings:', { contractEarnings, contractCount: employeeContracts.length });

      // Emoji values: 🔔=800, 💎=1000, 🎁=-200
      const emojiEarningsToday = (bellCountToday * 800) + (gemCountToday * 1000) - (giftCountTodayEarnings * 200);
      const totalEarnings = contractEarnings + emojiEarningsToday;
      console.log('💰 Daily earnings breakdown:', { bellCountToday, gemCountToday, giftCountTodayEarnings, emojiEarningsToday, totalEarnings });

      // Week earnings
      const contractsWeek = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= weekStart && date <= today;
      });
      const weekEarnings = contractsWeek.reduce((sum, c) => {
        let produktName = c.produkt || '';
        
        // Try exact match first
        let provisjon = produktProvisjon[produktName] || 0;
        
        // If no exact match, try partial match
        if (provisjon === 0) {
          for (const key in produktProvisjon) {
            const cleanKey = key.replace(/\\"/g, '"').replace(/^"|"$/g, '');
            if (produktName.startsWith(cleanKey)) {
              provisjon = produktProvisjon[key];
              break;
            }
          }
        }
        
        return sum + provisjon;
      }, 0) + emojiEarningsToday; // Add today's emoji earnings
      console.log('📊 Weekly earnings:', { contractsWeek: contractsWeek.length, weekEarnings, emojiEarningsToday });

      // Month earnings
      const contractsMonth = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= monthStart && date <= today;
      });
      const monthEarnings = contractsMonth.reduce((sum, c) => {
        let produktName = c.produkt || '';
        
        // Try exact match first
        let provisjon = produktProvisjon[produktName] || 0;
        
        // If no exact match, try partial match
        if (provisjon === 0) {
          for (const key in produktProvisjon) {
            const cleanKey = key.replace(/\\"/g, '"').replace(/^"|"$/g, '');
            if (produktName.startsWith(cleanKey)) {
              provisjon = produktProvisjon[key];
              break;
            }
          }
        }
        
        return sum + provisjon;
      }, 0) + emojiEarningsToday; // Add today's emoji earnings
      console.log('📈 Monthly earnings:', { contractsMonth: contractsMonth.length, monthEarnings, emojiEarningsToday });

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

      const earningsObj = {
        total: Math.round(totalEarnings),
        daily: Math.round(emojiEarningsToday),
        dailyTo16: Math.round(dailyEarningsTo16 * 100) / 100,
        dailyTo21: Math.round(dailyEarningsTo21 * 100) / 100,
        weekly: Math.round(weeklyEarningsRunrate),
        monthly: Math.round(monthlyEarningsRunrate),
      };
      
      console.log('✅ FINAL EARNINGS OBJECT:', earningsObj);
      console.log('📊 Runrate calculation:', {
        weeklyEarningsRunrate,
        monthlyEarningsRunrate,
        workingDaysWeek,
        workingDaysMonth,
        totalWorkingDaysInMonth,
      });
      
      setEarnings(earningsObj);

      console.log('💰 Earnings calculated:', {
        contractEarnings,
        emojiEarningsToday,
        totalEarnings,
        weekEarnings,
        monthEarnings,
      });

      // Calculate progress data for bars
      const dailyGoalCalc = weeklyGoal > 0 ? Math.ceil(weeklyGoal / 5) : 0;
      
      setProgressData({
        dailyProgress: emojiCountToday,
        dailyGoal: dailyGoalCalc,
        weeklyProgress: salesThisWeek,
        weeklyGoalValue: weeklyGoal,
        monthlyProgress: salesThisMonth,
        monthlyGoalValue: monthlyGoal,
      });

      setStats([
        { value: bestDay, label: 'Dag', color: '#E8956E', icon: '📊' },
        { value: bestWeek, label: 'Uke', color: '#E8956E', icon: '📈' },
        { value: bestMonth, label: 'Måned', color: '#E8956E', icon: '🎯' },
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

        {/* RUN RATE BOXES */}
        <div className="runrate-section">
          {/* Box 1: Daily Run Rates */}
          <div className="runrate-box">
            <div className="runrate-label">Dagens Runrate</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-time">→ 16:00</span>
                <span className="runrate-value">{runRates.dailyTo16.toFixed(1)}</span>
                <span className="runrate-unit">salg/dag</span>
              </div>
              <div className="runrate-divider">|</div>
              <div className="runrate-metric">
                <span className="runrate-time">→ 21:00</span>
                <span className="runrate-value">{runRates.dailyTo21.toFixed(1)}</span>
                <span className="runrate-unit">salg/dag</span>
              </div>
            </div>
          </div>

          {/* Box 2: Weekly Run Rate */}
          <div className="runrate-box">
            <div className="runrate-label">Ukes Runrate</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-value">{runRates.weekly.toFixed(1)}</span>
                <span className="runrate-unit">salg/uke</span>
              </div>
            </div>
          </div>

          {/* Box 3: Monthly Run Rate */}
          <div className="runrate-box">
            <div className="runrate-label">Månedens Runrate</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-value">{runRates.monthly.toFixed(1)}</span>
                <span className="runrate-unit">salg/måned</span>
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
        <AvdelingDashboard userDepartment={user?.department || 'KRS'} />
      )}

      {activeTab === 'project' && (
        <ProsjektDashboard userProject={user?.project || 'Allente'} />
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
                // ✅ USE USER ID as document ID (always unique and consistent)
                const goalKey = user?.id || '';
                console.log('💾 Saving goals - user ID:', goalKey, 'Weekly:', weeklyGoal, 'Monthly:', monthlyGoal);
                
                if (!goalKey) {
                  alert('❌ Kunne ikke lagre: Bruker ikke identifisert');
                  console.error('❌ No user ID found!');
                  return;
                }
                
                const goalsRef = doc(db, 'employee_goals', goalKey);
                const saveData = {
                  weeklyGoal: weeklyGoal || 0,
                  monthlyGoal: monthlyGoal || 0,
                  updatedAt: new Date().toISOString(),
                  userId: user?.id || 'unknown',
                };
                
                // ✅ IMMEDIATELY save to sessionStorage (instant backup)
                sessionStorage.setItem('maal_weekly', (weeklyGoal || 0).toString());
                sessionStorage.setItem('maal_monthly', (monthlyGoal || 0).toString());
                
                await setDoc(goalsRef, saveData, { merge: true });
                
                // Also backup to localStorage
                localStorage.setItem(`goals_${user?.name}`, JSON.stringify(saveData));
                
                console.log('✅ Goals saved to sessionStorage + Firestore + localStorage:', { goalKey, ...saveData });
                alert('✅ Mål lagret!');
              } catch (err) {
                console.error('❌ Error saving goals:', err);
                alert('❌ Feil ved lagring av mål: ' + (err as any).message);
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
