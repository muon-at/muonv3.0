import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, addDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import FileUploadModal from '../components/FileUploadModal';
import '../styles/AdminDashboard.css';

interface Employee {
  id: string;
  name: string;
  email?: string;
  username?: string;
  password?: string;
  department?: string;
  role?: string;
  project?: string;
  slackName?: string;
  externalName?: string;
  tmgName?: string;
  stilling?: string;
}

interface SalgRecord {
  id: string;
  csvId?: string;
  kundeNr: string;
  kundeNavn?: string;
  beløp?: number;
  dato?: string;
  produkt?: string;
  selger?: string;
  platform?: string;
  avdeling?: string;
  [key: string]: any;
}

interface KontraktsarkivFilters {
  selger: string;
  avdeling: string;
  produkt: string;
  platform: string;
  datoFrom: string;
  datoTo: string;
}

export default function AdminDashboard() {
  console.log('✅ AdminDashboard component mounted!');
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState('allente');
  const [activeAllenteTab, setActiveAllenteTab] = useState('i-dag');
  const [dashboardFromDate, setDashboardFromDate] = useState('');
  const [dashboardToDate, setDashboardToDate] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; employeeId?: string; employeeName?: string }>({ show: false });
  const [deleting, setDeleting] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    project: 'Allente',
    department: 'OSL',
    slackName: '',
    externalName: '',
    tmgName: '',
    stilling: 'Fulltid',
  });
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; fileType?: 'salg' | 'stats' | 'angring' }>({ isOpen: false });
  const [salgData, setSalgData] = useState<SalgRecord[]>([]);
  const [loadingSalg, setLoadingSalg] = useState(false);
  const [angringerData, setAngringerData] = useState<any[]>([]);
  const [loadingAngringer, setLoadingAngringer] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [angringerFilters, setAngringerFilters] = useState({
    filnavn: '',
    kundenummer: '',
    produkt: '',
    selger: '',
    periode: '',
    plattform: '',
  });
  const [activeAngringerFilters, setActiveAngringerFilters] = useState(angringerFilters);
  const [produkterData, setProdukterData] = useState<any[]>([]);
  const [loadingProdukter, setLoadingProdukter] = useState(false);
  const [badgesData, setBadgesData] = useState<any[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);

  // Badge definitions - In-use (8) + Future (6)
  const badgeDefinitions = [
    // ACTIVE BADGES
    { emoji: '🏆', navn: 'BEST', verdi: 'Løpende', beskrivelse: 'Den som har flest salg totalt (kun en)' },
    { emoji: '👑', navn: 'MVP MÅNED', verdi: 'Historisk', beskrivelse: 'Har vært best i minst en måned' },
    { emoji: '⭐', navn: 'MVP DAG', verdi: 'Historisk', beskrivelse: 'Har vært best på minst en dag' },
    { emoji: '🎓', navn: 'FØRSTE SALGET', verdi: '1+', beskrivelse: '1+ salg totalt' },
    { emoji: '🚀', navn: '5 SALG', verdi: '5+', beskrivelse: '5+ salg på EN dag' },
    { emoji: '🎯', navn: '10 SALG', verdi: '10+', beskrivelse: '10+ salg på EN dag' },
    { emoji: '🔥', navn: '15 SALG', verdi: '15+', beskrivelse: '15+ salg på EN dag' },
    { emoji: '💎', navn: '20 SALG', verdi: '20+', beskrivelse: '20+ salg på EN dag' },
    // FUTURE BADGES
    { emoji: '💪', navn: '', verdi: '', beskrivelse: '' },
    { emoji: '☀️', navn: '', verdi: '', beskrivelse: '' },
    { emoji: '⚡', navn: '', verdi: '', beskrivelse: '' },
    { emoji: '🎭', navn: '', verdi: '', beskrivelse: '' },
    { emoji: '🏅', navn: '', verdi: '', beskrivelse: '' },
    { emoji: '🎖️', navn: '', verdi: '', beskrivelse: '' },
  ];
  

  const [progresjonData, setProgresjonData] = useState<any[]>([]);
  const [loadingProgresjon, setLoadingProgresjon] = useState(false);
  const [emojiCounts, setEmojiCounts] = useState<any>({}); // {selger: {🔔: count, 💎: count}}
  const [badgeWinner, setBadgeWinner] = useState<string | null>(null);
  const [mvpMånedWinners, setMvpMånedWinners] = useState<Set<string>>(new Set());
  const [mvpDagWinners, setMvpDagWinners] = useState<Set<string>>(new Set());
  const [thresholdBadges, setThresholdBadges] = useState<{ [key: string]: Set<string> }>({
    FØRSTE_SALGET: new Set(),
    SALG_5: new Set(),
    SALG_10: new Set(),
    SALG_15: new Set(),
    SALG_20: new Set(),
  });

  const thresholdBadgesList = [
    { badge: 'FØRSTE_SALGET', emoji: '🎓', type: 'total', threshold: 1, label: 'Første salget' },
    { badge: 'SALG_5', emoji: '🚀', type: 'day', threshold: 5, label: '5 Salg på en dag' },
    { badge: 'SALG_10', emoji: '🎯', type: 'day', threshold: 10, label: '10 Salg på en dag' },
    { badge: 'SALG_15', emoji: '🔥', type: 'day', threshold: 15, label: '15 Salg på en dag' },
    { badge: 'SALG_20', emoji: '💎', type: 'day', threshold: 20, label: '20 Salg på en dag' },
  ];
  const [filters, setFilters] = useState<KontraktsarkivFilters>({
    selger: '',
    avdeling: '',
    produkt: '',
    platform: '',
    datoFrom: '',
    datoTo: '',
  });
  const [activeFilters, setActiveFilters] = useState<KontraktsarkivFilters>({
    selger: '',
    avdeling: '',
    produkt: '',
    platform: '',
    datoFrom: '',
    datoTo: '',
  });

  // Fetch employees when Organisasjon tab is opened
  useEffect(() => {
    if (activeMainTab === 'organisasjon') {
      fetchEmployees();
    }
  }, [activeMainTab]);

  // Load dashboard data when dates change or tab opens
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'dashboard' && dashboardFromDate && dashboardToDate) {
      loadDashboardData();
    }
  }, [dashboardFromDate, dashboardToDate]);

  const loadDashboardData = async () => {
    try {
      // Fetch all contracts
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const contractsSnap = await getDocs(contractsRef);
      const contracts = contractsSnap.docs.map(doc => doc.data());

      // Fetch all produkter to get CPO values
      const produkterRef = collection(db, 'allente_produkter');
      const produkterSnap = await getDocs(produkterRef);
      const cpoMap: any = {};
      produkterSnap.forEach(doc => {
        const data = doc.data();
        cpoMap[data.navn] = parseFloat(data.cpo) || 0;
      });

      // Filter contracts by date
      const fromDate = new Date(dashboardFromDate);
      const toDate = new Date(dashboardToDate);
      
      // Add end-of-day to toDate
      toDate.setHours(23, 59, 59, 999);

      console.log('📊 DASHBOARD DEBUG:');
      console.log('  Input fra dato:', dashboardFromDate, '→ Parsed:', fromDate);
      console.log('  Input til dato:', dashboardToDate, '→ Parsed:', toDate);
      console.log('  Total kontrakter:', contracts.length);

      // Log some sample contracts to see date formats
      console.log('  Sample kontrakter (første 3):');
      contracts.slice(0, 3).forEach((c, i) => {
        console.log(`    [${i}] dato="${c.dato}" → parsed=${new Date(c.dato)}`);
      });

      // Parse date in DD/MM/YYYY format
      const parseDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        
        // Try DD/MM/YYYY format
        const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
        if (ddmmyyyy) {
          const [, day, month, year] = ddmmyyyy;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        
        // Fallback to standard parse
        return new Date(dateStr);
      };

      const filtered = contracts.filter(c => {
        if (!c.dato) return false;
        const cDate = parseDate(c.dato);
        if (!cDate || isNaN(cDate.getTime())) return false;
        const match = cDate >= fromDate && cDate <= toDate;
        return match;
      });

      console.log('  Filtrerte kontrakter (etter dato):', filtered.length);

      // Calculate per department
      const deptStats: any = {
        KRS: { salg: 0, omsetning: 0 },
        OSL: { salg: 0, omsetning: 0 },
        Skien: { salg: 0, omsetning: 0 },
        Annet: { salg: 0, omsetning: 0 },
      };

      let totalSalg = 0;
      let totalOmsetning = 0;

      filtered.forEach(c => {
        let avdeling = c.avdeling || 'Annet';
        
        // Map unknown departments to "Annet"
        if (!['KRS', 'OSL', 'Skien'].includes(avdeling)) {
          avdeling = 'Annet';
        }
        
        const cpo = cpoMap[c.produkt] || 0;

        if (deptStats[avdeling]) {
          deptStats[avdeling].salg += 1;
          deptStats[avdeling].omsetning += cpo;
        }

        totalSalg += 1;
        totalOmsetning += cpo;
      });

      console.log('  Salg per avdeling:', deptStats);
      console.log('  Totalt salg fra loop:', totalSalg);

      setDashboardData({
        totalSalg,
        totalOmsetning,
        avgPerSalg: totalSalg > 0 ? Math.round(totalOmsetning / totalSalg) : 0,
        departments: deptStats,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  // Fetch progresjon data when PROGRESJON tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'progresjon') {
      setLoadingProgresjon(true);
      const loadProgresjonData = async () => {
        try {
          const salgRef = collection(db, 'allente_kontraktsarkiv');
          const snapshot = await getDocs(salgRef);
          
          // Calculate date ranges
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          
          // Convert snapshot to array for easier processing
          const contracts: any[] = [];
          snapshot.forEach((doc) => {
            contracts.push(doc.data());
          });
          
          // Parse contracts and group by seller
          const sellerStats: { [key: string]: { month: number; week: number; total: number; weeks: { [key: string]: number }; months: { [key: string]: number } } } = {};
          
          contracts.forEach((data) => {
            const selger = data.selger || 'Ukjent';
            const orderedateStr = data.dato || data.orderdato || '';
            
            // Initialize seller if not exists
            if (!sellerStats[selger]) {
              sellerStats[selger] = { month: 0, week: 0, total: 0, weeks: {}, months: {} };
            }
            
            sellerStats[selger].total++;
            
            // Parse date (DD/MM/YYYY format)
            if (orderedateStr && typeof orderedateStr === 'string') {
              const parts = orderedateStr.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);
                
                // Count this month
                if (orderDate >= startOfMonth && orderDate <= today) {
                  sellerStats[selger].month++;
                }
                
                // Count this week
                if (orderDate >= startOfWeek && orderDate <= today) {
                  sellerStats[selger].week++;
                }
                
                // Track weeks
                const weekNum = Math.floor((orderDate.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
                const weekKey = `${year}-W${weekNum}`;
                sellerStats[selger].weeks[weekKey] = (sellerStats[selger].weeks[weekKey] || 0) + 1;
                
                // Track months
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                sellerStats[selger].months[monthKey] = (sellerStats[selger].months[monthKey] || 0) + 1;
              }
            }
          });
          
          // Create array with all stats
          const progresjonArray = Object.entries(sellerStats).map(([selger, stats]) => {
            // Find best week
            const weeks = Object.values(stats.weeks);
            const bestWeek = weeks.length > 0 ? Math.max(...weeks) : 0;
            
            // Find best month
            const months = Object.values(stats.months);
            const bestMonth = months.length > 0 ? Math.max(...months) : 0;
            
            return {
              selger,
              month: stats.month,
              week: stats.week,
              total: stats.total,
              bestWeek,
              bestMonth,
            };
          });
          
          const sorted = progresjonArray.sort((a, b) => b.total - a.total);
          setProgresjonData(sorted);
          
          // Calculate badge winner (most total sales)
          if (sorted.length > 0) {
            const currentWinner = sorted[0].selger;
            
            // Check if winner changed
            try {
              const badgeRef = doc(db, 'allente_badge_winners', 'best_total');
              const badgeSnap = await getDoc(badgeRef);
              
              if (badgeSnap.exists()) {
                const previousWinner = badgeSnap.data().selger;
                // If winner changed, update Firestore
                if (previousWinner !== currentWinner) {
                  await setDoc(badgeRef, {
                    emoji: '🏆',
                    selger: currentWinner,
                    updatedAt: new Date().toISOString(),
                  });
                }
                setBadgeWinner(badgeSnap.data().selger);
              } else {
                // First time - create record
                await setDoc(badgeRef, {
                  emoji: '🏆',
                  selger: currentWinner,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                setBadgeWinner(currentWinner);
              }
            } catch (err) {
              console.error('Error updating badge winner:', err);
            }
          }
          
          // Calculate MVP MÅNED and MVP DAG badges
          try {
            const mvpRef = collection(db, 'allente_badge_earners');
            
            // Load all existing badge winners
            const allBadges = await getDocs(mvpRef);
            const mvpMånedEarners = new Set<string>();
            const mvpDagEarners = new Set<string>();
            
            allBadges.forEach((doc) => {
              if (doc.data().badge === 'MVP_MÅNED') {
                mvpMånedEarners.add(doc.data().selger);
              } else if (doc.data().badge === 'MVP_DAG') {
                mvpDagEarners.add(doc.data().selger);
              }
            });
            
            // --- MVP MÅNED ---
            const monthlyStats: { [key: string]: { [key: string]: number } } = {};
            
            contracts.forEach((data) => {
              const selger = data.selger || 'Ukjent';
              const dateStr = data.dato || data.orderdato || '';
              
              if (dateStr) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  const month = parseInt(parts[1]);
                  const year = parseInt(parts[2]);
                  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                  
                  if (!monthlyStats[monthKey]) {
                    monthlyStats[monthKey] = {};
                  }
                  monthlyStats[monthKey][selger] = (monthlyStats[monthKey][selger] || 0) + 1;
                }
              }
            });
            
            // Award MVP MÅNED for each month
            for (const monthKey in monthlyStats) {
              const sellers = monthlyStats[monthKey];
              let bestSeller = '';
              let maxSales = 0;
              
              for (const selger in sellers) {
                if (sellers[selger] > maxSales) {
                  maxSales = sellers[selger];
                  bestSeller = selger;
                }
              }
              
              if (bestSeller && !mvpMånedEarners.has(bestSeller)) {
                await addDoc(mvpRef, {
                  badge: 'MVP_MÅNED',
                  emoji: '👑',
                  selger: bestSeller,
                  monthKey: monthKey,
                  sales: maxSales,
                  awardedAt: new Date().toISOString(),
                });
                mvpMånedEarners.add(bestSeller);
              }
            }
            
            // --- MVP DAG ---
            const dailyStats: { [key: string]: { [key: string]: number } } = {};
            
            contracts.forEach((data) => {
              const selger = data.selger || 'Ukjent';
              const dateStr = data.dato || data.orderdato || '';
              
              if (dateStr) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0]);
                  const month = parseInt(parts[1]);
                  const year = parseInt(parts[2]);
                  const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  
                  if (!dailyStats[dayKey]) {
                    dailyStats[dayKey] = {};
                  }
                  dailyStats[dayKey][selger] = (dailyStats[dayKey][selger] || 0) + 1;
                }
              }
            });
            
            // Award MVP DAG for each day
            for (const dayKey in dailyStats) {
              const sellers = dailyStats[dayKey];
              let bestSeller = '';
              let maxSales = 0;
              
              for (const selger in sellers) {
                if (sellers[selger] > maxSales) {
                  maxSales = sellers[selger];
                  bestSeller = selger;
                }
              }
              
              if (bestSeller && !mvpDagEarners.has(bestSeller)) {
                await addDoc(mvpRef, {
                  badge: 'MVP_DAG',
                  emoji: '⭐',
                  selger: bestSeller,
                  dayKey: dayKey,
                  sales: maxSales,
                  awardedAt: new Date().toISOString(),
                });
                mvpDagEarners.add(bestSeller);
              }
            }
            
            setMvpMånedWinners(mvpMånedEarners);
            setMvpDagWinners(mvpDagEarners);
          } catch (err) {
            console.error('Error calculating MVP badges:', err);
          }
          
          // Calculate threshold badges
          try {
            const mvpRef = collection(db, 'allente_badge_earners');
            
            // CLEANUP: Remove old threshold badges (from previous systems)
            const allBadges = await getDocs(mvpRef);
            const oldBadges: string[] = []; // No old badges to remove (5/10/15/20 is current system)
            
            // Delete old threshold badges
            const deletePromises: Promise<void>[] = [];
            allBadges.forEach((badgeDoc) => {
              const data = badgeDoc.data();
              if (oldBadges.includes(data.badge)) {
                deletePromises.push(deleteDoc(badgeDoc.ref));
              }
            });
            await Promise.all(deletePromises);
            
            // Build best day per seller
            const dailyStats: { [key: string]: { [key: string]: number } } = {};
            const bestDayPerSeller: { [key: string]: { sales: number; date: string } } = {};
            
            contracts.forEach((data) => {
              const selger = data.selger || 'Ukjent';
              const dateStr = data.dato || data.orderdato || '';
              
              if (dateStr) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0]);
                  const month = parseInt(parts[1]);
                  const year = parseInt(parts[2]);
                  const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  
                  if (!dailyStats[dayKey]) {
                    dailyStats[dayKey] = {};
                  }
                  dailyStats[dayKey][selger] = (dailyStats[dayKey][selger] || 0) + 1;
                }
              }
            });
            
            // Calculate best day for each seller
            for (const dayKey in dailyStats) {
              for (const selger in dailyStats[dayKey]) {
                const daySales = dailyStats[dayKey][selger];
                if (!bestDayPerSeller[selger]) {
                  bestDayPerSeller[selger] = { sales: daySales, date: dayKey };
                } else if (daySales > bestDayPerSeller[selger].sales) {
                  bestDayPerSeller[selger] = { sales: daySales, date: dayKey };
                }
              }
            }
            
            // Debug: Show best day per seller in console
            console.log('📊 BEST DAY PER SELLER:');
            Object.entries(bestDayPerSeller).forEach(([selger, data]: [string, any]) => {
              console.log(`  ${selger}: ${data.sales} salg på ${data.date}`);
            });
            
            const freshBadges = await getDocs(mvpRef);
            
            const thresholdEarners: { [key: string]: Set<string> } = {
              FØRSTE_SALGET: new Set(),
              SALG_5: new Set(),
              SALG_10: new Set(),
              SALG_15: new Set(),
              SALG_20: new Set(),
            };
            
            // Load existing threshold badge winners (after cleanup)
            freshBadges.forEach((badgeDoc) => {
              const data = badgeDoc.data();
              if (thresholdEarners[data.badge]) {
                thresholdEarners[data.badge].add(data.selger);
              }
            });
            
            // Award threshold badges
            for (const row of progresjonArray) {
              const selger = row.selger;
              const totalSales = row.total;
              const bestDay = bestDayPerSeller[selger]?.sales || 0;
              
              // Check each threshold
              for (const badgeConfig of thresholdBadgesList) {
                let qualifies = false;
                
                if (badgeConfig.type === 'total') {
                  qualifies = totalSales >= badgeConfig.threshold;
                } else if (badgeConfig.type === 'day') {
                  qualifies = bestDay >= badgeConfig.threshold;
                }
                
                if (qualifies && !thresholdEarners[badgeConfig.badge].has(selger)) {
                  // Award badge
                  await addDoc(mvpRef, {
                    badge: badgeConfig.badge,
                    emoji: badgeConfig.emoji,
                    selger: selger,
                    threshold: badgeConfig.threshold,
                    type: badgeConfig.type,
                    value: badgeConfig.type === 'total' ? totalSales : bestDay,
                    bestDate: badgeConfig.type === 'day' ? bestDayPerSeller[selger]?.date : null,
                    awardedAt: new Date().toISOString(),
                  });
                  thresholdEarners[badgeConfig.badge].add(selger);
                }
              }
            }
            
            setThresholdBadges(thresholdEarners);
          } catch (err) {
            console.error('Error calculating threshold badges:', err);
          }

          // Load emoji counts from chat
          try {
            const emojiCountsRef = doc(db, 'emoji_counts', 'chat_reactions');
            const emojiSnap = await getDoc(emojiCountsRef);
            if (emojiSnap.exists()) {
              setEmojiCounts(emojiSnap.data());
              console.log('📊 Emoji counts loaded:', emojiSnap.data());
            }
          } catch (err) {
            console.error('Error loading emoji counts:', err);
          }

        } catch (err) {
          console.error('Error fetching progresjon data:', err);
        } finally {
          setLoadingProgresjon(false);
        }
      };
      
      loadProgresjonData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch badges data when BADGES tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'badges') {
      setLoadingBadges(true);
      const loadBadgesData = async () => {
        try {
          const badgesRef = collection(db, 'allente_badges');
          const snapshot = await getDocs(badgesRef);
          const badges: any[] = [];
          
          snapshot.forEach((doc) => {
            badges.push({ id: doc.id, ...doc.data() });
          });

          // If no badges in DB, create from definitions
          if (badges.length === 0) {
            setBadgesData(badgeDefinitions);
          } else {
            // Sort by definition order
            const sortedBadges = badgeDefinitions.map(def => 
              badges.find(b => b.emoji === def.emoji) || def
            );
            setBadgesData(sortedBadges);
          }
        } catch (err) {
          console.error('Error fetching badges:', err);
        } finally {
          setLoadingBadges(false);
        }
      };
      
      loadBadgesData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch produkter data when PRODUKT tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'produkt') {
      setLoadingProdukter(true);
      const loadProdukterData = async () => {
        try {
          // Get unique Produkt + Plattform combinations from contracts
          const contractsRef = collection(db, 'allente_kontraktsarkiv');
          const contractsSnapshot = await getDocs(contractsRef);
          const produkterMap = new Map<string, any>();
          
          contractsSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const produkt = data.produkt || '';
            // Felt heter "platform" (English)
            const plattform = data.platform || 'Ukjent';
            const key = `${produkt}|${plattform}`;
            
            if (produkt.trim() && !produkterMap.has(key)) {
              produkterMap.set(key, {
                navn: produkt,
                plattform: plattform,
                cpo: '',
                provisjon: '',
              });
            }
          });

          // Get CPO/Provisjon data from Firestore
          const cpoRef = collection(db, 'allente_produkter');
          const cpoSnapshot = await getDocs(cpoRef);
          
          cpoSnapshot.forEach((doc) => {
            const data = doc.data();
            // Update all matching produkter
            produkterMap.forEach((value) => {
              if (value.navn === data.navn) {
                value.cpo = data.cpo || '';
                value.provisjon = data.provisjon || '';
              }
            });
          });

          // Build products list sorted by navn then plattform
          const products = Array.from(produkterMap.values()).sort((a, b) => {
            if (a.navn !== b.navn) {
              return a.navn.localeCompare(b.navn);
            }
            return a.plattform.localeCompare(b.plattform);
          });
          
          setProdukterData(products);
        } catch (err) {
          console.error('Error fetching produkter:', err);
        } finally {
          setLoadingProdukter(false);
        }
      };
      
      loadProdukterData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch angringer data when ANGRING tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'angring') {
      setLoadingAngringer(true);
      const loadAngringerData = async () => {
        try {
          const angringerRef = collection(db, 'allente_kanselleringer');
          const snapshot = await getDocs(angringerRef);
          const records: any[] = [];
          
          snapshot.forEach((doc) => {
            records.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          
          setAngringerData(records);
        } catch (err) {
          console.error('Error fetching angringer:', err);
        } finally {
          setLoadingAngringer(false);
        }
      };
      
      loadAngringerData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch salg data when SALG tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'salg') {
      setLoadingSalg(true);
      const loadBothAsync = async () => {
        // First fetch employees
        const empRef = collection(db, 'employees');
        const empSnapshot = await getDocs(empRef);
        const map: { [key: string]: string } = {};
        
        empSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.externalName && data.department) {
            const normalized = normalizeWhitespace(data.externalName);
            map[normalized] = data.department;
          }
        });
        
        // Then fetch and match salg data
        const salgRef = collection(db, 'allente_kontraktsarkiv');
        const salgSnapshot = await getDocs(salgRef);
        const salgList: SalgRecord[] = [];
        
        salgSnapshot.forEach((doc) => {
          const data = doc.data();
          const selger = data.selger || '';
          const normalizedSelger = normalizeWhitespace(selger);
          const avdeling = map[normalizedSelger] || 'Ukjent';
          
          salgList.push({
            id: doc.id,
            csvId: data.id || data.csvId || '-',
            kundeNr: data.kundenummer || data.kundeNr || data.kundenr || 'N/A',
            kundeNavn: data.kunde || data.kundeNavn || data.kundenavn || '-',
            beløp: data.beløp || '-',
            dato: data.dato,
            produkt: data.produkt,
            selger: selger,
            platform: data.platform || '-',
            avdeling: avdeling,
            ...data,
          });
        });
        setSalgData(salgList.sort((a, b) => (b.dato || '').localeCompare(a.dato || '')));
        setLoadingSalg(false);
      };
      
      loadBothAsync();
    }
  }, [activeMainTab, activeAllenteTab]);

  const normalizeWhitespace = (text: string): string => {
    // Normalize whitespace around "/" - "Mats / selger" and "Mats /selger" become "Mats / selger"
    return text.replace(/\s*\/\s*/g, ' / ').trim();
  };

  const handleDeleteClick = (employeeId: string, employeeName: string) => {
    setDeleteConfirm({ show: true, employeeId, employeeName });
  };

  const handleEditClick = (employee: any) => {
    setEditingEmployee({ ...employee });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    
    try {
      const empRef = doc(db, 'employees', editingEmployee.id);
      await updateDoc(empRef, {
        name: editingEmployee.name || '',
        email: editingEmployee.email || '',
        password: editingEmployee.password || '',
        role: editingEmployee.role || '',
        project: editingEmployee.project || '',
        department: editingEmployee.department || '',
        slackName: editingEmployee.slackName || '',
        externalName: editingEmployee.externalName || '',
        tmgName: editingEmployee.tmgName || '',
        stilling: editingEmployee.stilling || '',
      });

      // Update local state
      setEmployees(employees.map((emp) => 
        emp.id === editingEmployee.id ? editingEmployee : emp
      ));
      
      setShowEditModal(false);
      setEditingEmployee(null);
      alert('✅ Ansatt oppdatert!');
    } catch (err) {
      console.error('Error saving employee:', err);
      alert('Feil ved lagring av ansatt');
    }
  };

  const handleSaveBadges = async () => {
    try {
      const badgesRef = collection(db, 'allente_badges');
      
      for (const badge of badgesData) {
        if (badge.emoji) {
          const docRef = doc(db, 'allente_badges', badge.emoji);
          const docSnapshot = await getDocs(badgesRef);
          let exists = false;
          
          docSnapshot.forEach((d) => {
            if (d.id === badge.emoji) {
              exists = true;
            }
          });

          if (exists) {
            // Update existing
            await updateDoc(docRef, {
              navn: badge.navn || '',
              verdi: badge.verdi || '',
              beskrivelse: badge.beskrivelse || '',
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Create new
            await addDoc(badgesRef, {
              emoji: badge.emoji,
              navn: badge.navn || '',
              verdi: badge.verdi || '',
              beskrivelse: badge.beskrivelse || '',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      alert('✅ Badges lagret!');
    } catch (err) {
      console.error('Error saving badges:', err);
      alert('❌ Feil ved lagring');
    }
  };

  const handleSaveProdukter = async () => {
    try {
      const produkterRef = collection(db, 'allente_produkter');
      const snapshot = await getDocs(produkterRef);
      const existingIds = new Set<string>();
      
      snapshot.forEach((d) => {
        existingIds.add(d.id);
      });

      for (const produkt of produkterData) {
        if (produkt.navn.trim()) {
          if (existingIds.has(produkt.navn)) {
            // Update existing
            await updateDoc(doc(db, 'allente_produkter', produkt.navn), {
              cpo: produkt.cpo || '',
              provisjon: produkt.provisjon || '',
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Create new - use product name as document ID
            await addDoc(produkterRef, {
              navn: produkt.navn,
              cpo: produkt.cpo || '',
              provisjon: produkt.provisjon || '',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      alert('✅ Produkter lagret!');
    } catch (err) {
      console.error('Error saving produkter:', err);
      alert('❌ Feil ved lagring');
    }
  };

  const handleSaveAdd = async () => {
    if (!newEmployee.name.trim()) {
      alert('Navn er påkrevd');
      return;
    }
    if (!newEmployee.password?.trim()) {
      alert('Passord er påkrevd');
      return;
    }

    try {
      const empCollection = collection(db, 'employees');
      const docRef = await addDoc(empCollection, {
        name: newEmployee.name,
        email: newEmployee.email || '',
        password: newEmployee.password,
        role: newEmployee.role,
        project: newEmployee.project || '',
        department: newEmployee.department,
        slackName: newEmployee.slackName || '',
        externalName: newEmployee.externalName || '',
        tmgName: newEmployee.tmgName || '',
        stilling: newEmployee.stilling || 'Fulltid',
        createdAt: new Date().toISOString(),
      });

      // Add to local state
      setEmployees([...employees, { id: docRef.id, ...newEmployee }]);

      setShowAddModal(false);
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        project: 'Allente',
        department: 'OSL',
        slackName: '',
        externalName: '',
        tmgName: '',
        stilling: 'Fulltid',
      });
      alert('✅ Ansatt opprettet!');
    } catch (err) {
      console.error('Error adding employee:', err);
      alert('Feil ved opprettelse av ansatt');
    }
  };



  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      
      const employeeList: Employee[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Skip archived employees
        if (data.archived) return;
        
        employeeList.push({
          id: doc.id,
          name: data.name || 'N/A',
          email: data.email,
          username: data.username,
          password: data.password,
          department: data.department,
          role: data.role,
          project: data.project,
          slackName: data.slackName,
          externalName: data.externalName,
          tmgName: data.tmgName,
          stilling: data.stilling,
        });
      });
      
      setEmployees(employeeList.sort((a, b) => a.name.localeCompare(b.name)));
      console.log('🔍 DEBUG - Employees loaded:', employeeList.length, 'records');
      console.log('📋 Sample employee:', employeeList[0]);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Mock data
  const salesData = [
    { ansatt: 'Fayez Fadie', salg: 0, slack: 'Fayez' },
    { ansatt: 'Steffen Støylen', salg: 0, slack: 'Steffen' },
    { ansatt: 'Benjamin Johannessen', salg: 0, slack: 'Benjamin' },
  ];

  const mainTabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'organisasjon', label: '👥 Organisasjon' },
    { id: 'allente', label: '🟠 Allente' },
  ];

  const allenteTabs = [
    { id: 'i-dag', label: 'I DAG' },
    { id: 'salg', label: 'SALG' },
    { id: 'stats', label: 'STATS' },
    { id: 'angring', label: 'ANGRING' },
    { id: 'mal', label: 'MÅL' },
    { id: 'dashboard', label: 'DASHBOARD' },
    { id: 'progresjon', label: 'PROGRESJON' },
    { id: 'produkt', label: 'PRODUKT' },
    { id: 'badges', label: 'BADGES' },
  ];

  const uploadButtons = [
    { label: 'Last opp Salg', icon: '📤', color: '#C86D4D' },
    { label: 'Last opp Stats', icon: '📈', color: '#667eea' },
    { label: 'Last opp Angring', icon: '↩️', color: '#10b981' },
  ];



  const handleConfirmDelete = async () => {
    if (!deleteConfirm.employeeId) return;

    setDeleting(true);
    try {
      const empRef = doc(db, 'employees', deleteConfirm.employeeId);
      await updateDoc(empRef, { archived: true });

      // Remove from UI
      setEmployees(employees.filter((emp) => emp.id !== deleteConfirm.employeeId));

      // Close modal
      setDeleteConfirm({ show: false });
    } catch (err) {
      console.error('Error archiving employee:', err);
      alert('Feil ved arkivering av ansatt');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false });
  };

  const handleUploadClick = (fileType: 'salg' | 'stats' | 'angring') => {
    setUploadModal({ isOpen: true, fileType });
  };

  const handleFileUpload = async () => {
    // Note: SALG data will auto-refresh when useEffect triggers on tab change
    // No need to manually fetch here
  };

  const getUploadModalTitle = () => {
    switch (uploadModal.fileType) {
      case 'salg':
        return '📤 Last opp Salg';
      case 'stats':
        return '📈 Last opp Stats';
      case 'angring':
        return '↩️ Last opp Angring';
      default:
        return 'Last opp fil';
    }
  };

  const convertDateFormat = (dateStr: string): string => {
    // Convert M/D/YYYY, DD/MM/YYYY or DD.MM.YYYY to YYYY-MM-DD (with zero-padding)
    if (!dateStr) return '';
    
    // Try splitting by / first
    let parts = dateStr.split('/');
    if (parts.length !== 3) {
      // Try splitting by . if / didn't work
      parts = dateStr.split('.');
    }
    
    if (parts.length === 3) {
      const day = String(parts[0]).padStart(2, '0');
      const month = String(parts[1]).padStart(2, '0');
      return `${parts[2]}-${month}-${day}`;
    }
    return dateStr;
  };

  const getFilteredAngringerData = () => {
    return angringerData.filter((record) => {
      if (activeAngringerFilters.filnavn && !record.filename?.toLowerCase().includes(activeAngringerFilters.filnavn.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.kundenummer && !record.kundenummer?.toLowerCase().includes(activeAngringerFilters.kundenummer.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.produkt && !record.produkt?.toLowerCase().includes(activeAngringerFilters.produkt.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.selger && !record.selger?.toLowerCase().includes(activeAngringerFilters.selger.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.periode && record.period?.toString() !== activeAngringerFilters.periode) {
        return false;
      }
      if (activeAngringerFilters.plattform && !record.plattform?.toLowerCase().includes(activeAngringerFilters.plattform.toLowerCase())) {
        return false;
      }
      return true;
    });
  };

  const getFilteredSalgData = () => {
    return salgData.filter((record) => {
      // Selger filter
      if (activeFilters.selger && !record.selger?.toLowerCase().includes(activeFilters.selger.toLowerCase())) {
        return false;
      }

      // Avdeling filter
      if (activeFilters.avdeling && record.avdeling !== activeFilters.avdeling) {
        return false;
      }

      // Produkt filter
      if (activeFilters.produkt && !record.produkt?.toLowerCase().includes(activeFilters.produkt.toLowerCase())) {
        return false;
      }

      // Plattform filter
      if (activeFilters.platform && !record.platform?.toLowerCase().includes(activeFilters.platform.toLowerCase())) {
        return false;
      }

      // Convert record date from DD/MM/YYYY to YYYY-MM-DD for comparison
      const recordDate = convertDateFormat(record.dato || '');

      // Dato from filter
      if (activeFilters.datoFrom && recordDate && recordDate < activeFilters.datoFrom) {
        return false;
      }

      // Dato to filter
      if (activeFilters.datoTo && recordDate && recordDate > activeFilters.datoTo) {
        return false;
      }

      return true;
    });
  };

  const handleSearch = () => {
    setActiveFilters(filters);
    console.log('🔍 Search triggered with filters:', filters);
  };

  const handleResetFilters = () => {
    const emptyFilters = {
      selger: '',
      avdeling: '',
      produkt: '',
      platform: '',
      datoFrom: '',
      datoTo: '',
    };
    setFilters(emptyFilters);
    setActiveFilters(emptyFilters);
  };

  return (
    <div className="admin-dashboard-container">
      {/* Header */}
      <div className="admin-header">
        <div className="header-left">
          <span className="muon-logo">muon</span>
          <div>
            <h1>Admin Dashboard</h1>
            <p className="subtitle">Sentralisert oversikt over kontrakter og brukerstatistikk</p>
          </div>
        </div>
        <div className="header-buttons-admin">
          <button 
            className="back-btn-admin"
            onClick={() => navigate('/teamleder')}
          >
            ← Tilbake
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="main-tabs">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            className={`main-tab ${activeMainTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveMainTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="admin-content">
        {activeMainTab === 'allente' && (
          <>
            {/* Allente Header */}
            <div className="section-header">
              <div className="section-title">
                <div className="section-icon">🟠</div>
                <h2>Allente</h2>
              </div>
              <div className="upload-buttons">
                <button 
                  className="upload-btn"
                  style={{ borderColor: uploadButtons[0].color, color: uploadButtons[0].color }}
                  onClick={() => handleUploadClick('salg')}
                >
                  {uploadButtons[0].icon} {uploadButtons[0].label}
                </button>
                <button 
                  className="upload-btn"
                  style={{ borderColor: uploadButtons[1].color, color: uploadButtons[1].color }}
                  onClick={() => handleUploadClick('stats')}
                >
                  {uploadButtons[1].icon} {uploadButtons[1].label}
                </button>
                <button 
                  className="upload-btn"
                  style={{ borderColor: uploadButtons[2].color, color: uploadButtons[2].color }}
                  onClick={() => handleUploadClick('angring')}
                >
                  {uploadButtons[2].icon} {uploadButtons[2].label}
                </button>
              </div>
            </div>

            {/* Allente Sub-tabs */}
            <div className="allente-tabs">
              {allenteTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`allente-tab ${activeAllenteTab === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveAllenteTab(tab.id);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* I DAG Content */}
            {activeAllenteTab === 'i-dag' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Salg i dag – Allente</h3>
                  <p className="content-subtitle">Henter live data fra aliente Slack-kanal (🔔 + 📱 = 1 salg)</p>
                </div>

                <div className="info-box">
                  <span className="info-icon">💡</span>
                  <p>
                    <strong>Hvordan det fungerer:</strong> Post salg i #allente med emojis (🔔 eller 📱 = 1 salg hver). Tabellen oppdateres live.
                  </p>
                </div>

                <button className="update-btn">↻ Oppdater nå</button>

                {/* Sales Table */}
                <div className="sales-table">
                  <div className="table-header">
                    <div className="col-ansatt">Ansatt</div>
                    <div className="col-salg">Salg i dag</div>
                    <div className="col-slack">Slack-navn</div>
                  </div>
                  {salesData.map((row, idx) => (
                    <div key={idx} className="table-row">
                      <div className="col-ansatt">{row.ansatt}</div>
                      <div className="col-salg">
                        <span className="salg-badge">{row.salg}</span>
                      </div>
                      <div className="col-slack">{row.slack}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other tabs placeholder */}
            {/* SALG Tab */}
            {activeAllenteTab === 'salg' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>
                    Kontraktsarkiv {salgData.length > 0 && <span style={{ color: '#667eea', fontSize: '0.8em' }}>({getFilteredSalgData().length} av {salgData.length})</span>}
                    {(() => {
                      const annetCount = salgData.filter(r => r.avdeling === 'Annet').length;
                      return annetCount > 0 && <span style={{ marginLeft: '1rem', color: '#ff4757', fontWeight: '700', fontSize: '0.9em' }}>⚠️ {annetCount} med Annet avdeling</span>;
                    })()}
                  </h3>
                  <p className="content-subtitle">Fullstendig oversikt over alle kontrakter</p>
                </div>

                {loadingSalg ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster salg data...
                  </p>
                ) : salgData.length > 0 ? (
                  <>
                    {/* Filter Panel */}
                    <div className="filter-panel">
                      <div className="filter-group">
                        <label>Selger:</label>
                        <select
                          value={filters.selger}
                          onChange={(e) => setFilters({ ...filters, selger: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.selger).filter(Boolean))].sort().map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-group">
                        <label>Avdeling:</label>
                        <select
                          value={filters.avdeling}
                          onChange={(e) => setFilters({ ...filters, avdeling: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.avdeling).filter(Boolean))].sort().map((avd) => (
                            <option key={avd} value={avd}>{avd}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => setFilters({ ...filters, avdeling: 'Annet' })}
                        style={{
                          padding: '0.5rem 1rem',
                          background: filters.avdeling === 'Annet' ? '#667eea' : '#f0f0f0',
                          color: filters.avdeling === 'Annet' ? 'white' : '#333',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                        }}
                      >
                        ⚠️ Vis Annet
                      </button>

                      <div className="filter-group">
                        <label>Produkt:</label>
                        <select
                          value={filters.produkt}
                          onChange={(e) => setFilters({ ...filters, produkt: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.produkt).filter(Boolean))].sort().map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-group">
                        <label>Plattform:</label>
                        <select
                          value={filters.platform}
                          onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.platform).filter(Boolean))].sort().map((pl) => (
                            <option key={pl} value={pl}>{pl}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-group">
                        <label>Dato fra:</label>
                        <input
                          type="date"
                          value={filters.datoFrom}
                          onChange={(e) => setFilters({ ...filters, datoFrom: e.target.value })}
                          className="filter-input"
                        />
                      </div>

                      <div className="filter-group">
                        <label>Dato til:</label>
                        <input
                          type="date"
                          value={filters.datoTo}
                          onChange={(e) => setFilters({ ...filters, datoTo: e.target.value })}
                          className="filter-input"
                        />
                      </div>

                      <div className="filter-actions">
                        <button
                          className="filter-search"
                          onClick={handleSearch}
                        >
                          🔍 Søk
                        </button>
                        <button
                          className="filter-reset"
                          onClick={handleResetFilters}
                        >
                          🔄 Nullstill
                        </button>
                      </div>
                    </div>

                    {/* Data Table */}
                    <div className="sales-table">
                      <div className="table-header">
                        <div className="col-dato">Ordredato</div>
                        <div className="col-id">Id</div>
                        <div className="col-kunde">Kundenummer</div>
                        <div className="col-produkt">Produkter</div>
                        <div className="col-selger">Selger</div>
                        <div className="col-avdeling">Avdeling</div>
                        <div className="col-platform">Plattform</div>
                      </div>
                      {getFilteredSalgData().map((row) => (
                        <div key={row.id} className="table-row">
                          <div className="col-dato">{row.dato || '-'}</div>
                          <div className="col-id">{row.csvId || '-'}</div>
                          <div className="col-kunde">{row.kundeNr}</div>
                          <div className="col-produkt">{row.produkt || '-'}</div>
                          <div className="col-selger">{row.selger || '-'}</div>
                          <div className="col-avdeling">{row.avdeling || 'Ukjent'}</div>
                          <div className="col-platform">{row.platform || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen salg data funnet. Last opp en CSV/Excel fil for å komme i gang.
                  </p>
                )}
              </div>
            )}

            {/* ANGRING Tab */}
            {activeAllenteTab === 'angring' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Angringer {angringerData.length > 0 && <span style={{ color: '#667eea', fontSize: '0.8em' }}>({getFilteredAngringerData().length} av {angringerData.length})</span>}</h3>
                  <p className="content-subtitle">Oversikt over alle angringer</p>
                </div>

                {loadingAngringer ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster angringer...
                  </p>
                ) : angringerData.length > 0 ? (
                  <>
                    <button
                      className="upload-btn"
                      onClick={() => setUploadModal({ isOpen: true, fileType: 'angring' })}
                      style={{
                        marginBottom: '1.5rem',
                        padding: '0.75rem 1.5rem',
                        background: '#C86D4D',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      📤 Last opp Angringer
                    </button>

                    {/* Filter Panel */}
                    <div className="filter-panel">
                      <div className="filter-group">
                        <label>Filnavn:</label>
                        <select
                          value={angringerFilters.filnavn}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, filnavn: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.filename))).sort().map(fn => (
                            <option key={fn} value={fn}>{fn}</option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-group">
                        <label>Selger:</label>
                        <select
                          value={angringerFilters.selger}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, selger: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.selger))).sort().map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-group">
                        <label>Produkt:</label>
                        <select
                          value={angringerFilters.produkt}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, produkt: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.produkt))).sort().map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-group">
                        <label>Plattform:</label>
                        <select
                          value={angringerFilters.plattform}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, plattform: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.plattform))).sort().map(pl => (
                            <option key={pl} value={pl}>{pl}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          setActiveAngringerFilters(angringerFilters);
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        🔍 Søk
                      </button>
                      <button
                        onClick={() => {
                          setAngringerFilters({
                            filnavn: '',
                            kundenummer: '',
                            produkt: '',
                            selger: '',
                            periode: '',
                            plattform: '',
                          });
                          setActiveAngringerFilters({
                            filnavn: '',
                            kundenummer: '',
                            produkt: '',
                            selger: '',
                            periode: '',
                            plattform: '',
                          });
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#999',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        🔄 Nullstill
                      </button>
                    </div>

                    <div className="angringer-table">
                      <div className="table-header">
                        <div className="col-filename">Filnavn</div>
                        <div className="col-kundenr">Kundenummer</div>
                        <div className="col-product">Produkt</div>
                        <div className="col-selger">Selger</div>
                        <div className="col-salesdate">Salgsdato</div>
                        <div className="col-regretdate">Avbrytelsesdato</div>
                        <div className="col-period">Periode (dager)</div>
                        <div className="col-category">Plattform</div>
                      </div>
                      {getFilteredAngringerData().map((record, idx) => (
                        <div key={idx} className="table-row">
                          <div className="col-filename">{record.filename || '-'}</div>
                          <div className="col-kundenr">{record.kundenummer || '-'}</div>
                          <div className="col-product">{record.produkt || '-'}</div>
                          <div className="col-selger">{record.selger || '-'}</div>
                          <div className="col-salesdate">{record.salesdate || '-'}</div>
                          <div className="col-regretdate">{record.regretdate || '-'}</div>
                          <div className="col-period">{record.period || 0}</div>
                          <div className="col-category">{record.plattform || '-'}</div>
                        </div>
                      ))}
                    </div>

                    <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                      {angringerData.length > 0 && <span style={{ color: '#667eea', fontSize: '0.95em', fontWeight: '600' }}>({getFilteredAngringerData().length} av {angringerData.length})</span>}
                    </p>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen angringer funnet. Last opp en CSV/Excel fil for å komme i gang.
                  </p>
                )}
              </div>
            )}

            {/* PROGRESJON Tab */}
            {activeAllenteTab === 'progresjon' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Progresjon</h3>
                  <p className="content-subtitle">Salgs oversikt per selger</p>
                </div>

                {loadingProgresjon ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster progresjon data...
                  </p>
                ) : progresjonData.length > 0 ? (
                  <div className="progresjon-table">
                    <div className="table-header">
                      <div className="col-selger">Ekstern Navn</div>
                      <div className="col-week">Uke</div>
                      <div className="col-month">Måned</div>
                      <div className="col-total">Totalt</div>
                      <div className="col-best-week">Best Uke</div>
                      <div className="col-best-month">Best Måned</div>
                      <div className="col-badges">Badges</div>
                    </div>
                    {progresjonData.map((row, idx) => (
                      <div key={idx} className="table-row">
                        <div className="col-selger">{row.selger}</div>
                        <div className="col-week" style={{ textAlign: 'center', fontWeight: '600', color: '#667eea' }}>
                          {row.week}
                        </div>
                        <div className="col-month" style={{ textAlign: 'center', fontWeight: '600', color: '#667eea' }}>
                          {row.month}
                        </div>
                        <div className="col-total" style={{ textAlign: 'center', fontWeight: '600', color: '#764ba2' }}>
                          {row.total}
                        </div>
                        <div className="col-best-week" style={{ textAlign: 'center', fontWeight: '600', color: '#10b981' }}>
                          {row.bestWeek}
                        </div>
                        <div className="col-best-month" style={{ textAlign: 'center', fontWeight: '600', color: '#10b981' }}>
                          {row.bestMonth}
                        </div>
                        <div className="col-badges" style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem', justifyContent: 'center', alignItems: 'center' }}>
                          {badgeWinner === row.selger ? '🏆' : ''}
                          {mvpMånedWinners.has(row.selger) ? '👑' : ''}
                          {mvpDagWinners.has(row.selger) ? '⭐' : ''}
                          {thresholdBadges.FØRSTE_SALGET.has(row.selger) ? '🎓' : ''}
                          {thresholdBadges.SALG_5.has(row.selger) ? '🚀' : ''}
                          {thresholdBadges.SALG_10.has(row.selger) ? '🎯' : ''}
                          {thresholdBadges.SALG_15.has(row.selger) ? '🔥' : ''}
                          {thresholdBadges.SALG_20.has(row.selger) ? '💎' : ''}
                          
                          {/* Chat emoji counts */}
                          {emojiCounts[row.selger]?.['🔔'] && (
                            <span title={`🔔 talt ${emojiCounts[row.selger]['🔔']} ganger`}>
                              🔔{emojiCounts[row.selger]['🔔']}
                            </span>
                          )}
                          {emojiCounts[row.selger]?.['💎'] && (
                            <span title={`💎 talt ${emojiCounts[row.selger]['💎']} ganger`}>
                              💎{emojiCounts[row.selger]['💎']}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen data tilgjengelig.
                  </p>
                )}
              </div>
            )}

            {/* BADGES Tab */}
            {activeAllenteTab === 'badges' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Badges</h3>
                  <p className="content-subtitle">Administrer badge verdier og beskrivelser</p>
                </div>

                {loadingBadges ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster badges...
                  </p>
                ) : badgesData.length > 0 ? (
                  <>
                    <div className="badges-table">
                      <div className="table-header">
                        <div className="col-emoji">Emoji</div>
                        <div className="col-navn">Navn</div>
                        <div className="col-verdi">Verdi</div>
                        <div className="col-beskrivelse">Beskrivelse</div>
                      </div>
                      {badgesData.map((badge, idx) => (
                        <div key={idx}>
                          {idx === 8 && (
                            <div style={{
                              padding: '1rem',
                              textAlign: 'center',
                              background: '#f0f0f0',
                              fontWeight: 'bold',
                              color: '#666',
                              borderBottom: '2px solid #ccc'
                            }}>
                              ⬇️ FREMTIDIGA BADGES ⬇️
                            </div>
                          )}
                          <div className="table-row">
                            <div className="col-emoji" style={{ fontSize: '2rem', textAlign: 'center' }}>
                              {badge.emoji}
                            </div>
                            <div className="col-navn">
                              <input
                                type="text"
                                value={badge.navn || ''}
                                onChange={(e) => {
                                  const updated = [...badgesData];
                                  updated[idx].navn = e.target.value;
                                  setBadgesData(updated);
                                }}
                                placeholder="f.eks King"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  background: idx < 8 ? '#fff' : '#f9f9f9',
                                  color: '#333',
                                }}
                                disabled={idx >= 8}
                              />
                            </div>
                            <div className="col-verdi">
                              <input
                                type="text"
                                value={badge.verdi || ''}
                                onChange={(e) => {
                                  const updated = [...badgesData];
                                  updated[idx].verdi = e.target.value;
                                  setBadgesData(updated);
                                }}
                                placeholder="f.eks 100 poeng"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  background: idx < 8 ? '#fff' : '#f9f9f9',
                                  color: '#333',
                                }}
                                disabled={idx >= 8}
                              />
                            </div>
                            <div className="col-beskrivelse">
                              <input
                                type="text"
                                value={badge.beskrivelse || ''}
                                onChange={(e) => {
                                  const updated = [...badgesData];
                                  updated[idx].beskrivelse = e.target.value;
                                  setBadgesData(updated);
                                }}
                                placeholder="Hva betyr denne badge?"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  background: idx < 8 ? '#fff' : '#f9f9f9',
                                  color: '#333',
                                }}
                                disabled={idx >= 8}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSaveBadges}
                      style={{
                        marginTop: '1.5rem',
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      💾 Lagre alle badges
                    </button>

                    <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                      Total: {badgesData.length} badges
                    </p>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen badges funnet.
                  </p>
                )}
              </div>
            )}

            {/* PRODUKT Tab */}
            {activeAllenteTab === 'produkt' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Produkter med Plattform</h3>
                  <p className="content-subtitle">Oversikt over ulike produkter og tilhørende plattformer fra arkivet</p>
                </div>

                {loadingProdukter ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster produkter...
                  </p>
                ) : produkterData.length > 0 ? (
                  <>
                    <div className="produkter-table">
                      <div className="table-header">
                        <div className="col-produktnavn">Produkt</div>
                        <div className="col-plattform">Plattform</div>
                        <div className="col-cpo">CPO</div>
                        <div className="col-provisjon">Provisjon</div>
                      </div>
                      {produkterData.map((produkt, idx) => (
                        <div key={idx} className="table-row">
                          <div className="col-produktnavn">{produkt.navn}</div>
                          <div className="col-plattform" style={{ fontWeight: '600', color: '#667eea', textAlign: 'center' }}>
                            {produkt.plattform}
                          </div>
                          <div className="col-cpo">
                            <input
                              type="text"
                              value={produkt.cpo || ''}
                              onChange={(e) => {
                                const updated = [...produkterData];
                                updated[idx].cpo = e.target.value;
                                setProdukterData(updated);
                              }}
                              placeholder="f.eks 500 eller 5%"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                color: '#fff',
                                backgroundColor: '#2d3748',
                              }}
                            />
                          </div>
                          <div className="col-provisjon">
                            <input
                              type="text"
                              value={produkt.provisjon || ''}
                              onChange={(e) => {
                                const updated = [...produkterData];
                                updated[idx].provisjon = e.target.value;
                                setProdukterData(updated);
                              }}
                              placeholder="f.eks 10% eller 1500"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                color: '#fff',
                                backgroundColor: '#2d3748',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSaveProdukter}
                      style={{
                        marginTop: '1.5rem',
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      💾 Lagre CPO og Provisjon
                    </button>

                    <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                      Viser {produkterData.length} unike Produkt + Plattform kombinasjoner
                    </p>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen produkter funnet. Hent kontrakter først.
                  </p>
                )}
              </div>
            )}

            {/* DASHBOARD Tab */}
            {activeAllenteTab === 'dashboard' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Salg & Omsetning Oversikt</h3>
                  <p className="content-subtitle">Analyse av salg og omsetning per avdeling (CPO-basert)</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: '8px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Fra dato:</label>
                    <input 
                      type="date" 
                      value={dashboardFromDate}
                      onChange={(e) => setDashboardFromDate(e.target.value)}
                      style={{ padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '150px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Til dato:</label>
                    <input 
                      type="date" 
                      value={dashboardToDate}
                      onChange={(e) => setDashboardToDate(e.target.value)}
                      style={{ padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '150px' }}
                    />
                  </div>
                </div>

                {dashboardData && (
                  <>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                      <div style={{ padding: '1.5rem', background: '#f0f0f0', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.9rem', color: '#999', marginBottom: '0.5rem' }}>SALG</p>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>{dashboardData.totalSalg}</p>
                        <p style={{ fontSize: '0.85rem', color: '#999' }}>i periode</p>
                      </div>
                      <div style={{ padding: '1.5rem', background: '#f0f0f0', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.9rem', color: '#999', marginBottom: '0.5rem' }}>OMSETNING</p>
                        <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#C86D4D' }}>kr {dashboardData.totalOmsetning.toLocaleString('no-NO')}</p>
                        <p style={{ fontSize: '0.85rem', color: '#999' }}>CPO-basert</p>
                      </div>
                      <div style={{ padding: '1.5rem', background: '#f0f0f0', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.9rem', color: '#999', marginBottom: '0.5rem' }}>GJ.SNITT</p>
                        <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#667eea' }}>kr {dashboardData.avgPerSalg.toLocaleString('no-NO')}</p>
                        <p style={{ fontSize: '0.85rem', color: '#999' }}>per salg</p>
                      </div>
                    </div>

                    {/* Department Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                      {['KRS', 'OSL', 'Skien', 'Annet'].map((dept) => {
                        const data = dashboardData.departments[dept];
                        const pct = dashboardData.totalSalg > 0 ? ((data.salg / dashboardData.totalSalg) * 100).toFixed(1) : '0';
                        return (
                          <div key={dept} style={{ padding: '1.5rem', background: '#fffbf0', border: '2px solid #667eea', borderRadius: '8px' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>{dept}</p>
                            <p style={{ marginBottom: '0.5rem' }}>📊 Salg: <strong>{data.salg}</strong></p>
                            <p style={{ marginBottom: '0.5rem' }}>💰 Omsetning: <strong>kr {data.omsetning.toLocaleString('no-NO')}</strong></p>
                            <p style={{ color: '#999', fontSize: '0.85rem' }}>% av total: <strong>{pct}%</strong></p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tabell */}
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '200px 100px 200px 100px', gap: '1rem', padding: '1rem', background: '#fffbf0', fontWeight: '600', borderBottom: '2px solid #e2e8f0' }}>
                        <div>Avdeling</div>
                        <div>Salg</div>
                        <div>Omsetning</div>
                        <div>% av total</div>
                      </div>
                      {['KRS', 'OSL', 'Skien', 'Annet'].map((dept) => {
                        const data = dashboardData.departments[dept];
                        const pct = dashboardData.totalSalg > 0 ? ((data.salg / dashboardData.totalSalg) * 100).toFixed(1) : '0';
                        return (
                          <div key={dept} style={{ display: 'grid', gridTemplateColumns: '200px 100px 200px 100px', gap: '1rem', padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div>{dept}</div>
                            <div>{data.salg}</div>
                            <div>kr {data.omsetning.toLocaleString('no-NO')}</div>
                            <div>{pct}%</div>
                          </div>
                        );
                      })}
                      <div style={{ display: 'grid', gridTemplateColumns: '200px 100px 200px 100px', gap: '1rem', padding: '1rem', background: '#f9f9f9', fontWeight: '600', borderTop: '2px solid #667eea' }}>
                        <div>TOTALT</div>
                        <div>{dashboardData.totalSalg}</div>
                        <div>kr {dashboardData.totalOmsetning.toLocaleString('no-NO')}</div>
                        <div>100%</div>
                      </div>
                    </div>
                  </>
                )}

                {!dashboardData && (
                  <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
                    Velg fra og til dato for å se omsetningsdata
                  </p>
                )}
              </div>
            )}

            {/* Other tabs placeholder */}
            {activeAllenteTab !== 'i-dag' && activeAllenteTab !== 'salg' && activeAllenteTab !== 'angring' && activeAllenteTab !== 'produkt' && activeAllenteTab !== 'badges' && activeAllenteTab !== 'progresjon' && activeAllenteTab !== 'dashboard' && activeAllenteTab !== 'mal' && activeAllenteTab !== 'stats' && activeAllenteTab !== 'stats' && (
              <div className="tab-content">
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                  {allenteTabs.find(t => t.id === activeAllenteTab)?.label} tab content coming soon...
                </p>
              </div>
            )}
          </>
        )}

        {activeMainTab === 'dashboard' && (
          <div className="tab-content">
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
              Dashboard content coming soon...
            </p>
          </div>
        )}

        {activeMainTab === 'organisasjon' && (
          <div className="tab-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700', color: '#333' }}>Ansattestyring</h2>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#666' }}>Administrere alle ansatte i Muon AS</p>
              </div>
              <button 
                onClick={() => setShowAddModal(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                ➕ Legg til Ansatt
              </button>
            </div>

            {loadingEmployees ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                Laster ansatte...
              </p>
            ) : (
              <>
                {employees.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#dc2626', padding: '2rem', fontWeight: '600' }}>
                    ⚠️ Ingen ansatte funnet i Firestore. Klikk "➕ Legg til Ansatt" for å legge til.
                  </p>
                )}
                {/* Statistics Cards - 4 Columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ background: '#667eea', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>TOTALT</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.length}</p>
                  </div>
                  <div style={{ background: '#10b981', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>KRS</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.filter(e => e.department === 'KRS').length}</p>
                  </div>
                  <div style={{ background: '#f59e0b', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>SKIEN</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.filter(e => e.department === 'Skien').length}</p>
                  </div>
                  <div style={{ background: '#3b82f6', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>OSL</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.filter(e => e.department === 'OSL').length}</p>
                  </div>
                </div>

                {/* Search Field */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <input
                    type="text"
                    placeholder="Søk etter navn eller e-post..."
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      color: '#333',
                      boxSizing: 'border-box',
                      backgroundColor: '#fff',
                    }}
                  />
                </div>

                <div style={{ width: '100%', marginBottom: '1rem', overflowX: 'auto' }}>
                  <div className="employees-table" style={{ width: '100%', minWidth: '1100px' }}>
                    <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '140px 220px 80px 90px 85px 100px 95px 180px 110px', gap: '0.5rem', padding: '0.75rem 0.5rem', background: '#f9fafb', borderRadius: '6px 6px 0 0', fontWeight: '700', fontSize: '0.9rem', position: 'sticky', top: 0 }}>
                      <div>Navn</div>
                      <div>E-post</div>
                      <div>Rolle</div>
                      <div>Prosjekt</div>
                      <div>Avdeling</div>
                      <div>TMG-navn</div>
                      <div>Stilling</div>
                      <div>Ekstern navn</div>
                      <div>Handlinger</div>
                    </div>
                    {employees
                      .filter(emp => emp.name?.toLowerCase().includes(employeeSearchQuery.toLowerCase()) || emp.email?.toLowerCase().includes(employeeSearchQuery.toLowerCase()))
                      .map((emp) => {
                        const getRoleColor = (role?: string) => {
                          switch(role) {
                            case 'owner': return '#a78bfa'; // purple
                            case 'teamlead': return '#60a5fa'; // blue
                            default: return '#34d399'; // green
                          }
                        };
                        const getRoleLabel = (role?: string) => {
                          switch(role) {
                            case 'owner': return 'eier';
                            case 'teamlead': return 'teamleder';
                            default: return 'selger';
                          }
                        };
                        return (
                      <div key={emp.id} style={{ display: 'grid', gridTemplateColumns: '140px 220px 80px 90px 85px 100px 95px 180px 110px', gap: '0.5rem', padding: '0.75rem 0.5rem', background: 'white', borderBottom: '1px solid #e5e7eb', alignItems: 'center', fontWeight: '600', fontSize: '0.9rem' }}>
                        <div style={{ fontWeight: '700', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name && emp.name !== 'N/A' ? emp.name : '⚠️ Ingen navn'}</div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email || '-'}</div>
                        <div><span style={{ background: getRoleColor(emp.role), color: 'white', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>{getRoleLabel(emp.role)}</span></div>
                        <div style={{ color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.project || '-'}</div>
                        <div style={{ color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.department || '-'}</div>
                        <div style={{ color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.tmgName || '-'}</div>
                        <div style={{ color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.stilling || '-'}</div>
                        <div style={{ color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.externalName || '-'}</div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', justifyContent: 'space-between' }}>
                          <button 
                            onClick={() => handleEditClick(emp)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer',
                              color: '#667eea',
                              textDecoration: 'underline',
                              padding: '0',
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Rediger
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(emp.id, emp.name)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer',
                              color: '#dc2626',
                              textDecoration: 'underline',
                              padding: '0',
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Slett
                          </button>
                        </div>
                      </div>
                    );
                      })}
                  </div>
                </div>

                <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                  Total: {employees.length} ansatte
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h2>Arkiver ansatt?</h2>
            <p>
              Er du sikker på at du vil arkivere <strong>{deleteConfirm.employeeName}</strong>?
            </p>
            <p className="modal-info">
              Ansattet vil bli markert som arkivert i Firestore og fjernet fra listen.
            </p>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                Avbryt
              </button>
              <button 
                className="modal-btn delete-btn"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Arkiverer...' : 'Ja, arkiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <h2>Rediger ansatt</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>Navn *</label>
                <input 
                  type="text"
                  value={editingEmployee.name || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email"
                  value={editingEmployee.email || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  placeholder="epost@bedrift.no"
                />
              </div>
              <div className="form-group">
                <label>Passord *</label>
                <input 
                  type="password"
                  value={editingEmployee.password || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, password: e.target.value })}
                  placeholder="Sikker passord"
                />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select 
                  value={editingEmployee.role || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                >
                  <option value="">Velg rolle</option>
                  <option value="owner">Owner</option>
                  <option value="teamlead">Teamlead</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prosjekt</label>
                <select 
                  value={editingEmployee.project || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, project: e.target.value })}
                >
                  <option value="">Velg prosjekt</option>
                  <option value="Allente">Allente</option>
                  <option value="AT Ventilasjon">AT Ventilasjon</option>
                  <option value="Muon">Muon</option>
                </select>
              </div>
              <div className="form-group">
                <label>Stilling</label>
                <select 
                  value={editingEmployee.stilling || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, stilling: e.target.value })}
                >
                  <option value="">Velg stilling</option>
                  <option value="Fulltid">Fulltid</option>
                  <option value="Deltid">Deltid</option>
                </select>
              </div>
              <div className="form-group">
                <label>Avdeling</label>
                <select 
                  value={editingEmployee.department || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                >
                  <option value="">Velg avdeling</option>
                  <option value="OSL">OSL</option>
                  <option value="KRS">KRS</option>
                  <option value="Skien">Skien</option>
                  <option value="MUON">MUON</option>
                </select>
              </div>
              <div className="form-group">
                <label>Slack Navn</label>
                <input 
                  type="text"
                  value={editingEmployee.slackName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, slackName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Ekstern Navn *</label>
                <input 
                  type="text"
                  placeholder='f.eks "Mats / selger"'
                  value={editingEmployee.externalName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, externalName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>TMG Navn</label>
                <input 
                  type="text"
                  value={editingEmployee.tmgName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, tmgName: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEmployee(null);
                }}
              >
                Avbryt
              </button>
              <button 
                className="modal-btn save-btn"
                onClick={handleSaveEdit}
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <h2>Legg til ansatt</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>Navn *</label>
                <input 
                  type="text"
                  value={newEmployee.name || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  placeholder="Fullt navn"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email"
                  value={newEmployee.email || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  placeholder="epost@bedrift.no"
                />
              </div>
              <div className="form-group">
                <label>Passord *</label>
                <input 
                  type="password"
                  value={newEmployee.password || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                  placeholder="Sikker passord"
                />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select 
                  value={newEmployee.role || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                >
                  <option value="">Velg rolle</option>
                  <option value="owner">Owner</option>
                  <option value="teamlead">Teamlead</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prosjekt</label>
                <select 
                  value={newEmployee.project || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, project: e.target.value })}
                >
                  <option value="">Velg prosjekt</option>
                  <option value="Allente">Allente</option>
                  <option value="AT Ventilasjon">AT Ventilasjon</option>
                  <option value="Muon">Muon</option>
                </select>
              </div>
              <div className="form-group">
                <label>Stilling</label>
                <select 
                  value={newEmployee.stilling || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, stilling: e.target.value })}
                >
                  <option value="">Velg stilling</option>
                  <option value="Fulltid">Fulltid</option>
                  <option value="Deltid">Deltid</option>
                </select>
              </div>
              <div className="form-group">
                <label>Avdeling</label>
                <select 
                  value={newEmployee.department || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                >
                  <option value="">Velg avdeling</option>
                  <option value="OSL">OSL</option>
                  <option value="KRS">KRS</option>
                  <option value="Skien">Skien</option>
                  <option value="MUON">MUON</option>
                </select>
              </div>
              <div className="form-group">
                <label>Slack Navn</label>
                <input 
                  type="text"
                  value={newEmployee.slackName || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, slackName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Ekstern Navn *</label>
                <input 
                  type="text"
                  placeholder='f.eks "Mats / selger"'
                  value={newEmployee.externalName || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, externalName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>TMG Navn</label>
                <input 
                  type="text"
                  value={newEmployee.tmgName || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, tmgName: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={() => {
                  setShowAddModal(false);
                  setNewEmployee({
                    name: '',
                    email: '',
                    password: '',
                    role: 'employee',
                    project: 'Allente',
                    department: 'OSL',
                    slackName: '',
                    externalName: '',
                    tmgName: '',
                    stilling: 'Fulltid',
                  });
                }}
              >
                Avbryt
              </button>
              <button 
                className="modal-btn save-btn"
                onClick={handleSaveAdd}
              >
                Legg til
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={uploadModal.isOpen}
        title={getUploadModalTitle()}
        fileType={uploadModal.fileType || 'salg'}
        onClose={() => setUploadModal({ isOpen: false })}
        onUpload={handleFileUpload}
      />
    </div>
  );
}
