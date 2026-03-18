import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface UserStats {
  name: string;
  totalSales: number;
  bestDay: { count: number; date: string };
  bestMonth: { count: number; date: string };
  todayCount: number;
}

export interface BadgeAchievement {
  badgeId: string;
  emoji: string;
  navn: string;
  isNew: boolean; // True if achievement is new (wasn't achieved before)
}

const BADGE_DEFINITIONS = {
  'best': {
    id: 'best',
    emoji: '🏆',
    navn: 'BEST',
    verdi: 100,
    beskrivelse: 'Most sales total (all-time)',
  },
  'mvp_dag': {
    id: 'mvp_dag',
    emoji: '⭐',
    navn: 'MVP DAG',
    verdi: 100,
    beskrivelse: 'Most sales in a single day',
  },
  'mvp_maaned': {
    id: 'mvp_maaned',
    emoji: '👑',
    navn: 'MVP MÅNED',
    verdi: 100,
    beskrivelse: 'Most sales in a single month',
  },
  'forste': {
    id: 'forste',
    emoji: '🎓',
    navn: 'FØRSTE SALGET',
    verdi: 100,
    beskrivelse: 'Your first sale',
  },
  'femten': {
    id: 'femten',
    emoji: '🔥',
    navn: '15 SALG',
    verdi: 100,
    beskrivelse: '15 sales in one day',
  },
  'tjue': {
    id: 'tjue',
    emoji: '💎',
    navn: '20 SALG',
    verdi: 100,
    beskrivelse: '20 sales in one day',
  },
  'ti': {
    id: 'ti',
    emoji: '🎯',
    navn: '10 SALG',
    verdi: 100,
    beskrivelse: '10 sales in one day',
  },
  'fem': {
    id: 'fem',
    emoji: '🚀',
    navn: '5 SALG',
    verdi: 100,
    beskrivelse: '5 sales in one day',
  },
};

export async function calculateUserBadges(
  userStats: UserStats,
  allUsersStats: UserStats[],
  previousAchievedBadges: string[]
): Promise<BadgeAchievement[]> {
  const maxDayAcrossUsers = Math.max(...allUsersStats.map(u => u.bestDay.count), 0);
  const maxMonthAcrossUsers = Math.max(...allUsersStats.map(u => u.bestMonth.count), 0);
  const topUserByTotal = allUsersStats.reduce((max, u) => u.totalSales > max.totalSales ? u : max, allUsersStats[0]);

  const achieved: BadgeAchievement[] = [];

  // 🏆 BEST - Only if this user has most total sales
  if (userStats.name === topUserByTotal.name) {
    achieved.push({
      badgeId: 'best',
      emoji: BADGE_DEFINITIONS.best.emoji,
      navn: BADGE_DEFINITIONS.best.navn,
      isNew: !previousAchievedBadges.includes('best'),
    });
  }

  // ⭐ MVP DAG - If best day equals max across all users
  if (userStats.bestDay.count === maxDayAcrossUsers && maxDayAcrossUsers > 0) {
    achieved.push({
      badgeId: 'mvp_dag',
      emoji: BADGE_DEFINITIONS.mvp_dag.emoji,
      navn: BADGE_DEFINITIONS.mvp_dag.navn,
      isNew: !previousAchievedBadges.includes('mvp_dag'),
    });
  }

  // 👑 MVP MÅNED - If best month equals max across all users
  if (userStats.bestMonth.count === maxMonthAcrossUsers && maxMonthAcrossUsers > 0) {
    achieved.push({
      badgeId: 'mvp_maaned',
      emoji: BADGE_DEFINITIONS.mvp_maaned.emoji,
      navn: BADGE_DEFINITIONS.mvp_maaned.navn,
      isNew: !previousAchievedBadges.includes('mvp_maaned'),
    });
  }

  // 🎓 FØRSTE SALGET - If any sale
  if (userStats.totalSales >= 1) {
    achieved.push({
      badgeId: 'forste',
      emoji: BADGE_DEFINITIONS.forste.emoji,
      navn: BADGE_DEFINITIONS.forste.navn,
      isNew: !previousAchievedBadges.includes('forste'),
    });
  }

  // 🔥 15 SALG - If best day >= 15
  if (userStats.bestDay.count >= 15) {
    achieved.push({
      badgeId: 'femten',
      emoji: BADGE_DEFINITIONS.femten.emoji,
      navn: BADGE_DEFINITIONS.femten.navn,
      isNew: !previousAchievedBadges.includes('femten'),
    });
  }

  // 💎 20 SALG - If best day >= 20
  if (userStats.bestDay.count >= 20) {
    achieved.push({
      badgeId: 'tjue',
      emoji: BADGE_DEFINITIONS.tjue.emoji,
      navn: BADGE_DEFINITIONS.tjue.navn,
      isNew: !previousAchievedBadges.includes('tjue'),
    });
  }

  // 🎯 10 SALG - If best day >= 10
  if (userStats.bestDay.count >= 10) {
    achieved.push({
      badgeId: 'ti',
      emoji: BADGE_DEFINITIONS.ti.emoji,
      navn: BADGE_DEFINITIONS.ti.navn,
      isNew: !previousAchievedBadges.includes('ti'),
    });
  }

  // 🚀 5 SALG - If best day >= 5
  if (userStats.bestDay.count >= 5) {
    achieved.push({
      badgeId: 'fem',
      emoji: BADGE_DEFINITIONS.fem.emoji,
      navn: BADGE_DEFINITIONS.fem.navn,
      isNew: !previousAchievedBadges.includes('fem'),
    });
  }

  return achieved;
}

