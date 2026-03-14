import { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  username?: string;
  password?: string;
  role?: 'owner' | 'teamleder' | 'employee';
  department?: string;
  project?: string;
  stilling?: string;
  externalName?: string;
  tmgName?: string;
  slackName?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (name: string, id: string, role: string, fullEmployee?: any) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Load auth from localStorage on app startup
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        console.log('✅ Auth restored from localStorage:', parsedUser.name);
      } catch (error) {
        console.error('❌ Failed to parse saved auth:', error);
        localStorage.removeItem('user');
      }
    } else {
      console.log('🔐 No saved auth - login required');
    }
  }, []);

  const login = (name: string, id: string, role: string, fullEmployee?: any) => {
    const finalRole = (role as 'owner' | 'teamleder' | 'employee') || 'employee';
    console.log('🔐 LOGIN CONTEXT:', {
      input: { name, id, role },
      final: { role: finalRole },
      hasAccess: finalRole === 'owner' || finalRole === 'teamleder'
    });
    
    const newUser: AuthUser = {
      id,
      name,
      role: finalRole,
      ...(fullEmployee && {
        email: fullEmployee.email,
        username: fullEmployee.username,
        department: fullEmployee.department,
        project: fullEmployee.project,
        stilling: fullEmployee.stilling,
        externalName: fullEmployee.externalName,
        tmgName: fullEmployee.tmgName,
        slackName: fullEmployee.slackName,
      }),
    };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useHasAccess(requiredRole: 'owner' | 'teamleder' | 'employee') {
  const { user } = useAuth();
  if (!user) return false;

  const roleHierarchy: { [key: string]: number } = {
    owner: 3,
    teamleder: 2,
    employee: 1,
  };

  const userRoleLevel = user.role ? roleHierarchy[user.role] : 0;
  return userRoleLevel >= roleHierarchy[requiredRole];
}
