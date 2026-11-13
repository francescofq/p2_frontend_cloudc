import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { BACKEND_DATE, createFakeBackend } from "./fakeBackend";

let backend;
let user;

beforeEach(() => {
  backend = createFakeBackend();
  vi.stubGlobal("fetch", vi.fn((u, i) => backend.handle(u, i)));
  sessionStorage.clear();
  localStorage.clear();
  window.history.pushState({}, "", "/login");
  user = userEvent.setup();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function login(email, password = "password1") {
  await user.type(await screen.findByLabelText("Correo electrónico"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByRole("heading", { level: 1, name: "Dashboard" });
}
const goAttendance = async () => {
  await user.click(screen.getByRole("link", { name: "Asistencia" }));
  await screen.findByRole("heading", { level: 1, name: "Asistencia" });
};
const logout = async () => {
  await user.click(screen.getByRole("button", { name: /Cerrar sesión/ }));
  await screen.findByRole("button", { name: "Ingresar" });
};
const consult = async (employeeId) => {
  const input = screen.getByLabelText("Employee ID", { selector: "#att-employee" });
  await user.clear(input);
  await user.type(input, employeeId);
  await user.click(screen.getByRole("button", { name: "Consultar" }));
};

describe("flujo funcional (contra backend SIMULADO)", () => {
  it("pasos 1-9: EMPLOYEE hace clock-in/out, HR elimina y la marcación desaparece", async () => {
    render(<App />);

    // 1. Login EMPLOYEE tenant_a (token en sessionStorage, nunca en localStorage)
    await login("emp@a.com");
    expect(sessionStorage.getItem("hcm_auth")).toContain("token");
    expect(localStorage.getItem("hcm_auth")).toBeNull();
    expect(screen.getAllByText("tenant_a").length).toBeGreaterThan(0);

    // 2-3. Clock-in y ver el registro
    await goAttendance();
    expect(await screen.findByText(/No hay marcaciones registradas/)).not.toBeNull();
    // EMPLOYEE: sin campo para elegir employeeId
    expect(screen.queryByLabelText("Employee ID", { selector: "#att-employee" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Registrar entrada" }));
    const table = await screen.findByRole("table");
    expect(within(table).getByText(BACKEND_DATE)).not.toBeNull();
    expect(within(table).getByText("OPEN")).not.toBeNull();
    // EMPLOYEE nunca ve "Eliminar"
    expect(screen.queryByRole("button", { name: /Eliminar/ })).toBeNull();

    // 4. Clock-out usando la `date` EXACTA del backend (no la del timestamp UTC)
    await user.click(within(table).getByRole("button", { name: "Registrar salida" }));
    await within(table).findByText("CLOSED");
    const out = backend.requests.find((r) => r.path === "/attendance/clock-out");
    expect(out.body).toEqual({ employeeId: "emp-001", date: BACKEND_DATE });
    expect(within(table).getByText("2 min")).not.toBeNull();

    // 5. Logout
    await logout();
    expect(sessionStorage.getItem("hcm_auth")).toBeNull();

    // 6-7. HR de tenant_a elimina (con confirmación)
    await login("hr@a.com");
    await goAttendance();
    await consult("emp-001");
    const hrTable = await screen.findByRole("table");
    await user.click(within(hrTable).getByRole("button", { name: /Eliminar/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("¿Eliminar marcación?")).not.toBeNull();
    expect(backend.has("tenant_a", "emp-001")).toBe(true); // aún no se borró: falta confirmar
    await user.click(within(dialog).getByRole("button", { name: /Eliminar/ }));

    // 8. Ya no aparece (y se borró de verdad en el backend)
    await screen.findByText(/No hay marcaciones registradas para emp-001/);
    expect(backend.has("tenant_a", "emp-001")).toBe(false);
    const del = backend.requests.find((r) => r.method === "DELETE");
    expect(del.path).toBe(`/attendance/emp-001/${BACKEND_DATE}`);
    expect(del.hasBody).toBe(false);
    expect(del.headers.Authorization).toMatch(/^Bearer /);

    // 9. Logout
    await logout();
  });

  it("pasos 10-11: aislamiento multi-tenant y limpieza de datos entre sesiones", async () => {
    backend.seed({ tenantId: "tenant_a", employeeId: "emp-001", date: BACKEND_DATE, clockIn: "2026-11-12T14:00:00.000Z", status: "OPEN" });
    render(<App />);

    // Control positivo: HR de tenant_a SÍ ve el registro
    await login("hr@a.com");
    await goAttendance();
    await consult("emp-001");
    expect(await within(await screen.findByRole("table")).findByText(BACKEND_DATE)).not.toBeNull();
    await logout();

    // Usuario de tenant_b consulta el mismo employeeId: no obtiene nada
    await login("hr@b.com");
    await goAttendance();
    expect(screen.queryByRole("table")).toBeNull(); // sin restos del tenant anterior
    await consult("emp-001");
    await screen.findByText(/No hay marcaciones registradas para emp-001/);
    expect(screen.queryByText(BACKEND_DATE)).toBeNull();
    expect(backend.has("tenant_a", "emp-001")).toBe(true); // el dato sigue intacto en tenant_a
  });

  it("el frontend nunca envía tenantId en las operaciones de asistencia", async () => {
    render(<App />);
    await login("emp@a.com");
    await goAttendance();
    await user.click(screen.getByRole("button", { name: "Registrar entrada" }));
    await screen.findByRole("table");
    const ops = backend.requests.filter((r) => r.path.startsWith("/attendance"));
    ops.forEach((r) => {
      expect(JSON.stringify(r.body ?? {})).not.toMatch(/tenant/i);
      expect(r.search).not.toMatch(/tenant/i);
    });
  });

  it("HTTP 401: cierra sesión y vuelve al login con aviso", async () => {
    render(<App />);
    await login("emp@a.com");
    await goAttendance();
    backend.revokeAllTokens(); // el backend deja de aceptar el token
    await user.click(screen.getByRole("button", { name: /Actualizar/ }));
    expect(await screen.findByText(/Tu sesión expiró/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Ingresar" })).not.toBeNull();
    expect(sessionStorage.getItem("hcm_auth")).toBeNull();
    expect(window.location.pathname).toBe("/login");
  });

  it("HTTP 403 en DELETE: muestra permisos insuficientes y conserva la sesión", async () => {
    backend.seed({ tenantId: "tenant_a", employeeId: "emp-001", date: BACKEND_DATE, status: "OPEN" });
    backend.state.forceForbiddenDelete = true;
    render(<App />);
    await login("hr@a.com");
    await goAttendance();
    await consult("emp-001");
    await user.click(within(await screen.findByRole("table")).getByRole("button", { name: /Eliminar/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Eliminar/ }));
    expect(await within(dialog).findByText(/permisos suficientes/i)).not.toBeNull();
    expect(sessionStorage.getItem("hcm_auth")).not.toBeNull();
    expect(backend.has("tenant_a", "emp-001")).toBe(true);
  });

  it("HTTP 404 en DELETE: muestra el error del backend", async () => {
    backend.seed({ tenantId: "tenant_a", employeeId: "emp-001", date: BACKEND_DATE, status: "OPEN" });
    render(<App />);
    await login("hr@a.com");
    await goAttendance();
    await consult("emp-001");
    await user.click(within(await screen.findByRole("table")).getByRole("button", { name: /Eliminar/ }));
    // Otro usuario borra el registro mientras el diálogo está abierto
    const auth = backend.requests.find((r) => r.path === "/attendance").headers.Authorization;
    await fetch(`https://attendance.test/dev/attendance/emp-001/${BACKEND_DATE}`, {
      method: "DELETE",
      headers: { Authorization: auth },
    });
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Eliminar/ }));
    expect(await within(dialog).findByText(/no encontrada/i)).not.toBeNull();
  });

  it("la sesión sobrevive a recargar la página en la misma pestaña", async () => {
    const first = render(<App />);
    await login("emp@a.com");
    first.unmount();
    window.history.pushState({}, "", "/attendance"); // recarga directa de /attendance
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Asistencia" })).not.toBeNull();
  });

  it("una sesión expirada al cargar la página redirige al login", async () => {
    render(<App />);
    await login("emp@a.com");
    cleanup();
    const raw = JSON.parse(sessionStorage.getItem("hcm_auth"));
    const [h, , s] = raw.token.split(".");
    const expired = btoa(JSON.stringify({ exp: 1 })).replace(/=+$/, "");
    sessionStorage.setItem("hcm_auth", JSON.stringify({ ...raw, token: `${h}.${expired}.${s}` }));
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    expect(await screen.findByRole("button", { name: "Ingresar" })).not.toBeNull();
  });

  it("rutas protegidas sin sesión redirigen a /login", async () => {
    window.history.pushState({}, "", "/attendance");
    render(<App />);
    expect(await screen.findByRole("button", { name: "Ingresar" })).not.toBeNull();
    expect(window.location.pathname).toBe("/login");
  });

  it("registro: solo tenants válidos, envía employeeId y nunca un rol", async () => {
    window.history.pushState({}, "", "/register");
    render(<App />);
    const options = within(await screen.findByLabelText("Tenant (empresa)")).getAllByRole("option").map((o) => o.value);
    expect(options).toEqual(["tenant_a", "tenant_b", "tenant_c"]);
    await user.type(screen.getByLabelText("Correo electrónico"), "nuevo@a.com");
    await user.type(screen.getByLabelText(/Contraseña/), "password1");
    await user.type(screen.getByLabelText("Employee ID"), "emp-777");
    await user.click(screen.getByRole("button", { name: "Registrarme" }));
    expect(await screen.findByText(/Cuenta creada/)).not.toBeNull();
    const req = backend.requests.find((r) => r.path === "/auth/register");
    expect(req.body).toEqual({ email: "nuevo@a.com", password: "password1", tenantId: "tenant_a", employeeId: "emp-777" });
    expect(req.body.role).toBeUndefined();
  });

  it("licencias: EMPLOYEE no ve aprobación; HR aprueba con leaveId", async () => {
    render(<App />);
    await login("emp@a.com");
    await goAttendance();
    expect(screen.queryByLabelText("leaveId")).toBeNull();
    await logout();

    await login("hr@a.com");
    await goAttendance();
    await user.type(screen.getByLabelText("leaveId"), "leave-123");
    await user.click(screen.getByRole("button", { name: /Aprobar/ }));
    // aparece en la alerta en línea y en el toast
    expect((await screen.findAllByText("Licencia aprobada.")).length).toBeGreaterThan(0);
    const req = backend.requests.find((r) => r.path === "/leaves/leave-123/approve");
    expect(req.method).toBe("POST");
  });

  it("módulos pendientes muestran 'Próximamente' sin datos falsos", async () => {
    render(<App />);
    await login("emp@a.com");
    await user.click(screen.getByRole("link", { name: "Nómina" }));
    expect(await screen.findByText(/Próximamente/)).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole("table")).toBeNull());
  });
});
