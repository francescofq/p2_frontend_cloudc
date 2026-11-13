import { useState } from "react";
import { toast } from "sonner";
import { isPrivileged } from "@/lib/roles";
import { EMPLOYEE_ID_PATTERN, approveLeave, requestLeave } from "@/services/attendanceService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";

const findLeaveId = (data) => data?.leaveId ?? data?.item?.leaveId ?? data?.leave?.leaveId ?? null;

function Result({ result }) {
  if (!result) return null;
  const ok = result.type === "ok";
  return (
    <Alert variant={ok ? "default" : "destructive"}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <AlertDescription>
        <p>{result.text}</p>
        {ok && result.leaveId && (
          <p className="mt-1">
            leaveId: <span className="font-mono font-medium select-all">{result.leaveId}</span>
          </p>
        )}
        {ok && !result.leaveId && result.data && (
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[0.7rem]">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
      </AlertDescription>
    </Alert>
  );
}

function RequestLeaveCard({ user, privileged }) {
  const ownId = user.employeeId ?? "";
  const [form, setForm] = useState({ employeeId: ownId, type: "UNPAID", startDate: "", endDate: "", reason: "" });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const validate = () => {
    const next = {};
    if (!EMPLOYEE_ID_PATTERN.test(form.employeeId.trim())) next.employeeId = "employeeId inválido.";
    if (!form.type.trim()) next.type = "Indica el tipo de licencia.";
    if (!form.startDate) next.startDate = "Requerido.";
    if (!form.endDate) next.endDate = "Requerido.";
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      next.endDate = "Debe ser igual o posterior al inicio.";
    if (!form.reason.trim()) next.reason = "Indica el motivo.";
    if (form.reason.length > 300) next.reason = "Máximo 300 caracteres.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setResult(null);
    if (!validate()) return;
    setSending(true);
    try {
      const data = await requestLeave({
        employeeId: form.employeeId.trim(),
        type: form.type.trim().toUpperCase(),
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      });
      setResult({ type: "ok", text: "Solicitud de licencia enviada.", leaveId: findLeaveId(data), data });
      toast.success("Solicitud de licencia enviada.");
      setForm({ ...form, startDate: "", endDate: "", reason: "" });
    } catch (err) {
      setResult({ type: "error", text: err.message });
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const err = (key) => (errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitar licencia</CardTitle>
        <CardDescription>POST /leaves/request</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="leave-emp">Employee ID</Label>
              <Input id="leave-emp" value={form.employeeId} onChange={set("employeeId")}
                readOnly={!privileged} aria-invalid={!!errors.employeeId} autoComplete="off" />
              {err("employeeId")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-type">Tipo</Label>
              <Input id="leave-type" value={form.type} onChange={set("type")}
                placeholder="UNPAID" aria-invalid={!!errors.type} autoComplete="off" />
              {err("type")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-start">Inicio</Label>
              <Input id="leave-start" type="date" value={form.startDate} onChange={set("startDate")}
                aria-invalid={!!errors.startDate} />
              {err("startDate")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-end">Fin</Label>
              <Input id="leave-end" type="date" value={form.endDate} min={form.startDate || undefined}
                onChange={set("endDate")} aria-invalid={!!errors.endDate} />
              {err("endDate")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leave-reason">Motivo</Label>
            <Input id="leave-reason" value={form.reason} onChange={set("reason")}
              placeholder="Trámite personal" maxLength={300} aria-invalid={!!errors.reason} autoComplete="off" />
            {err("reason")}
          </div>
          <Button type="submit" size="lg" disabled={sending || (!privileged && !ownId)}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />} Enviar solicitud
          </Button>
          <Result result={result} />
        </form>
      </CardContent>
    </Card>
  );
}

function ApproveLeaveCard() {
  const [leaveId, setLeaveId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setResult(null);
    const id = leaveId.trim();
    if (!/^\S{1,200}$/.test(id)) {
      setError("Ingresa un leaveId válido (sin espacios).");
      return;
    }
    setError("");
    setSending(true);
    try {
      const data = await approveLeave(id);
      setResult({ type: "ok", text: "Licencia aprobada.", leaveId: findLeaveId(data) ?? id, data });
      toast.success("Licencia aprobada.");
      setLeaveId("");
    } catch (err) {
      setResult({ type: "error", text: err.message });
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aprobar licencia</CardTitle>
        <CardDescription>POST /leaves/&#123;leaveId&#125;/approve · solo HR o ADMIN</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-2">
            <Label htmlFor="approve-id">leaveId</Label>
            <Input id="approve-id" value={leaveId} onChange={(e) => setLeaveId(e.target.value)}
              placeholder="Pega aquí el leaveId de la solicitud" aria-invalid={!!error} autoComplete="off" />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Aprobar
          </Button>
          <Result result={result} />
        </form>
      </CardContent>
    </Card>
  );
}

export default function LeavesSection({ user }) {
  const privileged = isPrivileged(user.role);
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Licencias</h2>
        <p className="text-sm text-muted-foreground">
          La consulta de licencias aún no está disponible en la API; conserva el leaveId que devuelve la solicitud.
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <RequestLeaveCard user={user} privileged={privileged} />
        {privileged ? (
          <ApproveLeaveCard />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Aprobar licencia</CardTitle>
              <CardDescription>Solo disponible para HR o ADMIN.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </section>
  );
}
