import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, attendanceApi, authApi, setUnauthorizedHandler } from "@/services/apiClient";
import { saveSession, clearSession } from "@/lib/session";
import { createFakeBackend } from "./fakeBackend";

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const makeToken = (exp) => `${b64({ alg: "HS256" })}.${b64({ exp })}.sig`;

describe("apiClient", () => {
  let backend;
  beforeEach(() => {
    backend = createFakeBackend();
    vi.stubGlobal("fetch", vi.fn((u, i) => backend.handle(u, i)));
    clearSession();
  });
  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it("usa las URLs de las variables de entorno y no envía Authorization en login", async () => {
    await authApi.post("/auth/login", { email: "emp@a.com", password: "password1" });
    const [url] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://auth.test/dev/auth/login");
    expect(backend.requests[0].headers.Authorization).toBeUndefined();
  });

  it("login inválido (401) muestra el mensaje del backend y NO cierra sesión", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(authApi.post("/auth/login", { email: "x@x.com", password: "bad" })).rejects.toMatchObject({
      status: 401, message: "Credenciales inválidas",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("agrega Authorization: Bearer <JWT> a los endpoints protegidos", async () => {
    const { token, user } = await authApi.post("/auth/login", { email: "emp@a.com", password: "password1" });
    saveSession({ token, user });
    await attendanceApi.get("/attendance", { employeeId: "emp-001" });
    const req = backend.requests.at(-1);
    expect(req.headers.Authorization).toBe(`Bearer ${token}`);
    expect(req.search).toBe("?employeeId=emp-001");
  });

  it("HTTP 401: invoca el handler de cierre de sesión", async () => {
    const { token, user } = await authApi.post("/auth/login", { email: "emp@a.com", password: "password1" });
    saveSession({ token, user });
    backend.revokeAllTokens();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(attendanceApi.get("/attendance", { employeeId: "emp-001" })).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("HTTP 403: mensaje de permisos insuficientes y NO cierra sesión", async () => {
    const { token, user } = await authApi.post("/auth/login", { email: "emp@a.com", password: "password1" });
    saveSession({ token, user });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const err = await attendanceApi.delete("/attendance/emp-001/2026-11-12").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toMatch(/permisos suficientes/i);
    expect(handler).not.toHaveBeenCalled();
  });

  it("detecta JWT expirado ANTES de llamar a la red y cierra sesión", async () => {
    saveSession({ token: makeToken(Math.floor(Date.now() / 1000) - 60), user: { tenantId: "tenant_a", role: "EMPLOYEE" } });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(attendanceApi.get("/attendance", { employeeId: "emp-001" })).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("DELETE no envía body ni Content-Type", async () => {
    const { token, user } = await authApi.post("/auth/login", { email: "hr@a.com", password: "password1" });
    saveSession({ token, user });
    backend.seed({ tenantId: "tenant_a", employeeId: "emp-001", date: "2026-11-12", status: "OPEN" });
    await attendanceApi.delete("/attendance/emp-001/2026-11-12");
    const req = backend.requests.at(-1);
    expect(req.method).toBe("DELETE");
    expect(req.hasBody).toBe(false);
    expect(req.headers["Content-Type"]).toBeUndefined();
  });

  it("error de red produce un mensaje claro (p. ej. CORS)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    const err = await authApi.post("/auth/login", {}).catch((e) => e);
    expect(err.network).toBe(true);
    expect(err.message).toMatch(/CORS/);
  });
});
