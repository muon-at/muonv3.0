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
    // Force logout on mount - must login with credentials every time
    // (for development/testing with multiple users)
    localStorage.removeItem('user');
    localStorage.removeItem('auth');
    setUser(null);
    console.log('🔐 Fresh start - login required');
  }, []);

  const login = (name: string, id: string, role: string, fullEmployee?: any) => {
    const newUser: AuthUser = {
      id,
      name,
      role: (role as 'owner' | 'teamleder' | 'employee') || 'employee',
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
