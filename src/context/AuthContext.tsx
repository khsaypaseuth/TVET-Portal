import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, User, LoginResponse } from '../services/api';
import { useNavigate } from 'react-router';
import { storage } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refreshUser = async () => {
    const storedToken = storage.getItem('auth_token');
    if (!storedToken) {
      setUser(null);
      setToken(null);
      return;
    }
    try {
      const res = await apiService.getCurrentUser();
      setUser(res.data);
      setToken(storedToken);
      storage.setItem('user', JSON.stringify(res.data));
    } catch {
      storage.removeItem('auth_token');
      storage.removeItem('user');
      setUser(null);
      setToken(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const storedToken = storage.getItem('auth_token');
        if (storedToken) {
          setToken(storedToken);
          await refreshUser();
        }
      } catch (error) {
        console.error('Error hydrating auth:', error);
        storage.removeItem('auth_token');
        storage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const response: LoginResponse = await apiService.login(username, password);
    if (response.success && response.data) {
      const { token: authToken } = response.data;
      setToken(authToken);
      storage.setItem('auth_token', authToken);
      // hydrate full profile + permissions
      const me = await apiService.getCurrentUser();
      setUser(me.data);
      storage.setItem('user', JSON.stringify(me.data));
      if (me.data.must_change_password) {
        navigate('/change-password');
      } else {
        navigate('/');
      }
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    apiService.logout();
    navigate('/signin');
  };

  const hasPermission = (code: string) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role_code === 'super_admin') return true;
    return !!user.permissions?.includes(code);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        refreshUser,
        hasPermission,
        isAuthenticated: !!user && !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
