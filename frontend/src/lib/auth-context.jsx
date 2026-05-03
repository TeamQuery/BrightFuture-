'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  bootstrapSession,
  clearAccessToken,
  extractApiError,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  setUnauthorizedHandler,
} from './api';

const AuthContext = createContext(null);

function getStoredUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawUser = localStorage.getItem('user');
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (_error) {
    localStorage.removeItem('user');
    return null;
  }
}

function persistUser(user) {
  if (typeof window === 'undefined') {
    return;
  }

  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
}

function shouldRedirectToLogin() {
  if (typeof window === 'undefined') {
    return false;
  }

  return !['/login', '/register'].includes(window.location.pathname);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resetSession = () => {
      if (!isMounted) {
        return;
      }

      clearAccessToken();
      persistUser(null);
      setUser(null);

      if (shouldRedirectToLogin()) {
        window.location.href = '/login';
      }
    };

    const hydrateSession = async () => {
      const cachedUser = getStoredUser();
      if (cachedUser && isMounted) {
        setUser(cachedUser);
      }

      try {
        const session = await bootstrapSession();
        const nextUser = session.user || (await getMe()).data.user;

        if (!isMounted) {
          return;
        }

        setUser(nextUser);
        persistUser(nextUser);
      } catch (_error) {
        if (isMounted) {
          clearAccessToken();
          persistUser(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setUnauthorizedHandler(resetSession);
    hydrateSession();

    return () => {
      isMounted = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = async (email, password) => {
    const response = await apiLogin(email, password);
    const nextUser = response.data.user;
    setUser(nextUser);
    persistUser(nextUser);
    return nextUser;
  };

  const register = async ({ name, email, password }) => {
    const response = await apiRegister(name, email, password);
    const nextUser = response.data.user;
    setUser(nextUser);
    persistUser(nextUser);
    return nextUser;
  };

  const refreshUser = async () => {
    const response = await getMe();
    const nextUser = response.data.user;
    setUser(nextUser);
    persistUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      clearAccessToken();
      persistUser(null);
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        register,
        getErrorMessage: extractApiError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
