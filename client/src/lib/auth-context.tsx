import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: string;
  teamMembers?: string[] | null;
  modulePermissions?: Record<string, boolean> | null;
  vendorId?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthHeader: () => Record<string, string>;
  refreshUser: () => Promise<void>;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

function getStoredAuth(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function setStoredAuth(token: string | null, user: User | null) {
  if (token && user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const validateToken = useCallback(async () => {
    const stored = getStoredAuth();
    if (!stored.token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${stored.token}` },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setToken(stored.token);
        setStoredAuth(stored.token, userData);
      } else {
        setStoredAuth(null, null);
        setUser(null);
        setToken(null);
      }
    } catch {
      setStoredAuth(null, null);
      setUser(null);
      setToken(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Limpa o modo loja ao fazer login no sistema principal
        localStorage.removeItem("visao_loja_auth");
        setStoredAuth(data.token, data.user);
        setUser(data.user);
        setToken(data.token);
        return { success: true };
      } else {
        return { success: false, error: data.message || "Erro ao fazer login" };
      }
    } catch {
      return { success: false, error: "Erro de conexão" };
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      const data = await response.json();

      if (response.ok) {
        setStoredAuth(data.token, data.user);
        setUser(data.user);
        setToken(data.token);
        return { success: true };
      } else {
        return { success: false, error: data.message || "Erro ao criar conta" };
      }
    } catch {
      return { success: false, error: "Erro de conexão" };
    }
  };

  const logout = () => {
    // 1. Limpar todos os dados de sessão do storage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("visao_loja_auth");
    localStorage.removeItem("dashboard-layout");

    // 2. Limpar cache de dados em memória do react-query
    queryClient.clear();

    // 3. Limpar estado em memória
    setUser(null);
    setToken(null);

    // 4. Forçar navegação para a raiz com replace (remove a rota protegida do histórico)
    //    window.location.replace é essencial: evita que "Voltar" no browser retorne à rota protegida.
    window.location.replace("/");
  };

  const getAuthHeader = (): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const refreshUser = async (): Promise<void> => {
    const stored = getStoredAuth();
    if (!stored.token) return;
    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${stored.token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setStoredAuth(stored.token, userData);
      }
    } catch { }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      getAuthHeader,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
