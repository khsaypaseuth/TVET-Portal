import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, LoginResponse } from '../services/api';
import { useNavigate } from 'react-router';
import { storage } from '../utils/storage';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for stored auth data on mount
    try {
      const storedToken = storage.getItem('auth_token');
      const storedUser = storage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      // Clear corrupted data
      storage.removeItem('auth_token');
      storage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response: LoginResponse = await apiService.login(username, password);
      
      if (response.success && response.data) {
        const { user: userData, token: authToken } = response.data;
        
        setUser(userData);
        setToken(authToken);
        
        // Clear old auth data first to free up space
        storage.removeItem('auth_token');
        storage.removeItem('user');
        
        // Store new auth data with error handling
        const tokenStored = storage.setItem('auth_token', authToken);
        const userStored = storage.setItem('user', JSON.stringify(userData));
        
        if (!tokenStored || !userStored) {
          console.warn('Warning: Could not store auth data in localStorage. Session will not persist.');
          // User is still logged in, just won't persist across page reloads
        }
        
        // Redirect to dashboard
        navigate('/');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    apiService.logout();
    navigate('/signin');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
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

