import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UserRole, AuditEntry } from '@/data/types';

interface AuthContextValue {
  user: UserRole | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  auditLog: AuditEntry[];
  addAudit: (action: string, module: string) => void;
}

const DEMO_ACCOUNTS: (UserRole & { password: string })[] = [
  { role: 'Administrator', name: 'Admin User', email: 'admin@aeroindex.gov.in', password: 'admin123' },
  { role: 'Analyst', name: 'Analyst User', email: 'analyst@aeroindex.gov.in', password: 'analyst123' },
  { role: 'Viewer', name: 'Viewer User', email: 'viewer@aeroindex.gov.in', password: 'viewer123' },
];

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'aeroindex-auth';
const AUDIT_KEY = 'aeroindex-audit';

const DEFAULT_USER: UserRole = {
  role: 'Analyst',
  name: 'Analyst User',
  email: 'analyst@aeroindex.gov.in',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRole | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_USER;
  });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const savedAudit = sessionStorage.getItem(AUDIT_KEY);
    if (savedAudit) {
      try {
        setAuditLog(JSON.parse(savedAudit));
      } catch {
        // ignore
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    void password;

    const identity = email.trim() || 'guest';
    const u: UserRole = {
      role: 'Viewer',
      name: identity.split('@')[0] || 'Guest User',
      email: identity,
    };

    setUser(u);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    addAuditInternal(u, 'Login', 'Authentication');
    return true;
  };

  const logout = () => {
    if (user) addAuditInternal(user, 'Logout', 'Authentication');
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const addAuditInternal = (u: UserRole, action: string, module: string) => {
    const entry: AuditEntry = {
      id: `AUD-${Date.now()}`,
      user: u.email,
      action,
      module,
      timestamp: new Date().toISOString(),
    };
    setAuditLog((prev) => {
      const updated = [entry, ...prev].slice(0, 100);
      sessionStorage.setItem(AUDIT_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const addAudit = (action: string, module: string) => {
    if (user) addAuditInternal(user, action, module);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, auditLog, addAudit }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { DEMO_ACCOUNTS };
