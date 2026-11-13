// Única fuente de verdad para las URLs del backend.
// Los valores vienen de variables de entorno de Vite (ver .env.example).
// No hardcodear URLs en componentes ni guardar secretos aquí.

const clean = (value) =>
  typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";

export const config = Object.freeze({
  authApiUrl: clean(import.meta.env.VITE_AUTH_API_URL),
  attendanceApiUrl: clean(import.meta.env.VITE_ATTENDANCE_API_URL),
});

// Tenants que se pueden elegir en el registro público.
export const TENANTS = Object.freeze(["tenant_a", "tenant_b", "tenant_c"]);
