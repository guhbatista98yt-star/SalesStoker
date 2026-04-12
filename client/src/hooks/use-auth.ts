import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
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

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    const { token, user } = getStoredAuth();
    return { user, token, isLoading: !!token };
  });

  const validateToken = useCallback(async () => {
    const { token } = getStoredAuth();
    if (!token) {
      setState({ user: null, token: null, isLoading: false });
      return;
    }

    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const user = await response.json();
        setStoredAuth(token, user);
        setState({ user, token, isLoading: false });
      } else {
        setStoredAuth(null, null);
        setState({ user: null, token: null, isLoading: false });
      }
    } catch {
      setStoredAuth(null, null);
      setState({ user: null, token: null, isLoading: false });
    }
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
        setStoredAuth(data.token, data.user);
        setState({ user: data.user, token: data.token, isLoading: false });
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
        setState({ user: data.user, token: data.token, isLoading: false });
        return { success: true };
      } else {
        return { success: false, error: data.message || "Erro ao criar conta" };
      }
    } catch {
      return { success: false, error: "Erro de conexão" };
    }
  };

  const logout = () => {
    setStoredAuth(null, null);
    setState({ user: null, token: null, isLoading: false });
  };

  const getAuthHeader = (): Record<string, string> => {
    return state.token ? { Authorization: `Bearer ${state.token}` } : {};
  };

  return {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user,
    login,
    register,
    logout,
    getAuthHeader,
  };
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
