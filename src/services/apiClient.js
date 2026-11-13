import { config } from "@/config/env";
import { getToken, isTokenExpired } from "@/lib/session";

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, network = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.network = network;
  }
}

const SESSION_EXPIRED_MSG =
  "Tu sesión expiró o no es válida. Inicia sesión nuevamente.";
const FORBIDDEN_MSG = "No tienes permisos suficientes para realizar esta operación.";

// AuthContext registra aquí qué hacer ante un 401 (cerrar sesión y volver al login).
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function serverMessage(data) {
  if (!data || typeof data !== "object") return "";
  return data.message || data.error || data.Message || "";
}

function buildMessage(status, data, auth) {
  const msg = serverMessage(data);
  if (status === 401) return auth ? SESSION_EXPIRED_MSG : msg || "Credenciales inválidas";
  if (status === 403) return msg ? `${FORBIDDEN_MSG} (${msg})` : FORBIDDEN_MSG;
  if (status === 404) return msg || "No se encontró el recurso solicitado.";
  return msg || `Error inesperado del servidor (HTTP ${status}).`;
}

async function request(baseUrl, envName, path, { method = "GET", body, params, auth = true, signal } = {}) {
  if (!baseUrl) {
    throw new ApiError(
      `Falta configurar ${envName}. Revisa .env.example o las variables de entorno de Amplify.`
    );
  }

  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
  }

  const headers = { Accept: "application/json" };

  if (auth) {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      unauthorizedHandler?.();
      throw new ApiError(SESSION_EXPIRED_MSG, { status: 401 });
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const init = { method, headers, signal };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(
      "No se pudo conectar con el servidor. Revisa tu conexión y que la API tenga CORS habilitado para este dominio.",
      { network: true }
    );
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) unauthorizedHandler?.();
    throw new ApiError(buildMessage(res.status, data, auth), { status: res.status, data });
  }
  return data;
}

// APIs públicas (login / registro): sin Authorization y sin cierre de sesión por 401.
export const authApi = {
  post: (path, body) =>
    request(config.authApiUrl, "VITE_AUTH_API_URL", path, { method: "POST", body, auth: false }),
};

// APIs protegidas: agregan automáticamente `Authorization: Bearer <JWT>`.
const protectedApi = (baseUrl, envName) => ({
  get: (path, params, signal) => request(baseUrl, envName, path, { params, signal }),
  post: (path, body) => request(baseUrl, envName, path, { method: "POST", body }),
  delete: (path) => request(baseUrl, envName, path, { method: "DELETE" }),
});

export const attendanceApi = protectedApi(config.attendanceApiUrl, "VITE_ATTENDANCE_API_URL");
