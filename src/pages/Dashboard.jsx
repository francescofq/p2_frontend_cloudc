import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StatusBadge from "@/components/StatusBadge";
import { listAttendance, sortRecords } from "@/services/attendanceService";
import { AlertCircle, Clock } from "lucide-react";

function Stat({ title, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? "";

  // Estadísticas reales del servicio Attendance (sin datos inventados).
  const [stats, setStats] = useState({ loading: Boolean(employeeId), error: "", count: 0, more: false, last: null });

  useEffect(() => {
    if (!employeeId) return undefined;
    let cancelled = false;
    listAttendance(employeeId)
      .then((data) => {
        if (cancelled) return;
        const sorted = sortRecords(data.items);
        setStats({
          loading: false,
          error: "",
          count: data.items.length,
          more: Boolean(data.nextToken),
          last: sorted[0] ?? null,
        });
      })
      .catch((err) => {
        if (!cancelled) setStats({ loading: false, error: err.message, count: 0, more: false, last: null });
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Bienvenido, {user?.email}</p>
        </div>
        <Button asChild size="lg">
          <Link to="/attendance"><Clock /> Ir a Asistencia</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat title="Correo"><p className="text-sm truncate" title={user?.email}>{user?.email}</p></Stat>
        <Stat title="Tenant activo"><Badge>{user?.tenantId}</Badge></Stat>
        <Stat title="Rol"><Badge variant="secondary">{user?.role}</Badge></Stat>
        <Stat title="Employee ID"><p className="text-sm font-mono truncate">{employeeId || "—"}</p></Stat>

        <Stat title="Marcaciones registradas">
          {stats.loading ? (
            <Skeleton className="h-6 w-16" />
          ) : (
            <p className="text-2xl font-semibold">
              {employeeId && !stats.error ? `${stats.count}${stats.more ? "+" : ""}` : "—"}
            </p>
          )}
        </Stat>

        <Stat title="Última marcación">
          {stats.loading ? (
            <Skeleton className="h-6 w-28" />
          ) : stats.last ? (
            <div className="flex items-center gap-2">
              <StatusBadge status={stats.last.status} />
              <span className="text-sm text-muted-foreground">{stats.last.date}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{employeeId && !stats.error ? "Sin marcaciones" : "—"}</p>
          )}
        </Stat>
      </div>

      {!employeeId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Tu cuenta no tiene un employeeId asociado, por lo que no hay datos de asistencia propios que mostrar.
          </AlertDescription>
        </Alert>
      )}
      {stats.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No se pudieron cargar las estadísticas de asistencia: {stats.error}</AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        Los datos de asistencia provienen del servicio Attendance. Los demás módulos se integrarán próximamente.
      </p>
    </div>
  );
}
