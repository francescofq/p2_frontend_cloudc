import { attendanceApi } from "@/services/apiClient";

const seg = encodeURIComponent;

// GET /attendance?employeeId=...
export async function listAttendance(employeeId, signal) {
  const data = await attendanceApi.get("/attendance", { employeeId }, signal);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    count: typeof data?.count === "number" ? data.count : (data?.items?.length ?? 0),
    nextToken: data?.nextToken ?? null,
  };
}

// POST /attendance/clock-in  -> 201, status OPEN
export const clockIn = (employeeId) =>
  attendanceApi.post("/attendance/clock-in", { employeeId });

// POST /attendance/clock-out -> 200, status CLOSED.
// `date` debe ser exactamente el devuelto por el backend (no derivarlo del timestamp UTC).
export const clockOut = (employeeId, date) =>
  attendanceApi.post("/attendance/clock-out", { employeeId, date });

// DELETE /attendance/{employeeId}/{date}  (sin body)
export const deleteAttendance = (employeeId, date) =>
  attendanceApi.delete(`/attendance/${seg(employeeId)}/${seg(date)}`);

// POST /leaves/request
export const requestLeave = (payload) => attendanceApi.post("/leaves/request", payload);

// POST /leaves/{leaveId}/approve  (solo HR / ADMIN; el backend lo valida)
// Se envía `{}` para que el handler reciba un cuerpo JSON válido.
export const approveLeave = (leaveId) =>
  attendanceApi.post(`/leaves/${seg(leaveId)}/approve`, {});

// Más reciente primero: por `date` y, a igualdad, por `clockIn`.
export function sortRecords(items) {
  return [...items].sort((a, b) => {
    const d = String(b.date ?? "").localeCompare(String(a.date ?? ""));
    return d !== 0 ? d : String(b.clockIn ?? "").localeCompare(String(a.clockIn ?? ""));
  });
}

// Mismo formato que usa el backend para employeeId (ej. emp-001).
export const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
