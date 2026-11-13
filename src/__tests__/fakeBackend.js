// Backend SIMULADO en memoria que replica el contrato descrito para
// hcm-auth-dev y hcm-attendance-dev. NO es AWS: sirve para probar la lógica del frontend.
//   - La autoridad de tenant/rol es siempre el token (el cliente no puede sobrescribirla).
//   - GET /attendance filtra por el tenantId del token.
//   - DELETE solo para HR/ADMIN (403 en otro caso), 404 si no existe.

const b64url = (obj) =>
  btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export const BACKEND_DATE = "2026-11-12"; // fecha "de negocio" del backend (distinta del UTC actual a propósito)

export function createFakeBackend() {
  const users = [
    { userId: "u-emp-a", email: "emp@a.com", password: "password1", tenantId: "tenant_a", role: "EMPLOYEE", employeeId: "emp-001" },
    { userId: "u-hr-a", email: "hr@a.com", password: "password1", tenantId: "tenant_a", role: "HR", employeeId: "hr-001" },
    { userId: "u-emp-b", email: "emp@b.com", password: "password1", tenantId: "tenant_b", role: "EMPLOYEE", employeeId: "emp-002" },
    { userId: "u-hr-b", email: "hr@b.com", password: "password1", tenantId: "tenant_b", role: "HR", employeeId: "hr-002" },
  ];
  const table = new Map(); // `${tenant}|${emp}|${date}` -> item
  const requests = [];
  const state = { validTokens: new Set(), forceForbiddenDelete: false, expTtlSec: 8 * 3600 };

  const key = (t, e, d) => `${t}|${e}|${d}`;
  const json = (status, body) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  function issueToken(u) {
    const header = b64url({ alg: "HS256", typ: "JWT" });
    const payload = b64url({
      sub: u.userId, email: u.email, tenantId: u.tenantId, role: u.role, employeeId: u.employeeId,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + state.expTtlSec,
    });
    const token = `${header}.${payload}.fake-signature`;
    state.validTokens.add(token);
    return token;
  }

  function authorize(headers) {
    const h = headers.Authorization || headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token || !state.validTokens.has(token)) return null;
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  }

  async function handle(input, init = {}) {
    const url = new URL(String(input));
    const method = init.method || "GET";
    const headers = init.headers || {};
    const body = init.body ? JSON.parse(init.body) : undefined;
    const path = url.pathname.replace(/^\/dev/, "");
    requests.push({ method, path, search: url.search, headers, body, hasBody: init.body !== undefined });

    // ---- Auth (público)
    if (method === "POST" && path === "/auth/login") {
      const u = users.find((x) => x.email === body?.email && x.password === body?.password);
      if (!u) return json(401, { message: "Credenciales inválidas" });
      const { password: _p, ...user } = u;
      return json(200, { token: issueToken(u), expiresIn: "8h", user });
    }
    if (method === "POST" && path === "/auth/register") {
      if (!body?.email || !body?.password || !body?.tenantId || !body?.employeeId)
        return json(400, { message: "Faltan campos" });
      users.push({ userId: `u-${users.length}`, ...body, role: "EMPLOYEE" });
      return json(201, { message: "Usuario creado" });
    }

    // ---- Lambda Authorizer
    const claims = authorize(headers);
    if (!claims) return json(401, { message: "Unauthorized" });
    const isHr = claims.role === "HR" || claims.role === "ADMIN";

    if (method === "GET" && path === "/attendance") {
      const emp = url.searchParams.get("employeeId");
      if (!isHr && emp !== claims.employeeId) return json(403, { message: "No puedes consultar otro empleado" });
      const items = [...table.values()].filter((i) => i.tenantId === claims.tenantId && i.employeeId === emp);
      return json(200, { items, count: items.length, nextToken: null });
    }
    if (method === "POST" && path === "/attendance/clock-in") {
      if (!isHr && body.employeeId !== claims.employeeId) return json(403, { message: "Forbidden" });
      const k = key(claims.tenantId, body.employeeId, BACKEND_DATE);
      if (table.has(k)) return json(409, { message: "Ya existe una marcación abierta para hoy" });
      const item = {
        entityType: "ATTENDANCE", tenantId: claims.tenantId, employeeId: body.employeeId,
        date: BACKEND_DATE, clockIn: new Date().toISOString(), status: "OPEN",
      };
      table.set(k, item);
      return json(201, item);
    }
    if (method === "POST" && path === "/attendance/clock-out") {
      if (!isHr && body.employeeId !== claims.employeeId) return json(403, { message: "Forbidden" });
      const k = key(claims.tenantId, body.employeeId, body.date);
      const item = table.get(k);
      if (!item) return json(404, { message: "Marcación no encontrada" });
      Object.assign(item, { clockOut: new Date().toISOString(), workedMinutes: 2, status: "CLOSED" });
      return json(200, item);
    }
    const del = path.match(/^\/attendance\/([^/]+)\/([^/]+)$/);
    if (method === "DELETE" && del) {
      if (!isHr || state.forceForbiddenDelete) return json(403, { message: "Solo HR o ADMIN pueden eliminar" });
      const k = key(claims.tenantId, decodeURIComponent(del[1]), decodeURIComponent(del[2]));
      if (!table.delete(k)) return json(404, { message: "Marcación no encontrada" });
      return json(200, { message: "Eliminado" });
    }
    if (method === "POST" && path === "/leaves/request") {
      return json(201, { leaveId: "leave-123", status: "PENDING", ...body });
    }
    const appr = path.match(/^\/leaves\/([^/]+)\/approve$/);
    if (method === "POST" && appr) {
      if (!isHr) return json(403, { message: "Solo HR o ADMIN" });
      return json(200, { leaveId: appr[1], status: "APPROVED" });
    }
    return json(404, { message: "Ruta no encontrada" });
  }

  return {
    handle, requests, state,
    seed: (item) => table.set(key(item.tenantId, item.employeeId, item.date), item),
    has: (t, e, d = BACKEND_DATE) => table.has(key(t, e, d)),
    revokeAllTokens: () => state.validTokens.clear(),
  };
}
