# HCM Cloud – Frontend (SaaS Multi-Tenant)

Frontend en **React 19 + Vite 8 + Tailwind CSS 4** (componentes shadcn/ui) para el proyecto HCM SaaS Multi-Tenant.
Consume directamente las APIs REST de AWS API Gateway con `fetch` y autenticación **JWT propia (sin Cognito)**.
No se conecta a DynamoDB, Lambda, SNS ni SQS, y no usa credenciales AWS en el navegador.

## Estado de los módulos

| Módulo | Estado |
| --- | --- |
| Login / Registro (JWT) | Funcional |
| Dashboard | Funcional (datos reales de Attendance) |
| **Asistencia** (consultar, clock-in, clock-out, eliminar) | **Funcional** |
| Licencias (solicitar / aprobar) | Funcional (dentro de la página Asistencia) |
| Empleados, Reclutamiento, Desempeño, Nómina | "Próximamente" |

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `VITE_AUTH_API_URL` | Base de `hcm-auth-dev` (login / registro) |
| `VITE_ATTENDANCE_API_URL` | Base de `hcm-attendance-dev` (asistencia / licencias) |

Los valores de ejemplo están en [`.env.example`](.env.example). Las URLs se centralizan en `src/config/env.js`.
`.env` y `.env.local` están en `.gitignore`. **Vite incorpora las variables en tiempo de build**: si las cambias, hay que volver a compilar/desplegar.

## Ejecutar en local

```bash
# Requiere Node ^20.19 o >=22.12 (ver .nvmrc)
cp .env.example .env.local
npm ci
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm test           # pruebas (backend simulado, NO llaman a AWS)
npm run lint
```

> El navegador llama a las APIs desde otro origen (`localhost:5173` o el dominio de Amplify), por lo que **API Gateway debe tener CORS habilitado** (ver más abajo).

## Seguridad y multi-tenancy (cómo se comporta el frontend)

- El JWT se guarda en **`sessionStorage`** (sobrevive a recargas de la misma pestaña, se pierde al cerrarla). Nunca se guardan contraseñas ni secretos.
- Todas las llamadas protegidas llevan `Authorization: Bearer <JWT>` (`src/services/apiClient.js`).
- Si el JWT expira (se revisa antes de cada llamada, con un temporizador y al volver a la pestaña) o el backend responde **401**, se cierra la sesión y se redirige al login.
- **403** muestra "permisos insuficientes" sin cerrar la sesión.
- El `tenantId` sale **solo de la sesión**: no hay forma de cambiarlo en la interfaz y nunca se envía en las operaciones de asistencia. El aislamiento real lo garantiza el backend.
- `EMPLOYEE` opera únicamente sobre su `employeeId`. `HR`/`ADMIN` pueden indicar el `employeeId` a consultar y ven el botón **Eliminar** (con confirmación). Estos controles son de interfaz; la autoridad es el backend.
- Al cerrar sesión se limpia el estado de la interfaz (la página de Asistencia se reinicia por usuario/tenant).
- El registro público solo ofrece `tenant_a|b|c`, envía `employeeId` y **nunca** envía un `role`.
- `clock-out` usa la `date` exacta devuelta por el backend (no se deriva del timestamp UTC).

## Despliegue en AWS Amplify Hosting

1. **Amplify Console → Create new app → GitHub** → autoriza y elige el repositorio y la rama `master`.
2. Amplify detecta `amplify.yml` (usa Node 22, `npm ci`, `npm run build`, publica `dist/`).
3. **Environment variables** (App settings): crea `VITE_AUTH_API_URL` y `VITE_ATTENDANCE_API_URL` con las URLs de `.env.example`.
4. **Rewrites and redirects** (App settings) → *Manage redirects* → agrega esta regla para que `/login`, `/dashboard` y `/attendance` funcionen al recargar:

   | Source address | Target address | Type |
   | --- | --- | --- |
   | `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

   Es la regla oficial de Amplify para SPA. Las redirecciones se configuran en la consola; no se pueden definir desde `amplify.yml`.
5. **Save and deploy**. Cada `git push` a `master` redespliega.

## CORS (requisito del backend)

Como el frontend vive en otro dominio, API Gateway debe responder:

- A las peticiones `OPTIONS` (preflight) **sin exigir el Lambda Authorizer**, con `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Authorization,Content-Type` y `Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS`.
- Con `Access-Control-Allow-Origin` también en las respuestas de las Lambdas **y en las respuestas 401/403 del Authorizer** (Gateway Responses `DEFAULT_4XX`/`UNAUTHORIZED`/`ACCESS_DENIED`). Si faltan, el navegador oculta el 401/403 y el frontend mostrará "No se pudo conectar… CORS".

## Guion de demostración (con las APIs reales)

1. Login con un `EMPLOYEE` de `tenant_a` → **Asistencia** → *Registrar entrada* (aparece `OPEN`).
2. *Registrar salida* (pasa a `CLOSED` con minutos trabajados) → *Cerrar sesión*.
3. Login con un `HR` de `tenant_a` → Asistencia → consultar `emp-001` → *Eliminar* → confirmar → ya no aparece.
4. Cerrar sesión, login con un usuario de `tenant_b`, consultar `emp-001` → sin registros (aislamiento por tenant).
5. Errores: con un token vencido/revocado se vuelve al login (401); borrar como `EMPLOYEE` por API devuelve 403.

## Pruebas automatizadas

`npm test` ejecuta 20 pruebas (Vitest + Testing Library) contra un **backend simulado en memoria** (`src/__tests__/fakeBackend.js`) que replica el contrato de las APIs: JWT, filtrado por tenant, 401/403/404/409. Cubren el flujo completo de 11 pasos, el manejo de 401/403/404, expiración del JWT, recarga de sesión, rutas protegidas, registro y licencias. **No sustituyen a una prueba contra AWS.**
