export const ROLES = Object.freeze({
  EMPLOYEE: "EMPLOYEE",
  HR: "HR",
  ADMIN: "ADMIN",
});

// HR y ADMIN pueden operar sobre otros empleados de su tenant.
// Esto solo controla qué muestra la interfaz; la autoridad real es el backend.
export const isPrivileged = (role) => role === ROLES.HR || role === ROLES.ADMIN;
