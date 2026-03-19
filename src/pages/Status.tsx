import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/Status.css';

interface Target {
  day: number;
  week: number;
  month: number;
}

interface DailyStat {
  date: string;
  count: number;
  revenue: number;
}

interface Badge {
  id: string;
  emoji: string;
  navn: string;
  verdi: number;
  beskrivelse: string;
}

export default function Status() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<Target>({
    day: 5,
    week: 25,
    month: 100,
  });
  const [todayStats, setTodayStats] = useState<DailyStat>({
    date: new Date().toLocaleDateString('no-NO'),
    count: 0,
    revenue: 0,
  });
  const [weekStats, setWeekStats] = useState<DailyStat>({
    date: 'Denne uken',
    count: 0,
    revenue: 0,
  });
  const [monthStats, setMonthStats] = useState<DailyStat>({
    date: 'Denne måneden',
    count: 0,
    revenue: 0,
  });
  const [editingTarget, setEditingTarget] = useState<'day' | 'week' | 'month' | null>(null);
  const [tempValue, setTempValue] = useState<number>(0);
  const [monthEdited, setMonthEdited] = useState<boolean>(false);
  const [runRates, setRunRates] = useState({
    dayTo16: 0,
    dayTo21: 0,
    week: 0,
    month: 0,
  });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievedBadges, setAchievedBadges] = useState<string[]>([]);

  // Load data from Progresjon (same logic as dashboards)
  useEffect(() => {
    if (!user || !user.name) return;

    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      const employeeDetailMap: { [key: string]: { dept: string; externalName: string; visualName: string } } = {};

      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const dept = data.department || 'Unknown';
        const externalName = data.externalName || '';
        const visualName = data.name || '';

        if (data.name) {
          employeeDetailMap[data.name.toLowerCase().trim()] = { dept, externalName, visualName };
        }
        if (data.externalName) {
          employeeDetailMap[data.externalName.toLowerCase().trim()] = { dept, externalName, visualName };
        }
      });

      const getEmployeeDetail = (ansatt: string): { dept: string; externalName: string; visualName: string } => {
        const ansattLower = ansatt.toLowerCase().trim();
        if (employeeDetailMap[ansattLower]) return employeeDetailMap[ansattLower];
        for (const [key, detail] of Object.entries(employeeDetailMap)) {
          if (key.includes(ansattLower) || ansattLower.includes(key)) {
            return detail;
          }
        }
        return { dept: 'Unknown', externalName: '', visualName: ansatt };
      };

      const livefeedRef = collection(db, 'livefeed_sales');
      const unsubscribeLivefeed = onSnapshot(livefeedRef, (livefeedSnapshot) => {
        const contractsRef = collection(db, 'allente_kontraktsarkiv');
        const unsubscribeArchive = onSnapshot(contractsRef, (archiveSnapshot) => {
          try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const sellerStats: { [key: string]: any } = {};

            // Load from livefeed (TODAY)
            livefeedSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              const ansatt = data.userName || 'Ukjent';
              const detail = getEmployeeDetail(ansatt);

              if (!sellerStats[ansatt]) {
                sellerStats[ansatt] = {
                  ansatt: detail.visualName,
                  avdeling: detail.dept,
                  externalName: ansatt,
                  today: 0,
                  week: 0,
                  month: 0,
                };
              }
              sellerStats[ansatt].today++;
            });

            // Load from archive (HISTORICAL)
            archiveSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              let originalSelger = data.selger || 'Ukjent';
              let ansatt = originalSelger.replace(/ \/ selger$/i, '').trim();
              const detail = getEmployeeDetail(ansatt);
              const dato = data.dato || '';

              if (!sellerStats[ansatt]) {
                sellerStats[ansatt] = {
                  ansatt: detail.visualName,
                  avdeling: detail.dept,
                  externalName: originalSelger,
                  today: 0,
                  week: 0,
                  month: 0,
                };
              }

              if (dato && typeof dato === 'string') {
                const parts = dato.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0]);
                  const month = parseInt(parts[1]);
                  const year = parseInt(parts[2]);
                  const orderDate = new Date(year, month - 1, day);

                  if (orderDate >= today && orderDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
                    sellerStats[ansatt].today++;
                  }
                  if (orderDate >= startOfWeek && orderDate <= today) {
                    sellerStats[ansatt].week++;
                  }
                  if (orderDate >= startOfMonth && orderDate <= today) {
                    sellerStats[ansatt].month++;
                  }
                }
              }
            });

            // Find current user's data
            const userData = sellerStats[user.name];
            if (userData) {
              const todayCount = userData.today;
              const totalWeek = userData.week;
              const totalMonth = userData.month;

              setTodayStats({
                date: new Date().toLocaleDateString('no-NO'),
                count: todayCount,
                revenue: todayCount * 1000,
              });

              // Calculate runrates
              const now = new Date();
              const currentHour = now.getHours() + (now.getMinutes() / 60);
              const runrateTo16 = currentHour > 0 ? Math.round((todayCount / currentHour) * 6) : 0;
              const runrateTo21 = currentHour > 0 ? Math.round((todayCount / currentHour) * 10) : 0;

              const dayOfWeek = today.getDay();
              const daysCompleted = dayOfWeek === 0 ? 0 : dayOfWeek;
              const weekRunRate = daysCompleted > 0 ? Math.round((totalWeek / daysCompleted) * 5) : 0;

              setWeekStats({
                date: 'Denne uken',
                count: totalWeek,
                revenue: totalWeek * 1000,
              });

              const norwegianHolidays2026 = ['2026-01-01', '2026-04-09', '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-17', '2026-05-21', '2026-05-31', '2026-06-01', '2026-12-25', '2026-12-26'];
              let daysCompletedMonth = 0;
              for (let d = 1; d <= today.getDate(); d++) {
                const checkDate = new Date(today.getFullYear(), today.getMonth(), d);
                const dayOfWeekCheck = checkDate.getDay();
                const dateStr = checkDate.toISOString().split('T')[0];
                if (dayOfWeekCheck >= 1 && dayOfWeekCheck <= 5 && !norwegianHolidays2026.includes(dateStr)) {
                  daysCompletedMonth++;
                }
              }

              const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
              let workingDaysMonth = 0;
              for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = new Date(today.getFullYear(), today.getMonth(), d);
                const dayOfWeekCheck = checkDate.getDay();
                const dateStr = checkDate.toISOString().split('T')[0];
                if (dayOfWeekCheck >= 1 && dayOfWeekCheck <= 5 && !norwegianHolidays2026.includes(dateStr)) {
                  workingDaysMonth++;
                }
              }

              const monthRunRate = daysCompletedMonth > 0 ? Math.round((totalMonth / daysCompletedMonth) * workingDaysMonth) : 0;

              setMonthStats({
                date: new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }),
                count: totalMonth,
                revenue: totalMonth * 1000,
              });

              setRunRates({
                dayTo16: runrateTo16,
                dayTo21: runrateTo21,
                week: weekRunRate,
                month: monthRunRate,
              });

              console.log('✅ PROGRESJON STATS LOADED:', { todayCount, totalWeek, totalMonth });
            }
          } catch (err) {
            console.error('❌ Error loading stats:', err);
          }
        });

        return () => {
          unsubscribeLivefeed();
          unsubscribeArchive();
        };
      });
    });
  }, [user?.id, user?.name]);

  // Check for badge achievements and post to livefeed
  useEffect(() => {
    if (!user || todayStats.count === 0) return;

    const postAchievedBadges = async () => {
      const announceKey = `announced_badges_${user.id}`;
      const announced = JSON.parse(localStorage.getItem(announceKey) || '{}') as { [key: string]: boolean };

      const badgesToPost: { id: string; emoji: string; name: string }[] = [];

      // Check 5 SALG
      if (todayStats.count >= 5 && !announced.fem) {
        badgesToPost.push({ id: 'fem', emoji: '🚀', name: '5 SALG' });
        announced.fem = true;
      }
      // Check 10 SALG
      if (todayStats.count >= 10 && !announced.ti) {
        badgesToPost.push({ id: 'ti', emoji: '🎯', name: '10 SALG' });
        announced.ti = true;
      }
      // Check 15 SALG
      if (todayStats.count >= 15 && !announced.femten) {
        badgesToPost.push({ id: 'femten', emoji: '🔥', name: '15 SALG' });
        announced.femten = true;
      }
      // Check 20 SALG
      if (todayStats.count >= 20 && !announced.tjue) {
        badgesToPost.push({ id: 'tjue', emoji: '💎', name: '20 SALG' });
        announced.tjue = true;
      }
      // Check FØRSTE
      if (todayStats.count >= 1 && !announced.forste) {
        badgesToPost.push({ id: 'forste', emoji: '🎓', name: 'FØRSTE SALGET' });
        announced.forste = true;
      }

      // Post new badges to livefeed
      for (const badge of badgesToPost) {
        try {
          await addDoc(collection(db, 'livefeed_sales'), {
            userId: user.id,
            userName: user.name,
            userDepartment: user.department || 'Ukjent',
            product: `${badge.emoji} ${badge.name}`,
            productPrice: 0,
            gifUrl: 'BADGE_ACHIEVEMENT',
            timestamp: new Date(),
            userRole: user.role || 'employee',
            isBadgePost: true,
          });
          console.log(`✅ Badge posted: ${user.name} - ${badge.name}`);
        } catch (err) {
          console.error('❌ Error posting badge:', err);
        }
      }

      // Save announced badges
      if (badgesToPost.length > 0) {
        localStorage.setItem(announceKey, JSON.stringify(announced));
      }
    };

    postAchievedBadges();
  }, [user?.id, todayStats.count]);

  // Load badges and earned badges from Firestore
  useEffect(() => {
    const loadBadges = async () => {
      try {
        const badgesList: Badge[] = [];

        // Master badge list (all milestones)
        const testBadges: Badge[] = [
          { id: 'min_første_dag', emoji: '🚀', navn: 'Min første i dag', verdi: -1, beskrivelse: 'Første salget i dag (hver dag)' },
          { id: 'dagens_første', emoji: '⚡', navn: 'Dagens første', verdi: 0, beskrivelse: 'Første salget i dag globalt (kun en person)' },
          { id: 'første', emoji: '🎓', navn: 'FØRSTE SALGET', verdi: 1, beskrivelse: 'Gjøre første salg' },
          { id: '5salg', emoji: '🎯', navn: '5 SALG', verdi: 5, beskrivelse: 'Gjøre 5 salg på en dag' },
          { id: '10salg', emoji: '🎪', navn: '10 SALG', verdi: 10, beskrivelse: 'Gjøre 10 salg på en dag' },
          { id: '15salg', emoji: '🔥', navn: '15 SALG', verdi: 15, beskrivelse: 'Gjøre 15 salg på en dag' },
          { id: '20salg', emoji: '💎', navn: '20 SALG', verdi: 20, beskrivelse: 'Gjøre 20 salg på en dag' },
          { id: 'best', emoji: '🏆', navn: 'BEST', verdi: 999, beskrivelse: 'Flest salg totalt noen sinne' },
        ];

        badgesList.push(...testBadges);

        // Filter and sort
        const namedBadges = badgesList.filter((badge) => badge.navn && badge.navn.trim().length > 0);
        namedBadges.sort((a, b) => a.verdi - b.verdi);

        // Load earned badges from Firestore for current user
        let earnedBadgeIds: string[] = [];
        if (user?.id) {
          const earnedSnap = await getDocs(collection(db, `users/${user.id}/earned_badges`));
          earnedBadgeIds = earnedSnap.docs.map(doc => doc.id);
          
          // Auto-award 🎓 if user has any historical sales from contracts
          // (they get it for free if they already have sales)
          if (user?.name) {
            try {
              const contractsSnap = await getDocs(collection(db, 'allente_kontraktsarkiv'));
              let haHistoricalSalg = false;
              
              contractsSnap.docs.forEach((doc) => {
                const data = doc.data();
                const selger = data.selger || '';
                let ansatt = selger.replace(/ \/ selger$/i, '').trim();
                if (ansatt.toLowerCase() === user.name.toLowerCase()) {
                  haHistoricalSalg = true;
                }
              });
              
              // If has historical sales and doesn't have 🎓 badge yet, auto-award it
              if (haHistoricalSalg && !earnedBadgeIds.includes('første')) {
                try {
                  const firstRef = doc(db, `users/${user.id}/earned_badges`, 'første');
                  await setDoc(firstRef, {
                    earnedAt: new Date().toISOString(),
                    badgeName: 'FØRSTE SALGET',
                    emoji: '🎓',
                    autoAwarded: true,
                    reason: 'Existing historical sales',
                  });
                  earnedBadgeIds.push('første');
                  console.log('🎓 Auto-awarded FØRSTE SALGET (historical sales)');
                } catch (err) {
                  console.log('Error auto-awarding første:', err);
                }
              }
            } catch (err) {
              console.log('Error checking historical sales:', err);
            }
          }
        }

        // Check if TODAY'S sales unlocked any new badges (only real milestones, not 🏆)
        const newlyAchieved: string[] = [];
        
        // MIN FØRSTE I DAG: Award when first sale of the day (can earn every day, once per day)
        if (user?.name && todayStats.count > 0) {
          try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
            const badgeKeyToday = `min_første_dag_${todayStr}`;
            
            // Check if already earned "Min første i dag" today
            if (!earnedBadgeIds.includes(badgeKeyToday)) {
              newlyAchieved.push('min_første_dag');
              console.log('🚀 Min første i dag unlocked!');
              
              // Store with date suffix to allow re-earning each day
              if (user?.id) {
                try {
                  const badgeRef = doc(db, `users/${user.id}/earned_badges`, badgeKeyToday);
                  await setDoc(badgeRef, {
                    earnedAt: new Date().toISOString(),
                    badgeName: 'Min første i dag',
                    emoji: '🚀',
                    date: todayStr,
                  });
                  earnedBadgeIds.push(badgeKeyToday);
                  console.log(`✅ Stored: ${badgeKeyToday}`);
                } catch (err) {
                  console.log('Error storing min_første_dag:', err);
                }
              }
            }
          } catch (err) {
            console.log('Error with min_første_dag:', err);
          }
        }
        
        // FØRSTE SALGET: Award only on first-ever sale (0 → 1+)
        // Calculate lifetime total from both livefeed AND contracts
        if (user?.name) {
          let lifetimeSalg = 0;
          try {
            // Count from contracts (historical)
            const contractsSnap = await getDocs(collection(db, 'allente_kontraktsarkiv'));
            contractsSnap.docs.forEach((doc) => {
              const data = doc.data();
              const selger = data.selger || '';
              let ansatt = selger.replace(/ \/ selger$/i, '').trim();
              if (ansatt.toLowerCase() === user.name.toLowerCase()) {
                lifetimeSalg++;
              }
            });
            
            // Count from livefeed (recent)
            const livefeedSnap = await getDocs(collection(db, 'livefeed_sales'));
            livefeedSnap.docs.forEach((doc) => {
              const data = doc.data();
              const userName = data.userName || '';
              if (userName.toLowerCase() === user.name.toLowerCase() && !data.type) {
                lifetimeSalg++;
              }
            });
            
            console.log(`📊 Lifetime salg for ${user.name}: ${lifetimeSalg}`);
            
            // If just got first sale (was 0, now > 0)
            if (lifetimeSalg > 0 && !earnedBadgeIds.includes('første')) {
              newlyAchieved.push('første');
              console.log('🎓 FØRSTE SALGET unlocked!');
            }
          } catch (err) {
            console.log('Error calculating lifetime salg:', err);
          }
        }
        
        // Special check for "Dagens første" - only award if:
        // 1. User doesn't already have it earned
        // 2. No one else has earned it today
        if (todayStats.count > 0 && !earnedBadgeIds.includes('dagens_første')) {
          try {
            // Check if anyone earned this badge today
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            const livefeedRef = collection(db, 'livefeed_sales');
            const todaysPosts = await getDocs(livefeedRef);
            
            let dagensFørsteAwardedToday = false;
            todaysPosts.docs.forEach((doc) => {
              const data = doc.data();
              const postDate = data.timestamp?.toDate?.() || new Date(data.timestamp);
              const postDateStr = postDate.toISOString().split('T')[0];
              
              if (data.badgeName === 'Dagens første' && postDateStr === todayStr) {
                dagensFørsteAwardedToday = true;
              }
            });
            
            // Only award if not awarded yet today
            if (!dagensFørsteAwardedToday) {
              newlyAchieved.push('dagens_første');
            }
          } catch (err) {
            console.log('Error checking dagens_første:', err);
          }
        }
        
        // Other milestone badges
        namedBadges.forEach((badge) => {
          if (badge.id === 'min_første_dag' || badge.id === 'dagens_første' || badge.id === 'første') return; // Skip, handled above
          if (badge.verdi > 0 && badge.verdi < 999) { // Only regular milestones
            if (!earnedBadgeIds.includes(badge.id) && todayStats.count >= badge.verdi) {
              newlyAchieved.push(badge.id);
            }
          }
        });

        // Auto-save newly achieved badges + post to livefeed
        if (newlyAchieved.length > 0 && user?.id) {
          try {
            console.log('🎖️ Saving badges for user:', user.id, user.name);
            console.log('📊 Newly achieved:', newlyAchieved);
            
            // Save ALL newly achieved badges to Firestore
            for (const badgeId of newlyAchieved) {
              const badge = namedBadges.find(b => b.id === badgeId);
              const earnedRef = doc(db, `users/${user.id}/earned_badges`, badgeId);
              
              const badgeData = {
                earnedAt: new Date().toISOString(),
                badgeName: badge?.navn || '',
                emoji: badge?.emoji || '',
                userId: user.id,
                userName: user.name,
              };
              
              console.log(`💾 Setting badge ${badgeId}:`, badgeData);
              await setDoc(earnedRef, badgeData);
              console.log(`✅ Badge saved: ${badgeId}`);
            }

            // Determine which badge to post
            // Priority: MIN FØRSTE I DAG (personal daily) > FØRSTE SALGET (lifetime) > highest milestone
            let badgeToPost = null;
            
            if (newlyAchieved.includes('min_første_dag')) {
              // Post "Min første i dag" immediately (personal daily, always priority)
              badgeToPost = namedBadges.find(b => b.id === 'min_første_dag');
            } else if (newlyAchieved.includes('første')) {
              // Post FØRSTE SALGET (special case - first-ever sale)
              badgeToPost = namedBadges.find(b => b.id === 'første');
            } else {
              // Post the highest milestone reached (excluding dagens_første, første, min_første_dag, and best)
              const sortedByValue = newlyAchieved
                .map(id => namedBadges.find(b => b.id === id))
                .filter(b => b !== undefined && b?.verdi > 0 && b?.verdi < 999)
                .sort((a, b) => (b?.verdi || 0) - (a?.verdi || 0));

              if (sortedByValue.length > 0 && sortedByValue[0]) {
                badgeToPost = sortedByValue[0];
              }
            }

            if (badgeToPost) {
              const livefeedRef = collection(db, 'livefeed_sales');
              
              const livefeedData = {
                type: 'badge_earned',
                userName: user.name,
                badge: badgeToPost.emoji,
                badgeName: badgeToPost.navn,
                timestamp: new Date(),
                message: `${user.name} ${badgeToPost.emoji} ${badgeToPost.navn}!`,
              };
              
              console.log('📝 Posting to livefeed:', livefeedData);
              const docRef = await addDoc(livefeedRef, livefeedData);
              console.log('📤 Posted to livefeed:', docRef.id);
            }

            earnedBadgeIds = [...earnedBadgeIds, ...newlyAchieved];
            console.log('✅ Badge process complete');
          } catch (err) {
            console.error('❌ Error saving badges:', err);
          }
        } else {
          if (newlyAchieved.length > 0) {
            console.warn('⚠️ Cannot save badges - user not ready:', { userId: user?.id, userName: user?.name });
          }
        }

        setBadges(namedBadges);
        setAchievedBadges(earnedBadgeIds);

        console.log('✅ Badges loaded:', namedBadges.length);
        console.log('🏅 Earned by this user:', earnedBadgeIds);
      } catch (err) {
        console.error('❌ Error loading badges:', err);
      }
    };

    loadBadges();
  }, [user?.id, todayStats.count]);

  // Award 🏆 to employee with most total salg (one-time setup)
  useEffect(() => {
    const awardTrophyBadge = async () => {
      try {
        // Get all employees and sum their total salg from archive
        const contractsSnap = await getDocs(collection(db, 'allente_kontraktsarkiv'));
        const employeeSalg: { [name: string]: number } = {};

        contractsSnap.docs.forEach((doc) => {
          const data = doc.data();
          const selger = data.selger || '';
          let ansatt = selger.replace(/ \/ selger$/i, '').trim();
          employeeSalg[ansatt] = (employeeSalg[ansatt] || 0) + 1;
        });

        // Find employee with most salg
        let topEmployee = '';
        let maxSalg = 0;
        for (const [name, salg] of Object.entries(employeeSalg)) {
          if (salg > maxSalg) {
            maxSalg = salg;
            topEmployee = name;
          }
        }

        if (topEmployee && maxSalg > 0) {
          // Get the user ID for this employee
          const empSnap = await getDocs(collection(db, 'employees'));
          let topEmployeeId = '';
          
          empSnap.docs.forEach((doc) => {
            const data = doc.data();
            const visualName = data.name || '';
            const externalName = data.externalName || '';
            
            // Match with topEmployee name
            if (visualName.toLowerCase().trim() === topEmployee.toLowerCase().trim() || 
                externalName.toLowerCase().trim() === topEmployee.toLowerCase().trim()) {
              topEmployeeId = doc.id;
            }
          });

          // Award 🏆 to top employee
          if (topEmployeeId) {
            const trophyRef = doc(db, `users/${topEmployeeId}/earned_badges`, 'best');
            await setDoc(trophyRef, {
              earnedAt: new Date().toISOString(),
              badgeName: 'BEST',
              emoji: '🏆',
              totalSalg: maxSalg,
              isTopAllTime: true,
            });
            console.log(`🏆 Trophy awarded to ${topEmployee} (${maxSalg} total salg)`);
          }
        }
      } catch (err) {
        console.error('Error awarding trophy:', err);
      }
    };

    // Run once on component mount
    awardTrophyBadge();
  }, []);

  // Load user targets from Firestore
  useEffect(() => {
    const loadTargets = async () => {
      if (!user) return;

      try {
        const snapshot = await getDocs(collection(db, 'user_targets'));
        let found = false;
        
        snapshot.forEach((doc) => {
          if (doc.id === user.id) {
            const data = doc.data();
            setTargets({
              day: data.day || 5,
              week: data.week || 25,
              month: data.month || 100,
            });
            console.log('✅ Targets loaded from Firestore');
            found = true;
          }
        });

        if (!found) {
          console.log('ℹ️ No targets saved - using defaults');
        }
      } catch (err) {
        console.error('❌ Error loading targets:', err);
      }
    };

    loadTargets();
  }, [user?.id]);

  const handleTargetEdit = (type: 'day' | 'week' | 'month') => {
    setEditingTarget(type);
    setTempValue(targets[type]);
  };

  const saveTarget = async (type: 'day' | 'week' | 'month') => {
    if (!user) return;

    let newTargets = { ...targets };

    if (type === 'month') {
      // Auto-calculate day and week from month
      const workdaysInMonth = 22; // Approximate
      const dayTarget = Math.round(tempValue / workdaysInMonth);
      const weekTarget = dayTarget * 5;
      newTargets = {
        day: dayTarget,
        week: weekTarget,
        month: tempValue,
      };
      setMonthEdited(true); // Mark month as edited
    } else {
      newTargets = {
        ...targets,
        [type]: tempValue,
      };
    }

    // Save to Firestore
    try {
      const targetRef = doc(db, 'user_targets', user.id);
      await setDoc(targetRef, {
        ...newTargets,
        updatedAt: new Date().toISOString(),
      });
      console.log('✅ Targets saved to Firestore');
    } catch (err) {
      console.error('❌ Error saving targets:', err);
    }

    setTargets(newTargets);
    setEditingTarget(null);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const testSaveBadge = async () => {
    if (!user?.id) {
      console.error('No user ID');
      return;
    }
    try {
      const testBadgeRef = doc(db, `users/${user.id}/earned_badges`, 'test_badge');
      await setDoc(testBadgeRef, {
        earnedAt: new Date().toISOString(),
        badgeName: 'TEST BADGE',
        emoji: '⭐',
        userId: user.id,
        userName: user.name,
      });
      console.log('✅ Test badge saved to:', `users/${user.id}/earned_badges/test_badge`);
      alert(`✅ Test badge saved! Check Firestore users/${user.id}/earned_badges`);
    } catch (err) {
      console.error('❌ Error saving test badge:', err);
      alert(`❌ Error: ${err}`);
    }
  };

  if (!user) return <div className="status-container">Laster...</div>;

  return (
    <div className="status-container">
      <div className="status-content">
        <h1 className="user-header">{user?.name}</h1>
        {user?.role === 'owner' && (
          <button 
            onClick={testSaveBadge}
            style={{ marginBottom: '1rem', padding: '0.5rem 1rem', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            🧪 Test Save Badge
          </button>
        )}

        {/* Progress Bars */}
        <div className="progress-section">
          {/* Today */}
          <div className="progress-item">
            <div className="progress-header">
              <div>
                <h3>I dag</h3>
                <p className="progress-current">{todayStats.count} av {targets.day}</p>
              </div>
              <button 
                className="edit-btn"
                onClick={() => handleTargetEdit('day')}
                disabled={!monthEdited}
                style={{ opacity: monthEdited ? 1 : 0.4, cursor: monthEdited ? 'pointer' : 'not-allowed' }}
              >
                Endre
              </button>
            </div>
            {editingTarget === 'day' ? (
              <div className="edit-input">
                <input
                  type="number"
                  value={tempValue}
                  onChange={(e) => setTempValue(Number(e.target.value))}
                />
                <button onClick={() => saveTarget('day')}>Lagre</button>
                <button onClick={() => setEditingTarget(null)}>Avbryt</button>
              </div>
            ) : (
              <>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage(todayStats.count, targets.day)}%` }}
                  ></div>
                </div>
                <div className="progress-meta">
                  <span>→ 16:00: {runRates.dayTo16} | → 21:00: {runRates.dayTo21}</span>
                  <span>{todayStats.revenue} kr</span>
                </div>
              </>
            )}
          </div>

          {/* Week */}
          <div className="progress-item">
            <div className="progress-header">
              <div>
                <h3>Denne uken</h3>
                <p className="progress-current">{weekStats.count} av {targets.week}</p>
              </div>
              <button 
                className="edit-btn"
                onClick={() => handleTargetEdit('week')}
                disabled={!monthEdited}
                style={{ opacity: monthEdited ? 1 : 0.4, cursor: monthEdited ? 'pointer' : 'not-allowed' }}
              >
                Endre
              </button>
            </div>
            {editingTarget === 'week' ? (
              <div className="edit-input">
                <input
                  type="number"
                  value={tempValue}
                  onChange={(e) => setTempValue(Number(e.target.value))}
                />
                <button onClick={() => saveTarget('week')}>Lagre</button>
                <button onClick={() => setEditingTarget(null)}>Avbryt</button>
              </div>
            ) : (
              <>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage(weekStats.count, targets.week)}%` }}
                  ></div>
                </div>
                <div className="progress-meta">
                  <span>Runrate: {runRates.week}</span>
                  <span>{weekStats.revenue} kr</span>
                </div>
              </>
            )}
          </div>

          {/* Month */}
          <div className="progress-item">
            <div className="progress-header">
              <div>
                <h3>Denne måneden</h3>
                <p className="progress-current">{monthStats.count} av {targets.month}</p>
              </div>
              <button 
                className="edit-btn"
                onClick={() => handleTargetEdit('month')}
              >
                Endre
              </button>
            </div>
            {editingTarget === 'month' ? (
              <div className="edit-input">
                <input
                  type="number"
                  value={tempValue}
                  onChange={(e) => setTempValue(Number(e.target.value))}
                />
                <button onClick={() => saveTarget('month')}>Lagre</button>
                <button onClick={() => setEditingTarget(null)}>Avbryt</button>
              </div>
            ) : (
              <>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage(monthStats.count, targets.month)}%` }}
                  ></div>
                </div>
                <div className="progress-meta">
                  <span>Runrate: {runRates.month}</span>
                  <span>{monthStats.revenue} kr</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Badges Section */}
        <div className="badges-section">
          <div className="badges-container">
            {badges.length > 0 && (
              <>
                {badges.map((badge) => {
                  // Special handling for "min_første_dag" - check if ANY date-suffixed version is achieved
                  let isAchieved = achievedBadges.includes(badge.id);
                  if (badge.id === 'min_første_dag') {
                    isAchieved = achievedBadges.some(b => b.startsWith('min_første_dag_'));
                  }
                  return (
                    <div
                      key={badge.id}
                      className={`badge-item ${isAchieved ? 'achieved' : 'dimmed'}`}
                      title={badge.beskrivelse}
                    >
                      <div className="badge-emoji">{badge.emoji}</div>
                      <div className="badge-name">{badge.navn}</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
