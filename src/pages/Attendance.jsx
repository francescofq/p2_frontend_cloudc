import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { isPrivileged } from "@/lib/roles";
import { formatMinutes, formatTime } from "@/lib/format";
import {
  EMPLOYEE_ID_PATTERN,
  clockIn,
  clockOut,
  deleteAttendance,
  listAttendance,
  sortRecords,
} from "@/services/attendanceService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import LeavesSection from "@/components/attendance/LeavesSection";
import {
  AlertCircle, CheckCircle2, Inbox, Loader2, Lock, LogIn, LogOut, RefreshCw, Search, Trash2,
} from "lucide-react";

function AttendanceView({ user }) {
  const privileged = isPrivileged(user.role);
  const ownId = user.employeeId ?? "";

  // employeeId "aplicado": el empleado sobre el que operan consulta y botones.
  // Para EMPLOYEE siempre es el propio y no puede cambiarse.
  const [employeeId, setEmployeeId] = useState(ownId);
  const [draftId, setDraftId] = useState(ownId);
  const [idError, setIdError] = useState("");

  const [items, setItems] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [loading, setLoading] = useState(Boolean(ownId));
  const [loadError, setLoadError] = useState("");

  const [feedback, setFeedback] = useState(null); // { type: "ok" | "error", text }
  const [pending, setPending] = useState(""); // "in" | "out:<date>" | "delete"

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  // Evita que una respuesta tardía pise datos de una consulta más nueva.
  const reqId = useRef(0);

  const load = useCallback(async (id) => {
    const mine = ++reqId.current;
    setLoading(true);
    setLoadError("");
    try {
      const data = await listAttendance(id);
      if (mine !== reqId.current) return;
      setItems(sortRecords(data.items));
      setNextToken(data.nextToken);
    } catch (err) {
      if (mine !== reqId.current) return;
      setItems([]);
      setNextToken(null);
      setLoadError(err.message);
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employeeId) load(employeeId);
    return () => {
      reqId.current += 1;
    };
  }, [employeeId, load]);

  const submitConsult = (e) => {
    e.preventDefault();
    const id = draftId.trim();
    if (!EMPLOYEE_ID_PATTERN.test(id)) {
      setIdError("Ingresa un employeeId válido (letras, números, . _ -; máx. 64). Ej: emp-001");
      return;
    }
    setIdError("");
    setFeedback(null);
    if (id === employeeId) {
      load(id);
    } else {
      setItems([]);
      setNextToken(null);
      setEmployeeId(id);
    }
  };

  const runAction = async (key, fn, okText) => {
    setPending(key);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ type: "ok", text: okText });
      toast.success(okText);
      await load(employeeId);
    } catch (err) {
      setFeedback({ type: "error", text: err.message });
      toast.error(err.message);
    } finally {
      setPending("");
    }
  };

  const handleClockIn = () =>
    runAction("in", () => clockIn(employeeId), `Entrada registrada para ${employeeId}.`);

  // Se usa la `date` exacta que devolvió el backend (no se deriva del timestamp UTC).
  const handleClockOut = (record) =>
    runAction(
      `out:${record.date}`,
      () => clockOut(employeeId, record.date),
      `Salida registrada para ${employeeId} (${record.date}).`
    );

  const openDelete = (record) => {
    if (!privileged) return; // defensa extra: EMPLOYEE no puede eliminar
    setDeleteError("");
    setDeleteTarget(record);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { date } = deleteTarget;
    setPending("delete");
    setDeleteError("");
    try {
      await deleteAttendance(employeeId, date);
      const text = `Marcación del ${date} eliminada para ${employeeId}.`;
      toast.success(text);
      setFeedback({ type: "ok", text });
      setDeleteTarget(null);
      await load(employeeId);
    } catch (err) {
      setDeleteError(err.message); // 403 / 404 se muestran dentro del diálogo
      toast.error(err.message);
      if (err.status === 404) load(employeeId);
    } finally {
      setPending("");
    }
  };

  const busy = pending !== "";
  const openRecord = items.find((r) => r.status === "OPEN");
  const canOperate = Boolean(employeeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Asistencia</h1>
          <p className="text-muted-foreground">
            {privileged
              ? "Consulta y administra las marcaciones de empleados de tu tenant."
              : "Registra tu entrada y salida y revisa tus marcaciones."}
          </p>
        </div>
        <div className="flex items-center gap-2" title="El tenant proviene de tu sesión y no puede modificarse">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge>{user.tenantId}</Badge>
          <Badge variant="outline">{user.role}</Badge>
        </div>
      </div>

      {!privileged && !ownId && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Tu cuenta no tiene un employeeId asociado, por lo que no puedes registrar ni consultar asistencia.
          </AlertDescription>
        </Alert>
      )}

      {/* Marcación */}
      <Card>
        <CardHeader>
          <CardTitle>Marcación</CardTitle>
          <CardDescription>
            {privileged
              ? "Indica el employeeId a consultar. El aislamiento por tenant lo garantiza el backend."
              : "Las operaciones se realizan sobre tu propio employeeId."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {privileged ? (
            <form onSubmit={submitConsult} className="flex flex-wrap items-end gap-3" noValidate>
              <div className="space-y-2 w-full sm:w-64">
                <Label htmlFor="att-employee">Employee ID</Label>
                <Input
                  id="att-employee"
                  placeholder="emp-001"
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  autoComplete="off"
                  aria-invalid={!!idError}
                />
              </div>
              <Button type="submit" size="lg" variant="secondary" disabled={busy}>
                <Search /> Consultar
              </Button>
            </form>
          ) : (
            <div className="space-y-1">
              <Label>Employee ID</Label>
              <p className="font-mono text-sm">{ownId || "—"}</p>
            </div>
          )}
          {idError && <p className="text-xs text-destructive">{idError}</p>}

          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={handleClockIn} disabled={!canOperate || busy || loading}>
              {pending === "in" ? <Loader2 className="animate-spin" /> : <LogIn />}
              Registrar entrada
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => openRecord && handleClockOut(openRecord)}
              disabled={!canOperate || !openRecord || busy || loading}
              title={openRecord ? `Cierra la marcación abierta del ${openRecord.date}` : "No hay una marcación abierta"}
            >
              {pending.startsWith("out:") ? <Loader2 className="animate-spin" /> : <LogOut />}
              Registrar salida
            </Button>
          </div>
          {canOperate && (
            <p className="text-xs text-muted-foreground">
              Operando sobre <span className="font-mono">{employeeId}</span> en <span className="font-mono">{user.tenantId}</span>.
            </p>
          )}

          {feedback && (
            <Alert variant={feedback.type === "ok" ? "default" : "destructive"}>
              {feedback.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{feedback.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Marcaciones</CardTitle>
          <CardDescription>
            {employeeId ? `Registros de ${employeeId}` : "Sin empleado seleccionado"}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="lg"
              onClick={() => load(employeeId)}
              disabled={!canOperate || loading || busy}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} /> Actualizar
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {loading && items.length === 0 ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando marcaciones">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            !loadError && (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">
                  {employeeId
                    ? `No hay marcaciones registradas para ${employeeId}.`
                    : "Ingresa un employeeId para consultar marcaciones."}
                </p>
              </div>
            )
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>EmployeeId</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead className="text-right">Min. trabajados</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={`${r.employeeId}-${r.date}`}>
                      <TableCell className="font-medium">{r.date}</TableCell>
                      <TableCell className="font-mono">{r.employeeId}</TableCell>
                      <TableCell title={r.clockIn}>{formatTime(r.clockIn)}</TableCell>
                      <TableCell title={r.clockOut}>{formatTime(r.clockOut)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMinutes(r.workedMinutes)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {r.status === "OPEN" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleClockOut(r)}
                              disabled={busy}
                            >
                              {pending === `out:${r.date}` ? <Loader2 className="animate-spin" /> : <LogOut />}
                              Registrar salida
                            </Button>
                          )}
                          {privileged && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openDelete(r)}
                              disabled={busy}
                            >
                              <Trash2 /> Eliminar
                            </Button>
                          )}
                          {!privileged && r.status !== "OPEN" && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {nextToken && (
            <p className="mt-3 text-xs text-muted-foreground">
              El backend indica que existen más registros; esta vista muestra solo la primera página.
            </p>
          )}
        </CardContent>
      </Card>

      <LeavesSection user={user} />

      {/* Confirmación de eliminación */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && pending !== "delete") {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar marcación?</DialogTitle>
            <DialogDescription>
              Se eliminará de forma permanente la marcación de{" "}
              <span className="font-mono font-medium">{employeeId}</span> del día{" "}
              <span className="font-medium">{deleteTarget?.date}</span>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError("");
              }}
              disabled={pending === "delete"}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending === "delete"}>
              {pending === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// `key` reinicia por completo el estado si cambia la sesión (otro usuario / otro tenant),
// evitando que se vean registros de la sesión anterior.
export default function AttendancePage() {
  const { user } = useAuth();
  return <AttendanceView key={`${user.tenantId}:${user.userId ?? user.email}`} user={user} />;
}
