import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { TENANTS } from "@/config/env";
import { EMPLOYEE_ID_PATTERN } from "@/services/attendanceService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ThemeToggle from "@/components/ThemeToggle";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", tenantId: TENANTS[0], employeeId: "" });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Ingresa un correo válido.";
    if (form.password.length < 8) next.password = "La contraseña debe tener al menos 8 caracteres.";
    if (!TENANTS.includes(form.tenantId)) next.tenantId = "Selecciona un tenant válido.";
    if (!EMPLOYEE_ID_PATTERN.test(form.employeeId.trim()))
      next.employeeId = "Usa letras, números, . _ - (máx. 64). Ej: emp-001";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.email.trim(), form.password, form.tenantId, form.employeeId.trim());
      setMsg({ type: "ok", text: "Cuenta creada. Ya puedes iniciar sesión." });
      setForm({ ...form, password: "" });
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Error al registrar" });
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (key) =>
    errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-muted/30 dark:bg-slate-950 p-6 transition-colors">
      <ThemeToggle className="absolute top-4 right-4" />
      <Card className="w-full max-w-md border-0 shadow-sm dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>Regístrate en el espacio de tu empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {msg && (
              <Alert variant={msg.type === "ok" ? "default" : "destructive"}>
                {msg.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>{msg.text}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="reg-email">Correo electrónico</Label>
              <Input id="reg-email" type="email" value={form.email} onChange={set("email")}
                autoComplete="email" aria-invalid={!!errors.email} />
              {fieldError("email")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Contraseña (mín. 8 caracteres)</Label>
              <Input id="reg-password" type="password" value={form.password} onChange={set("password")}
                autoComplete="new-password" aria-invalid={!!errors.password} />
              {fieldError("password")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-tenant">Tenant (empresa)</Label>
              <select id="reg-tenant" value={form.tenantId} onChange={set("tenantId")}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30">
                {TENANTS.map((t) => (
                  <option key={t} value={t} className="bg-background text-foreground">{t}</option>
                ))}
              </select>
              {fieldError("tenantId")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-employee">Employee ID</Label>
              <Input id="reg-employee" placeholder="emp-001" value={form.employeeId} onChange={set("employeeId")}
                autoComplete="off" aria-invalid={!!errors.employeeId} />
              {fieldError("employeeId")}
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando…</>) : "Registrarme"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Las cuentas creadas desde aquí tienen rol EMPLOYEE.
            </p>
            <p className="text-sm text-center text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-primary underline hover:text-primary/80">Inicia sesión</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
