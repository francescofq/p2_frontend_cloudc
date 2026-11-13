import { jwtDecode } from "jwt-decode";

// El token vive en sessionStorage: se mantiene al recargar la pestaña
// y desaparece al cerrarla. Nunca se guardan contraseñas.
const STORAGE_KEY = "hcm_auth";

function decodeClaims(token) {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

// true si el JWT está mal formado o su claim `exp` ya pasó.
// Si el token no trae `exp`, no se asume expiración (lo decidirá el backend con un 401).
export function isTokenExpired(token, skewMs = 0) {
  const claims = decodeClaims(token);
  if (!claims) return true;
  if (typeof claims.exp !== "number") return false;
  return claims.exp * 1000 - skewMs <= Date.now();
}

export function getTokenExpiryMs(token) {
  const claims = decodeClaims(token);
  return typeof claims?.exp === "number" ? claims.exp * 1000 : null;
}

export function readSession() {
  try {
    // Limpieza: versiones anteriores guardaban el token en localStorage.
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token, user } = JSON.parse(raw);
    if (!token || !user || isTokenExpired(token)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { token, user };
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
}

export function getToken() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).token ?? null : null;
  } catch {
    return null;
  }
}