export async function postBadgeAchievementToLivefeed(
  userId: string,
  userName: string,
  userDepartment: string,
  userRole: string,
  badges: BadgeAchievement[]
) {
  const newBadges = badges.filter(b => b.isNew);
  
  for (const badge of newBadges) {
    try {
      await addDoc(collection(db, 'livefeed_sales'), {
        userId,
        userName,
        userDepartment,
        product: `${badge.emoji} ${badge.navn}`,
        productPrice: 0,
        gifUrl: 'BADGE_ACHIEVEMENT', // Special marker
        timestamp: serverTimestamp(),
        userRole,
        isBadgePost: true, // Flag for special styling
      });
      console.log(`✅ Badge posted: ${userName} - ${badge.navn}`);
    } catch (err) {
      console.error('❌ Error posting badge:', err);
    }
  }
}

export async function getAllUserStats(userName: string, livefeedData: any[], archiveData: any[]): Promise<{ user: UserStats; all: UserStats[] }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const userStatsMap: { [key: string]: UserStats } = {};

  // Process archive data (historical)
  archiveData.forEach((data) => {
    let selger = data.selger || '';
    selger = selger.replace(/ \/ selger$/i, '').trim();

    if (!userStatsMap[selger]) {
      userStatsMap[selger] = {
        name: selger,
        totalSales: 0,
        bestDay: { count: 0, date: '' },
        bestMonth: { count: 0, date: '' },
        todayCount: 0,
      };
    }

    const dato = data.dato || '';
    if (dato && typeof dato === 'string') {
      const parts = dato.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        const orderDate = new Date(year, month - 1, day);

        userStatsMap[selger].totalSales += 1;

        // Best day
        const dayKey = orderDate.toISOString().split('T')[0];
        const dayCount = archiveData.filter(d => {
          const dp = (d.dato || '').split('/');
          if (dp.length === 3) {
            const od = new Date(parseInt(dp[2]), parseInt(dp[1]) - 1, parseInt(dp[0]));
            return od.toISOString().split('T')[0] === dayKey && (d.selger || '').replace(/ \/ selger$/i, '').trim() === selger;
          }
          return false;
        }).length;
        if (dayCount > userStatsMap[selger].bestDay.count) {
          userStatsMap[selger].bestDay = { count: dayCount, date: orderDate.toLocaleDateString('no-NO') };
        }

        // Best month
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthCount = archiveData.filter(d => {
          const dp = (d.dato || '').split('/');
          if (dp.length === 3) {
            const mk = `${parseInt(dp[2])}-${String(parseInt(dp[1])).padStart(2, '0')}`;
            return mk === monthKey && (d.selger || '').replace(/ \/ selger$/i, '').trim() === selger;
          }
          return false;
        }).length;
        if (monthCount > userStatsMap[selger].bestMonth.count) {
          userStatsMap[selger].bestMonth = { count: monthCount, date: orderDate.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }) };
        }
      }
    }
  });

  // Process livefeed data (today only)
  livefeedData.forEach((data) => {
    const userName = data.userName || '';
    if (!userStatsMap[userName]) {
      userStatsMap[userName] = {
        name: userName,
        totalSales: archiveData.filter(d => (d.selger || '').replace(/ \/ selger$/i, '').trim() === userName).length,
        bestDay: { count: 0, date: '' },
        bestMonth: { count: 0, date: '' },
        todayCount: 0,
      };
    }
    userStatsMap[userName].todayCount += 1;
    userStatsMap[userName].totalSales += 1;

    // Update best day if today's count is higher
    if (userStatsMap[userName].todayCount > userStatsMap[userName].bestDay.count) {
      userStatsMap[userName].bestDay = { count: userStatsMap[userName].todayCount, date: new Date().toLocaleDateString('no-NO') };
    }
  });

  const allUsers = Object.values(userStatsMap);
  const userStats = userStatsMap[userName] || {
    name: userName,
    totalSales: 0,
    bestDay: { count: 0, date: '' },
    bestMonth: { count: 0, date: '' },
    todayCount: 0,
  };

  return { user: userStats, all: allUsers };
}
