import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setUnauthorizedHandler } from "@/services/apiClient";
import {
  clearSession,
  getTokenExpiryMs,
  isTokenExpired,
  readSession,
  saveSession,
} from "@/lib/session";

const AuthContext = createContext(null);

const EXPIRED_NOTICE = "Tu sesión expiró. Inicia sesión nuevamente.";

export function AuthProvider({ children }) {
  // La sesión se restaura de sessionStorage (misma pestaña) y se descarta si el JWT expiró.
  const [session, setSession] = useState(() => readSession());
  const [notice, setNotice] = useState("");

  const logout = useCallback((message = "") => {
    clearSession();
    setSession(null);
    setNotice(typeof message === "string" ? message : "");
  }, []);

  // Ante cualquier 401 de una API protegida: cerrar sesión (Protected redirige a /login).
  useEffect(() => {
    setUnauthorizedHandler(() => logout(EXPIRED_NOTICE));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Cierre automático cuando el JWT llega a su `exp`.
  const token = session?.token;
  useEffect(() => {
    if (!token) return undefined;
    const expiresAt = getTokenExpiryMs(token);
    const check = () => {
      if (isTokenExpired(token)) logout(EXPIRED_NOTICE);
    };
    let timer;
    if (expiresAt) {
      // setTimeout no admite retardos > 2^31-1 ms
      timer = setTimeout(check, Math.min(Math.max(expiresAt - Date.now(), 0), 2 ** 31 - 1));
    }
    // Los timers se pausan en pestañas en segundo plano: revisar al volver.
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [token, logout]);

  const login = useCallback(async (email, password) => {
    const data = await authApi.post("/auth/login", { email, password });
    if (!data?.token || !data?.user?.tenantId || !data?.user?.role) {
      throw new Error("Respuesta de login inválida del servidor.");
    }
    // Se usan los datos de usuario que devuelve el backend, sin inventar claims.
    const next = { token: data.token, user: data.user };
    saveSession(next);
    setNotice("");
    setSession(next);
    return data;
  }, []);

  // El registro público solo crea usuarios EMPLOYEE: no se envía `role`.
  const register = useCallback(
    (email, password, tenantId, employeeId) =>
      authApi.post("/auth/register", { email, password, tenantId, employeeId }),
    []
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      notice,
      login,
      register,
      logout,
    }),
    [session, notice, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
