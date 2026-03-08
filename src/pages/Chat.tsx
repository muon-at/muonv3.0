import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, onSnapshot, query, orderBy, updateDoc, doc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import ChannelModal from '../components/ChannelModal';
import '../styles/Chat.css';

interface Channel {
  id: string;
  name: string;
  type: 'project' | 'team' | 'admin' | 'avdeling' | 'global';
  unread: number;
  allowedUsers?: string[];
  emoji?: string;
  project?: string;
  avdeling?: string;
}

interface DMThread {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: number;
  unread: number;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  editedAt?: number;
  reactions?: Record<string, string[]>;
  replyTo?: {
    id: string;
    sender: string;
    content: string;
  };
  attachments?: {
    type: 'file' | 'gif';
    url: string;
    name?: string;
  }[];
  typingUsers?: string[];
  seenBy?: string[];
  isDeleted?: boolean;
}

export default function Chat() {
  const location = useLocation();
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [selectedDMUser, setSelectedDMUser] = useState<any>(null);
  const [isDMMode, setIsDMMode] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isPickingGif, setIsPickingGif] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({}); // Track unread messages per DM
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null); // Track which message is hovered
  const [topDepartment, setTopDepartment] = useState<string | null>(null); // Best department this week
  const [employeeMapByName, setEmployeeMapByName] = useState<any>({}); // Map of displayName -> {department}
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  // Emoji command mapping (e.g., :bell: → 🔔)
  const emojiCommandMap: Record<string, string> = {
    'bell': '🔔',
    'gem': '💎',
    'gift': '🎁',
    'thumbsup': '👍',
    'heart': '❤️',
    'laughing': '😂',
    'fire': '🔥',
    'clap': '👏',
    'love': '😍',
    'tada': '🎉',
    '100': '💯',
    'cry': '😢',
    'rage': '😡',
    'scream': '😱',
    'thinking': '🤔',
    'sunglasses': '😎',
    'raised_hands': '🙌',
    'muscle': '💪',
    'target': '🎯',
    'sparkles': '✨',
    'confetti': '🎊',
    'balloon': '🎈',
    'rocket': '🚀',
    'boom': '💥',
    'ok_hand': '👌',
    'pray': '🙏',
    'x': '❌',
    'check': '✅',
    'mask': '🎭',
    'circus': '🎪',
    'art': '🎨',
    'movie': '🎬',
    'microphone': '🎤',
    'guitar': '🎸',
    'piano': '🎹',
    'trumpet': '🎺',
    'soccer': '⚽',
    'basketball': '🏀',
    'dice': '🎲',
    'cards': '🃏',
    'pizza': '🍕',
    'burger': '🍔',
    'fries': '🍟',
    'chicken': '🍗',
    'taco': '🌮',
    'ramen': '🍜',
    'bento': '🍱',
    'cake': '🍰',
    'cookie': '🍪',
    'coffee': '☕',
    'wine': '🍷',
    'cocktail': '🍸',
    'tropical_drink': '🍹',
    'beer': '🍺',
    'cake2': '🎂',
    'cupcake': '🧁',
    'salad': '🥗',
    'paella': '🥘',
    'curry': '🍛',
  };

  // Reverse mapping for picker display
  const emojiWithCommands = Object.entries(emojiCommandMap).map(([cmd, emoji]) => ({
    emoji,
    command: cmd
  }));

  // Function to expand emoji commands in message
  const expandEmojiCommands = (text: string): string => {
    let result = text;
    Object.entries(emojiCommandMap).forEach(([cmd, emoji]) => {
      const cmdPattern = new RegExp(`:${cmd}:`, 'g');
      result = result.replace(cmdPattern, emoji);
    });
    return result;
  };

  // Get date label for messages (TODAY, YESTERDAY, or date string)
  const getDateLabel = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if same date (ignoring time)
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayDateOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    if (messageDateOnly.getTime() === todayDateOnly.getTime()) {
      return 'TODAY';
    } else if (messageDateOnly.getTime() === yesterdayDateOnly.getTime()) {
      return 'YESTERDAY';
    } else {
      // Format as "Monday 3.3" or similar
      const dayName = messageDate.toLocaleDateString('no-NO', { weekday: 'long' });
      const date = messageDate.toLocaleDateString('no-NO', { month: 'numeric', day: 'numeric' });
      return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${date}`;
    }
  };

  // Group messages by date
  const getMessagesGroupedByDate = (messages: Message[]): {date: string, messages: Message[]}[] => {
    const groups: {[key: string]: Message[]} = {};
    
    messages.forEach(msg => {
      const dateLabel = getDateLabel(msg.timestamp);
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(msg);
    });
    
    // Return as array, keeping order
    return Object.entries(groups).map(([date, msgs]) => ({
      date,
      messages: msgs
    }));
  };
  

  // Load channels on mount + calculate top department this week
  useEffect(() => {
    const load = async () => {
      await loadChannels();
      await loadDMs();
      await loadAllUsers();
      await calculateTopDepartment();
    };
    load();
  }, [user]);

  // Recalculate top department when messages change (live updates with emojis)
  useEffect(() => {
    if (selectedChannel === 'project-allente' || selectedChannel === 'global' || selectedChannel?.startsWith('dept-')) {
      calculateTopDepartment();
    }
  }, [messages, selectedChannel]);

  const calculateTopDepartment = async () => {
    try {
      // Load employees for mapping
      const employeesRef = collection(db, 'employees');
      const employeesSnap = await getDocs(employeesRef);
      const empMap: any = {};
      const empByName: any = {}; // Map display name -> emp data
      employeesSnap.forEach(docItem => {
        const emp = docItem.data();
        if (emp.externalName) {
          empMap[emp.externalName] = {
            department: emp.department || 'Ukjent',
            name: emp.name || emp.externalName
          };
        }
        if (emp.name) {
          empByName[emp.name] = { department: emp.department || 'Ukjent' };
        }
      });
      setEmployeeMapByName(empByName);

      // Load contracts and calculate this week sales per department
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const contractsSnap = await getDocs(contractsRef);
      
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      
      const deptSales: any = {};
      contractsSnap.forEach(docItem => {
        const contract = docItem.data();
        const cDate = parseDate(contract.dato);
        
        // Check if this week
        if (cDate >= weekStart && cDate <= today) {
          const dept = empMap[contract.selger]?.department || 'Ukjent';
          deptSales[dept] = (deptSales[dept] || 0) + 1;
        }
      });

      // Also count emoji points from this week (🔔=1, 💎=1, 🎁=1)
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(weekStart);
        checkDate.setDate(weekStart.getDate() + i);
        if (checkDate > today) break;
        
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        
        try {
          const emojiDocRef = doc(db, 'emoji_counts_daily', dateStr);
          const emojiSnap = await getDoc(emojiDocRef);
          
          if (emojiSnap.exists()) {
            const counts = emojiSnap.data()?.counts || {};
            Object.entries(counts).forEach(([empName, emojiData]: any) => {
              const dept = empByName[empName]?.department || 'Ukjent';
              const totalEmojis = (emojiData['🔔'] || 0) + (emojiData['💎'] || 0) + (emojiData['🎁'] || 0);
              deptSales[dept] = (deptSales[dept] || 0) + totalEmojis;
            });
          }
        } catch (e) {
          // Date might not have emoji data yet
        }
      }

      // Find top department
      const topDept = Object.entries(deptSales).sort((a, b) => (b[1] as any) - (a[1] as any))[0]?.[0];
      setTopDepartment(topDept || null);
      console.log('👑 Top department this week:', topDept, deptSales);
    } catch (err) {
      console.error('Error calculating top department:', err);
    }
  };

  // Parse dates in multiple formats
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

  const loadAllUsers = async () => {
    try {
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      const userMap: { [key: string]: any } = {}; // Deduplicate by name
      const rolePriority = { 'owner': 3, 'teamleder': 2, 'employee': 1, 'ansatt': 1 };
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Only add users that are not the current user
        if (data.name !== user?.name) {
          const newUser = {
            id: doc.id,
            name: data.name,
            email: data.email,
            department: data.department,
            role: data.role,
            lastMessageTime: 0, // Will be populated from DMs
            unread: 0, // Will be populated from DMs
          };
          
          // Keep the version with the highest role priority
          if (!userMap[data.name]) {
            userMap[data.name] = newUser;
          } else {
            const existingPriority = rolePriority[userMap[data.name].role as keyof typeof rolePriority] || 0;
            const newPriority = rolePriority[data.role as keyof typeof rolePriority] || 0;
            if (newPriority > existingPriority) {
              userMap[data.name] = newUser;
            }
          }
        }
      });
      
      // Load DM info (last message time + unread counts)
      const dmsRef = collection(db, 'chat_dms');
      const dmsSnap = await getDocs(dmsRef);
      const dmUnread: Record<string, number> = {};
      
      dmsSnap.forEach(doc => {
        const data = doc.data();
        if (data.participants && data.participants.includes(user?.name)) {
          // Find the other participant
          const otherParticipant = data.participants.find((p: string) => p !== user?.name);
          if (otherParticipant && userMap[otherParticipant]) {
            userMap[otherParticipant].lastMessageTime = data.lastMessageTime || 0;
            userMap[otherParticipant].unread = (user?.name && data.unread?.[user.name]) || 0;
            dmUnread[otherParticipant] = (user?.name && data.unread?.[user.name]) || 0;
          }
        }
      });
      
      setDmUnreadCounts(dmUnread);
      
      // Sort by lastMessageTime (newest first), then alphabetically
      const users = Object.values(userMap).sort((a, b) => {
        if (b.lastMessageTime !== a.lastMessageTime) {
          return b.lastMessageTime - a.lastMessageTime; // Most recent first
        }
        return a.name.localeCompare(b.name); // Alphabetical fallback
      });
      
      setAllUsers(users);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  // Auto-select channel if passed via navigation state (e.g., clicking Global in navbar)
  useEffect(() => {
    const state = location.state as any;
    
    // Handle selectedDM state
    if (state?.selectedDM === 'list') {
      setIsDMMode(true);
      setSelectedChannel(null);
      setSelectedDM(null);
      setSelectedDMUser(null);
      return;
    }
    
    // Handle selectedChannel state - ALWAYS switch out of DM mode when channel is selected
    if (state?.selectedChannel && channels.length > 0) {
      console.log('🔍 SELECTING CHANNEL', {
        user: user?.name,
        requestedChannel: state.selectedChannel,
        availableChannels: channels.map(c => ({ id: c.id, name: c.name, type: c.type }))
      });
      // Find the channel with matching type or id
      let channelToSelect = channels.find(c => c.id === state.selectedChannel || c.type === state.selectedChannel);
      
      if (channelToSelect) {
        console.log('✅ CHANNEL SELECTED:', {
          user: user?.name,
          channelName: channelToSelect.name,
          channelId: channelToSelect.id
        });
        setSelectedChannel(channelToSelect.id);
        setSelectedDM(null);
        setSelectedDMUser(null);
        setIsDMMode(false);  // EXIT DM MODE when selecting a channel
      } else {
        console.log('❌ Channel not found! Available channels:', channels.map(c => ({ id: c.id, name: c.name, type: c.type })));
      }
    }
  }, [location.state, channels]);

  // Load messages when channel/DM changes
  useEffect(() => {
    // Cleanup previous listener
    if (unsubscribeRef.current) {
      console.log('🔌 Unsubscribing from previous listener');
      unsubscribeRef.current();
      unsubscribeRef.current = undefined;
    }
    
    if (selectedChannel) {
      console.log('📥 useEffect: Loading messages for channel:', selectedChannel);
      loadChannelMessages(selectedChannel);
    } else if (selectedDM) {
      console.log('📥 useEffect: Loading messages for DM:', selectedDM);
      loadDMMessages(selectedDM);
    }
    
    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [selectedChannel, selectedDM]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Method 1: Scroll the messages area container to bottom
    if (messagesAreaRef.current) {
      const timer = setTimeout(() => {
        if (messagesAreaRef.current) {
          messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    
    // Method 2: Fallback to scrollIntoView on ref
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadChannels = async () => {
    try {
      // Ensure department channels exist
      const departments = ['KRS', 'OSL', 'Skien'];
      const channelsRef = collection(db, 'chat_channels');
      const existingSnap = await getDocs(channelsRef);
      const existingIds = new Set(existingSnap.docs.map(d => d.id));
      
      // Create department channels if they don't exist
      for (const dept of departments) {
        const deptId = `dept-${dept.toLowerCase()}`;
        if (!existingIds.has(deptId)) {
          const deptEmoji = dept === 'KRS' ? '🏝️' : dept === 'OSL' ? '🏢' : '🏭';
          await setDoc(doc(db, 'chat_channels', deptId), {
            name: dept,
            type: 'avdeling',
            avdeling: dept,
            emoji: deptEmoji,
            createdAt: new Date().toISOString(),
            messages: [],
          });
        }
      }

      // Create project channel for user's project if it exists and doesn't have a channel yet
      if (user?.project) {
        // BOTH MUON and Allente users share the same project-allente channel
        // This allows MUON (owner) and Allente (employees) to chat together
        const projectName = 'Allente'; // Always use Allente channel name
        const projectId = 'project-allente'; // Always use project-allente channel ID
        
        if (!existingIds.has(projectId)) {
          await setDoc(doc(db, 'chat_channels', projectId), {
            name: projectName,
            type: 'project',
            project: projectName,
            emoji: '📊',
            createdAt: new Date().toISOString(),
            messages: [],
          });
          existingIds.add(projectId);
        }
      }

      // Load all channels
      const snapshot = await getDocs(channelsRef);
      
      const allowedChannels: Channel[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const canAccess = checkChannelAccess(data.type, data.avdeling, data.allowedUsers, data.project);
        
        if (canAccess) {
          // Map Muon to Allente, handle case-insensitive
          let displayName = data.name;
          if (data.name?.toLowerCase() === 'muon' || data.name === 'Muon' || data.name === 'MUON') {
            displayName = 'Allente';
          }
          
          allowedChannels.push({
            id: doc.id,
            name: displayName,
            type: data.type,
            unread: 0,
            allowedUsers: data.allowedUsers,
            emoji: getChannelEmoji(displayName, data.emoji),
            project: data.project,
            avdeling: data.avdeling,
          });
        }
      });
      
      // Sort: global/project first, then department, then others
      const typeOrder = { 'global': 0, 'project': 1, 'avdeling': 2, 'team': 3, 'admin': 4 };
      allowedChannels.sort((a, b) => (typeOrder[a.type as keyof typeof typeOrder] || 5) - (typeOrder[b.type as keyof typeof typeOrder] || 5));
      
      setChannels(allowedChannels);
      console.log('📋 Channels loaded:', allowedChannels.length, 'channels');
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const loadDMs = async () => {
    try {
      const dmsRef = collection(db, 'chat_dms');
      const snapshot = await getDocs(dmsRef);
      
      const userDMs: DMThread[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.participants && data.participants.includes(user?.name)) {
          userDMs.push({
            id: doc.id,
            participants: data.participants,
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTime || 0,
            unread: (user?.name && data.unread?.[user.name]) || 0,
          });
        }
      });
      
      // Sort by most recent first
      userDMs.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      // setDMs(userDMs); // Removed - sidebar no longer used
    } catch (err) {
      console.error('Error loading DMs:', err);
    }
  };

  const startOrOpenDM = async (otherUser: any) => {
    try {
      const participants = [user?.name || 'Unknown', otherUser.name].sort();
      
      // Check if DM already exists
      const dmsRef = collection(db, 'chat_dms');
      const snapshot = await getDocs(dmsRef);
      
      let existingDMId: string | null = null;
      snapshot.forEach(doc => {
        const data = doc.data();
        const dmParticipants = (data.participants || []).sort();
        if (JSON.stringify(dmParticipants) === JSON.stringify(participants)) {
          existingDMId = doc.id;
        }
      });
      
      if (existingDMId) {
        // Open existing DM
        setSelectedDM(existingDMId);
        setSelectedDMUser(otherUser);
        setSelectedChannel(null);
        setIsDMMode(true);
        
        // Clear unread count for this user
        setDmUnreadCounts(prev => ({ ...prev, [otherUser.name]: 0 }));
        
        // Mark messages as read in Firestore
        const dmRef = doc(db, 'chat_dms', existingDMId);
        await updateDoc(dmRef, {
          [`unread.${user?.name}`]: 0,
        }).catch(() => {}); // Ignore errors if field doesn't exist
      } else {
        // Create new DM
        const newDMRef = await addDoc(dmsRef, {
          participants,
          lastMessage: '',
          lastMessageTime: Date.now(),
          createdAt: new Date(),
        });
        setSelectedDM(newDMRef.id);
        setSelectedDMUser(otherUser);
        setSelectedChannel(null);
        setIsDMMode(true);
        // Reload DMs to show the new one
        await loadDMs();
      }
      
      setDmSearchQuery('');
    } catch (err) {
      console.error('Error starting DM:', err);
    }
  };

  const getChannelEmoji = (channelName: string, customEmoji?: string): string => {
    if (customEmoji) return customEmoji;
    
    const emojiMap: Record<string, string> = {
      'team': '👥',
      'teamledere': '👔',
      'osl': '🏢',
      'admin': '🔐',
      'allente': '📊',
      'skien': '🏭',
      'krs': '🏝️',
      'general': '💬',
      'random': '🎲',
      'announcements': '📢',
      'sales': '💰',
      'marketing': '📱',
      'support': '🎯',
      'engineering': '🛠️',
    };
    
    const lower = channelName.toLowerCase();
    return emojiMap[lower] || '💬';
  };

  const checkChannelAccess = (type: string, avdeling?: string, allowedUsers?: string[], project?: string): boolean => {
    // If allowedUsers is set, check if user is in the list
    if (allowedUsers && allowedUsers.length > 0) {
      return allowedUsers.includes(user?.name || '') || user?.role === 'owner';
    }
    
    switch (type) {
      case 'project':
        // User can access project channels matching their project
        // Special case: BOTH MUON (owner) and Allente (employees) share the Allente channel
        const userProject = (user as any)?.project;
        const channelProject = project === 'Muon' || project === 'MUON' ? 'Allente' : project;
        
        console.log('🔐 Project access check:', {
          userProject,
          channelProject,
          userRole: user?.role,
          isAllenteChannel: channelProject === 'Allente',
          match: userProject === channelProject || (channelProject === 'Allente' && (userProject === 'MUON' || userProject === 'Allente')) || user?.role === 'owner'
        });
        
        // Allente channel is shared: BOTH MUON (owner) and Allente (employees) can access
        if (channelProject === 'Allente') {
          return userProject === 'MUON' || userProject === 'Allente' || user?.role === 'owner';
        }
        
        // Other projects: match user project
        return userProject === channelProject || user?.role === 'owner';
      case 'team':
        return user?.role === 'teamleder' || user?.role === 'owner';
      case 'admin':
        return user?.role === 'owner';
      case 'avdeling':
        return (user as any)?.department === avdeling || user?.role === 'owner';
      case 'global':
        return true;
      default:
        return false;
    }
  };

  const loadChannelMessages = async (channelId: string) => {
    try {
      const channelInfo = channels.find(c => c.id === channelId);
      console.log('📨 LOADING MESSAGES', {
        user: user?.name,
        channelId,
        channelName: channelInfo?.name,
        userProject: user?.project,
        channelProject: channelInfo?.project
      });
      const messagesRef = collection(db, 'chat_channels', channelId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach(doc => {
          msgs.push({
            id: doc.id,
            ...doc.data() as any,
          });
        });
        console.log('📦 Loaded', msgs.length, 'messages from channel', channelId, 'for user', user?.name);
        if (msgs.length > 0) {
          console.log('📋 MESSAGE SENDERS IN CHANNEL:', msgs.map(m => ({ sender: m.sender, content: m.content.substring(0, 30), time: m.timestamp })));
          console.log('First message:', msgs[0]);
          console.log('Last message:', msgs[msgs.length - 1]);
        }
        setMessages(msgs);
      });
      
      // Store unsubscribe in ref for cleanup
      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.error('❌ Error loading channel messages:', err);
    }
  };

  const loadDMMessages = async (dmId: string) => {
    try {
      const messagesRef = collection(db, 'chat_dms', dmId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach(doc => {
          msgs.push({
            id: doc.id,
            ...doc.data() as any,
          });
        });
        setMessages(msgs);
      });
      
      // Store unsubscribe in ref for cleanup
      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.error('Error loading DM messages:', err);
    }
  };

  const sendMessage = async (content?: string) => {
    let messageContent = content || newMessage;
    // Expand emoji commands (e.g., :bell: → 🔔)
    messageContent = expandEmojiCommands(messageContent);
    console.log('📤 Send clicked! Message:', messageContent, 'Channel:', selectedChannel);
    if (!messageContent.trim()) return;
    
    // Calculate deleteAt timestamp (90 days from now)
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const deleteAtDate = new Date(Date.now() + ninetyDaysMs);
    
    try {
      if (selectedChannel) {
        // Find channel name for debugging
        const channelName = channels.find(c => c.id === selectedChannel)?.name;
        const channelData = channels.find(c => c.id === selectedChannel);
        console.log('📝 SENDING MESSAGE', {
          sender: user?.name,
          selectedChannel,
          channelName,
          channelId: selectedChannel,
          project: user?.project,
          fullChannelData: channelData
        });
        const messagesRef = collection(db, 'chat_channels', selectedChannel, 'messages');
        const msgData: any = {
          sender: user?.name || 'Unknown',
          content: messageContent,
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
        };
        
        console.log('💾 ACTUAL MESSAGE DATA BEING SAVED:', {
          sender: msgData.sender,
          content: msgData.content,
          currentUserName: user?.name,
          currentUserEmail: user?.email,
          currentUser: user
        });
        if (replyingTo) {
          msgData.replyTo = {
            id: replyingTo.id,
            sender: replyingTo.sender,
            content: replyingTo.content,
          };
        }
        await addDoc(messagesRef, msgData);
        console.log('✅ Message sent successfully! Will auto-delete on:', deleteAtDate.toLocaleDateString());
      } else if (selectedDM) {
        console.log('📝 Sending to DM:', selectedDM);
        const messagesRef = collection(db, 'chat_dms', selectedDM, 'messages');
        const msgData: any = {
          sender: user?.name || 'Unknown',
          content: messageContent,
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
        };
        if (replyingTo) {
          msgData.replyTo = {
            id: replyingTo.id,
            sender: replyingTo.sender,
            content: replyingTo.content,
          };
        }
        await addDoc(messagesRef, msgData);
        
        // Update DM thread with last message + increment unread for other participant
        const dmRef = doc(db, 'chat_dms', selectedDM);
        const dmData = await getDoc(dmRef);
        const currentUnread = dmData.data()?.unread || {};
        
        // Find the other participant
        const otherParticipant = selectedDMUser?.name;
        const newUnreadCount = (currentUnread[otherParticipant] || 0) + 1;
        
        await updateDoc(dmRef, {
          lastMessage: messageContent,
          lastMessageTime: Date.now(),
          [`unread.${otherParticipant}`]: newUnreadCount,
        });
        
        // Reload allUsers to re-sort DM list (newer DMs float to top)
        await loadAllUsers();
        
        console.log('✅ Message sent successfully! Will auto-delete on:', deleteAtDate.toLocaleDateString());
      }
      
      // Count emoji reactions
      if (messageContent.includes('🔔')) {
        await incrementEmojiCount('🔔');
      }
      if (messageContent.includes('💎')) {
        await incrementEmojiCount('💎');
      }
      
      setNewMessage('');
      setReplyingTo(null);
    } catch (err) {
      console.error('❌ Error sending message:', err);
    }
  };

  const incrementEmojiCount = async (emoji: string) => {
    try {
      const senderExternal = user?.name || 'Unknown';
      const emojiCountsRef = doc(db, 'emoji_counts', 'chat_reactions');
      
      // Get or create document
      const docSnap = await getDoc(emojiCountsRef);
      if (docSnap.exists()) {
        const currentCount = docSnap.data()?.[senderExternal]?.[emoji] || 0;
        await updateDoc(emojiCountsRef, {
          [`${senderExternal}.${emoji}`]: currentCount + 1,
          [`${senderExternal}.lastUpdated`]: Date.now(),
        });
      } else {
        await setDoc(emojiCountsRef, {
          [senderExternal]: {
            [emoji]: 1,
            lastUpdated: Date.now(),
          }
        });
      }
      console.log(`✅ Emoji ${emoji} counted for ${senderExternal}`);
    } catch (err) {
      console.error(`❌ Error counting emoji ${emoji}:`, err);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifs([]);
      return;
    }
    
    try {
      const GIPHY_API_KEY = 'rocNGj67aZ4GXyTkBiLKHDgso3j4EQ3c';
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=12&offset=0&rating=g&lang=en`
      );
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        setGifs(data.data);
        console.log('✅ Giphy search found -', data.data.length, 'GIFs');
      } else {
        setGifs([]);
      }
    } catch (error) {
      console.error('❌ Giphy search error:', error);
      setGifs([]);
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      if (selectedChannel) {
        const msgRef = doc(db, 'chat_channels', selectedChannel, 'messages', messageId);
        const updateData: any = {};
        updateData[`reactions.${emoji}`] = arrayUnion(user?.name || 'Unknown');
        await updateDoc(msgRef, updateData);
      } else if (selectedDM) {
        const msgRef = doc(db, 'chat_dms', selectedDM, 'messages', messageId);
        const updateData: any = {};
        updateData[`reactions.${emoji}`] = arrayUnion(user?.name || 'Unknown');
        await updateDoc(msgRef, updateData);
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  const pinMessage = async (messageId: string, message: Message) => {
    try {
      if (selectedChannel) {
        const channelRef = doc(db, 'chat_channels', selectedChannel);
        await updateDoc(channelRef, {
          pinnedMessageId: messageId,
        });
        setPinnedMessage(message);
      } else if (selectedDM) {
        const dmRef = doc(db, 'chat_dms', selectedDM);
        await updateDoc(dmRef, {
          pinnedMessageId: messageId,
        });
        setPinnedMessage(message);
      }
    } catch (err) {
      console.error('Error pinning message:', err);
    }
  };

  const unpinMessage = async () => {
    try {
      if (selectedChannel) {
        const channelRef = doc(db, 'chat_channels', selectedChannel);
        await updateDoc(channelRef, {
          pinnedMessageId: null,
        });
      } else if (selectedDM) {
        const dmRef = doc(db, 'chat_dms', selectedDM);
        await updateDoc(dmRef, {
          pinnedMessageId: null,
        });
      }
      setPinnedMessage(null);
    } catch (err) {
      console.error('Error unpinning message:', err);
    }
  };

  const deleteMessage = async (messageId: string) => {
    // Only owner can delete
    if (user?.role !== 'owner') {
      alert('Only owners can delete messages');
      return;
    }
    
    try {
      if (selectedChannel) {
        const msgRef = doc(db, 'chat_channels', selectedChannel, 'messages', messageId);
        await updateDoc(msgRef, {
          content: '[Deleted]',
          isDeleted: true,
        });
      } else if (selectedDM) {
        const msgRef = doc(db, 'chat_dms', selectedDM, 'messages', messageId);
        await updateDoc(msgRef, {
          content: '[Deleted]',
          isDeleted: true,
        });
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!newContent.trim()) {
      alert('Message cannot be empty');
      return;
    }

    try {
      if (selectedChannel) {
        const msgRef = doc(db, 'chat_channels', selectedChannel, 'messages', messageId);
        await updateDoc(msgRef, {
          content: newContent,
          editedAt: new Date().getTime(),
        });
      } else if (selectedDM) {
        const msgRef = doc(db, 'chat_dms', selectedDM, 'messages', messageId);
        await updateDoc(msgRef, {
          content: newContent,
          editedAt: new Date().getTime(),
        });
      }
      setEditingMessageId(null);
      setEditingMessageContent('');
    } catch (err) {
      console.error('Error editing message:', err);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      broadcastTyping(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      broadcastTyping(false);
    }, 3000);
  };

  const broadcastTyping = async (isTyping: boolean) => {
    try {
      if (selectedChannel) {
        const typingRef = doc(db, 'chat_channels', selectedChannel, 'typing_status', user?.name || 'Unknown');
        if (isTyping) {
          await updateDoc(typingRef, {
            user: user?.name || 'Unknown',
            timestamp: Date.now(),
          }).catch(() => {
            // Document doesn't exist, will be created on read
          });
        }
      }
    } catch (err) {
      // Silently fail - typing indicators are nice to have
    }
  };

  // Listen for typing status in channel
  useEffect(() => {
    if (!selectedChannel) return;
    
    const typingRef = collection(db, 'chat_channels', selectedChannel, 'typing_status');
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const typing: string[] = [];
      const now = Date.now();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Only show typing if timestamp is recent (within 3 seconds)
        if (now - data.timestamp < 3000 && data.user !== user?.name) {
          typing.push(data.user);
        }
      });
      
      setTypingUsers(typing);
    });
    
    return () => unsubscribe();
  }, [selectedChannel, user]);

  // Mark messages as seen
  const markMessageSeen = async (messageId: string) => {
    try {
      if (selectedChannel) {
        const msgRef = doc(db, 'chat_channels', selectedChannel, 'messages', messageId);
        await updateDoc(msgRef, {
          seenBy: arrayUnion(user?.name || 'Unknown'),
        }).catch(() => {
          // Silently fail if document doesn't exist yet
        });
      } else if (selectedDM) {
        const msgRef = doc(db, 'chat_dms', selectedDM, 'messages', messageId);
        await updateDoc(msgRef, {
          seenBy: arrayUnion(user?.name || 'Unknown'),
        }).catch(() => {
          // Silently fail if document doesn't exist yet
        });
      }
    } catch (err) {
      // Silently fail - read receipts are nice to have
    }
  };

  // Auto-mark messages as seen when they appear
  useEffect(() => {
    if (messages.length === 0) return;
    
    const timer = setTimeout(() => {
      messages.forEach(msg => {
        if (msg.sender !== user?.name && !msg.seenBy?.includes(user?.name || 'Unknown')) {
          markMessageSeen(msg.id);
        }
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [messages, user, selectedChannel, selectedDM]);

  // Filter messages by search query and remove deleted messages
  useEffect(() => {
    let filtered = messages.filter(msg => !msg.isDeleted); // Remove deleted messages
    
    if (!searchQuery.trim()) {
      setFilteredMessages(filtered);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(msg => 
      msg.content.toLowerCase().includes(query) ||
      msg.sender.toLowerCase().includes(query)
    );
    
    setFilteredMessages(filtered);
  }, [messages, searchQuery]);

  const insertGif = (gif: any) => {
    const gifUrl = gif.images.fixed_height.url;
    insertGifAsAttachment(gifUrl);
    setIsPickingGif(false);
    setGifSearch('');
    setGifs([]);
  };

  const insertGifAsAttachment = async (gifUrl: string) => {
    // Calculate deleteAt timestamp (90 days from now)
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const deleteAtDate = new Date(Date.now() + ninetyDaysMs);
    
    try {
      if (selectedChannel) {
        const messagesRef = collection(db, 'chat_channels', selectedChannel, 'messages');
        await addDoc(messagesRef, {
          sender: user?.name || 'Unknown',
          content: '🎬 Shared a GIF',
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
          attachments: [
            {
              type: 'gif',
              url: gifUrl,
            }
          ],
        });
      } else if (selectedDM) {
        const messagesRef = collection(db, 'chat_dms', selectedDM, 'messages');
        await addDoc(messagesRef, {
          sender: user?.name || 'Unknown',
          content: '🎬 Shared a GIF',
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
          attachments: [
            {
              type: 'gif',
              url: gifUrl,
            }
          ],
        });
      }
    } catch (err) {
      console.error('Error inserting GIF:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // For demo, just add file name as message
    sendMessage(`📎 File: ${file.name}`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="chat-container">
      {/* Channel Creation Modal */}
      <ChannelModal 
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        onChannelCreated={() => loadChannels()}
        allUsers={allUsers}
      />

      {isDMMode ? (
        // DM MODE - SPLIT VIEW
        <div style={{ display: 'flex', height: '100%', gap: '0', position: 'relative' }}>
          {/* LEFT SIDEBAR - DM List */}
          <div style={{
            width: '300px',
            background: '#f8f9fa',
            borderRight: '1px solid #ddd',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem' }}>Start Direct Message</h3>
              <input
                type="text"
                placeholder="Search..."
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  fontSize: '0.9rem',
                }}
              />
            </div>
            
            {/* DM List */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
              {allUsers
                .filter(u => u.name !== user?.name && u.name.toLowerCase().includes(dmSearchQuery.toLowerCase()))
                .map(u => (
                  <button
                    key={u.name}
                    onClick={() => {
                      startOrOpenDM(u);
                      // Clear unread for this user
                      setDmUnreadCounts(prev => ({ ...prev, [u.name]: 0 }));
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: selectedDMUser?.name === u.name ? '#667eea' : '#fff',
                      color: selectedDMUser?.name === u.name ? '#fff' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: '0.5rem',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      position: 'relative',
                    }}
                    onMouseOver={(e) => {
                      if (selectedDMUser?.name !== u.name) {
                        e.currentTarget.style.background = '#eee';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedDMUser?.name !== u.name) {
                        e.currentTarget.style.background = '#fff';
                      }
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#667eea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      flexShrink: 0,
                    }}>
                      {u.name?.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name}
                      </strong>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.role} • {u.department || 'N/A'}
                      </div>
                    </div>

                    {/* Unread Badge */}
                    {(dmUnreadCounts[u.name] || 0) > 0 && (
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#dc2626',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}>
                        {dmUnreadCounts[u.name]}
                      </div>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* RIGHT SIDE - Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', position: 'relative' }}>
            {selectedDMUser ? (
              <>
                {/* DM Header */}
                <div style={{
                  padding: '1rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  borderBottom: '1px solid #e2e8f0',
                }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{selectedDMUser.name}</h2>
                  <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.25rem' }}>
                    {selectedDMUser.role} • {selectedDMUser.department || 'N/A'}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', paddingBottom: '100px' }}>
                  {filteredMessages.map((msg, idx) => (
                    <div key={idx} style={{
                      marginBottom: '1rem',
                      display: 'flex',
                      justifyContent: msg.sender === user?.name ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '70%',
                        padding: '0.75rem 1rem',
                        background: msg.sender === user?.name ? '#667eea' : '#f0f0f0',
                        color: msg.sender === user?.name ? '#fff' : '#333',
                        borderRadius: '8px',
                        wordBreak: 'break-word',
                      }}>
                        <strong style={{ fontSize: '0.9rem' }}>{msg.sender}</strong>
                        <div style={{ marginTop: '0.25rem' }}>{msg.content}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input - Fixed to bottom */}
                <div style={{ position: 'absolute', bottom: 0, left: 300, right: 0, padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', background: '#fff', zIndex: 10 }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newMessage.trim()) {
                        sendMessage();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                    }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#667eea',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '1.1rem',
              }}>
                Choose someone to chat with
              </div>
            )}
          </div>
        </div>
      ) : (
        // CHANNEL MODE - Normal layout
        <div className="chat-content">


        {/* Message Area */}
        <div className="chat-main">
          {selectedChannel || selectedDM ? (
            <>
              {/* Channel Header */}
              {selectedChannel && channels.find(c => c.id === selectedChannel) && (
                <div style={{
                  padding: '1rem 1.5rem',
                  background: selectedChannel === 'project-allente' ? '#0f2438' : '#667eea',
                  color: 'white',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {selectedChannel === 'project-allente' ? (
                    <img 
                      src="https://www.antennhakan.se/wp-content/uploads/2024/01/allente-logo2.png"
                      alt="Allente"
                      style={{
                        height: '50px',
                        maxWidth: '95%',
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <h2 style={{
                      margin: 0,
                      fontSize: selectedChannel === 'global' ? '2.5rem' : '2.2rem',
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                      fontFamily: 'Arial, sans-serif',
                      textRendering: 'optimizeLegibility',
                      WebkitFontSmoothing: 'antialiased',
                    }}>
                      {(() => {
                        if (selectedChannel === 'global') return 'muon';
                        const channel = channels.find(c => c.id === selectedChannel);
                        return channel?.emoji || '💬';
                      })()}
                    </h2>
                  )}
                </div>
              )}

              {/* Pinned Message */}
              {pinnedMessage && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#fff9e6',
                  borderBottom: '2px solid #ffd700',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      📌 Pinned: {pinnedMessage.sender}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#333' }}>
                      {pinnedMessage.content.substring(0, 60)}...
                    </div>
                  </div>
                  <button
                    onClick={() => unpinMessage()}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      color: '#999'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Search field */}
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  borderBottom: '1px solid #e2e8f0',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  color: '#fff',
                  background: '#2d3748',
                }}
              />

              {/* Messages */}
              <div className="messages-area" ref={messagesAreaRef}>
                {getMessagesGroupedByDate(filteredMessages).map((group, groupIdx) => (
                  <div key={groupIdx}>
                    {/* Date Separator - Slack Style Button */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      margin: '1.5rem 0 1rem',
                    }}>
                      <button style={{
                        padding: '0.5rem 1rem',
                        background: 'transparent',
                        border: '1px solid #666',
                        borderRadius: '20px',
                        color: '#999',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#333';
                        e.currentTarget.style.borderColor = '#999';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = '#666';
                      }}
                      >
                        {group.date}
                      </button>
                    </div>

                    {/* Messages for this date - grouped by sender */}
                    {group.messages.map((msg, msgIdx) => {
                      const isFirstFromSender = msgIdx === 0 || group.messages[msgIdx - 1].sender !== msg.sender;
                      return (
                        <div 
                          key={msg.id} 
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          style={{
                            display: 'flex',
                            gap: '0.75rem',
                            marginBottom: isFirstFromSender ? '1rem' : '0.25rem',
                            paddingLeft: '0.5rem',
                            paddingRight: '0.5rem',
                            paddingTop: '0.25rem',
                            paddingBottom: '0.25rem',
                            borderRadius: '4px',
                            transition: 'background 0.15s',
                            background: hoveredMessageId === msg.id ? '#2a2a2a' : 'transparent'
                          }}
                        >
                          {/* Message content */}
                          <div style={{ flex: 1 }}>
                            {/* Header: Name + Time (only on first message from sender) */}
                            {isFirstFromSender && (
                              <div style={{
                                display: 'flex',
                                gap: '0.5rem',
                                marginBottom: '0.25rem',
                                alignItems: 'center'
                              }}>
                                <strong style={{ fontSize: '0.95rem', color: '#fff' }}>
                                  {msg.sender}
                                </strong>
                                <span style={{ fontSize: '0.8rem', color: '#999' }}>
                                  {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}

                            {/* Reply context */}
                            {msg.replyTo && (
                              <div className="reply-context">
                                <span className="reply-sender">{msg.replyTo.sender}</span>
                                <span className="reply-content">{msg.replyTo.content.substring(0, 50)}...</span>
                              </div>
                            )}
                    {editingMessageId === msg.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={editingMessageContent}
                          onChange={(e) => setEditingMessageContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              editMessage(msg.id, editingMessageContent);
                            } else if (e.key === 'Escape') {
                              setEditingMessageId(null);
                              setEditingMessageContent('');
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'rgba(102, 126, 234, 0.2)',
                            border: '1px solid #667eea',
                            borderRadius: '4px',
                            color: '#fff',
                            fontFamily: 'inherit',
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => editMessage(msg.id, editingMessageContent)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#667eea',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditingMessageContent('');
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#555',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="message-header">
                        <span className="message-sender">
                          {topDepartment && employeeMapByName[msg.sender]?.department === topDepartment ? '👑' : ''}
                          {msg.sender}
                          {topDepartment && employeeMapByName[msg.sender]?.department === topDepartment ? '👑' : ''}
                        </span>
                        <span className="message-content" style={{
                          color: msg.isDeleted ? '#999' : '#333',
                          fontStyle: msg.isDeleted ? 'italic' : 'normal',
                          opacity: msg.isDeleted ? 0.7 : 1,
                        }}>
                          {msg.content}
                        </span>
                        {msg.editedAt && (
                          <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: '0.5rem' }}>
                            (edited)
                          </span>
                        )}
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="message-attachments">
                        {msg.attachments.map((att, idx) => (
                          <div key={idx} className="attachment">
                            {att.type === 'gif' && <img src={att.url} alt="GIF" />}
                            {att.type === 'file' && <span>📎 {att.name}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.seenBy && msg.seenBy.length > 0 && msg.sender === user?.name && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#999', 
                        marginTop: '0.25rem'
                      }}>
                        ✔️ Seen by {msg.seenBy.length} {msg.seenBy.length === 1 ? 'person' : 'people'}
                      </div>
                    )}
                    {hoveredMessageId === msg.id && (
                      <div className="message-actions" style={{
                        display: 'flex',
                        gap: '0.25rem',
                        alignItems: 'center'
                      }}>
                        <button 
                          className="reply-button"
                          onClick={() => setReplyingTo(msg)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            transition: 'background 0.15s',
                            color: '#999'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#333333'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          ↩️ Reply
                        </button>
                        <button 
                          className="reply-button"
                          onClick={() => pinMessage(msg.id, msg)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            transition: 'background 0.15s',
                            color: '#999'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#333333'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          📌 Pin
                        </button>
                        {['👍', '❤️', '😂', '🔥', '👏'].map(emoji => (
                          <button 
                            key={emoji}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'background 0.15s',
                            }}
                            onClick={() => addReaction(msg.id, emoji)}
                            onMouseOver={(e) => e.currentTarget.style.background = '#333333'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button 
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            transition: 'background 0.15s',
                            color: '#999'
                          }}
                          onClick={() => {
                            setEmojiPickerMessageId(msg.id);
                            setEmojiPickerOpen(true);
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#333333'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          ➕
                        </button>
                        {msg.sender === user?.name && !msg.isDeleted && (
                          <button
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditingMessageContent(msg.content);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'background 0.15s',
                              color: '#667eea'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#333333'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            ✏️ Edit
                          </button>
                        )}
                        {user?.role === 'owner' && !msg.isDeleted && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this message?')) {
                                deleteMessage(msg.id);
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'background 0.15s',
                              color: '#ff4757'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#333333'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    )}
                    {msg.reactions && (
                      <div className="message-reactions">
                        {Object.entries(msg.reactions).slice(0, 4).map(([emoji, users]) => (
                          <button key={emoji} className="reaction-count">
                            {emoji} {users.length}
                          </button>
                        ))}
                        {Object.entries(msg.reactions).length > 4 && (
                          <button className="reaction-count" onClick={() => {
                            console.log('Show more reactions');
                          }}>
                            + {Object.entries(msg.reactions).length - 4}
                          </button>
                        )}
                      </div>
                    )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                
                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div style={{ 
                    padding: '0.5rem 1rem', 
                    color: '#999', 
                    fontSize: '0.85rem',
                    fontStyle: 'italic'
                  }}>
                    {typingUsers.length === 1 
                      ? `${typingUsers[0]} is typing...` 
                      : `${typingUsers.join(', ')} are typing...`}
                  </div>
                )}
                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} style={{ height: 0 }} />
              </div>

              {/* Reply Context */}
              {replyingTo && (
                <div className="reply-preview">
                  <span>Replying to <strong>{replyingTo.sender}</strong></span>
                  <button onClick={() => setReplyingTo(null)}>✕</button>
                </div>
              )}

              {/* GIF Picker */}
              {isPickingGif && (
                <div className="gif-picker">
                  <input
                    type="text"
                    placeholder="Search GIFs..."
                    value={gifSearch}
                    onChange={(e) => {
                      setGifSearch(e.target.value);
                      searchGifs(e.target.value);
                    }}
                    className="gif-search-input"
                  />
                  <div className="gif-grid">
                    {gifs.map((gif) => (
                      <img
                        key={gif.id}
                        src={gif.images.fixed_height.url}
                        alt="GIF"
                        onClick={() => insertGif(gif)}
                        className="gif-thumbnail"
                      />
                    ))}
                  </div>
                  <button 
                    onClick={() => setIsPickingGif(false)}
                    className="close-gif-picker"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Input */}
              {/* Input area */}
              <div className="message-input-area">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                
                {/* Emoji Action Buttons - File & GIF + Allente quick emojis */}
                <div className="emoji-action-buttons">
                  {/* File Upload - Binder Icon */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="emoji-action-btn"
                    title="Upload file"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      opacity: 0.6
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" strokeWidth="1.5">
                      <path d="M12 2L12 22M5 5L5 19C5 20.1 5.9 21 7 21L17 21C18.1 21 19 20.1 19 19L19 5" />
                      <path d="M8 5L8 3L16 3L16 5" />
                      <path d="M8 8L16 8" />
                      <path d="M8 12L16 12" />
                      <path d="M8 16L14 16" />
                    </svg>
                  </button>
                  
                  {/* GIF Picker - Text Button */}
                  <button
                    onClick={() => setIsPickingGif(!isPickingGif)}
                    className="emoji-action-btn"
                    title="Pick GIF"
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#a0a0a0',
                      padding: '0.2rem 0.4rem',
                      opacity: 0.6
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                  >
                    GIF
                  </button>
                  
                  {/* Quick Emojis for Allente only */}
                  {selectedChannel === 'project-allente' && (
                    <>
                      <button
                        onClick={() => setNewMessage(newMessage + '🔔')}
                        title="BTV"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          opacity: 0.6,
                          transition: 'opacity 0.2s',
                          padding: '0.2rem 0.25rem',
                          filter: 'grayscale(100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                      >
                        🔔
                      </button>
                      <button
                        onClick={() => setNewMessage(newMessage + '💎')}
                        title="DTH"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          opacity: 0.6,
                          transition: 'opacity 0.2s',
                          padding: '0.2rem 0.25rem',
                          filter: 'grayscale(100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                      >
                        💎
                      </button>
                      <button
                        onClick={() => setNewMessage(newMessage + '🎁')}
                        title="FREE BOX"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          opacity: 0.6,
                          transition: 'opacity 0.2s',
                          padding: '0.2rem 0.25rem',
                          filter: 'grayscale(100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                      >
                        🎁
                      </button>
                    </>
                  )}
                </div>

                <textarea
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Skriv melding... (Shift+Enter for ny linje)"
                  className="message-input"
                />
                <button
                  onClick={() => sendMessage()}
                  className="send-button"
                  disabled={!newMessage.trim()}
                >
                  📤 Send
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              Velg en kanal
            </div>
          )}
        </div>

        {/* Emoji Picker Modal */}
        {emojiPickerOpen && (
          <div className="emoji-picker-modal" onClick={() => setEmojiPickerOpen(false)}>
            <div className="emoji-picker-content" onClick={(e) => e.stopPropagation()}>
              <div className="emoji-picker-header">
                <h2>Add Reaction</h2>
                <button 
                  className="emoji-picker-close"
                  onClick={() => setEmojiPickerOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="emoji-picker-grid">
                {emojiWithCommands.map(({emoji, command}) => (
                  <button
                    key={emoji}
                    className="emoji-picker-item"
                    onClick={() => {
                      if (emojiPickerMessageId) {
                        addReaction(emojiPickerMessageId, emoji);
                      } else {
                        // Insert emoji command into message input
                        setNewMessage(newMessage + `:${command}:`);
                      }
                      setEmojiPickerOpen(false);
                    }}
                    title={`:${command}:`}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{emoji}</div>
                    <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 500 }}>:{command}:</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
