import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ThemeToggle from "@/components/ThemeToggle";
import { AlertCircle, Building2, Info, Loader2 } from "lucide-react";

export default function Login() {
  const { login, user, notice } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      nav("/dashboard");
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  // Si ya hay sesión válida, no mostrar el formulario.
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative min-h-screen grid lg:grid-cols-2">
      <ThemeToggle className="absolute top-4 right-4 z-50" />

      {/* Panel izquierdo: branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">HCM Cloud</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Gestión de capital humano,<br />simplificada.
          </h1>
          <p className="text-slate-300 mt-4 max-w-md">
            Plataforma SaaS multi-tenant serverless para empleados, nómina,
            reclutamiento, desempeño y asistencia.
          </p>
        </div>
        <p className="text-sm text-slate-400">© 2026 HCM Cloud · CS2032 UTEC</p>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex items-center justify-center p-6 bg-muted/30 dark:bg-slate-950 transition-colors">
        <Card className="w-full max-w-md border-0 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-2xl">Bienvenido</CardTitle>
            <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {notice && !error && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button className="w-full" disabled={loading} type="submit">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ingresando…
                  </>
                ) : (
                  "Ingresar"
                )}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link to="/register" className="text-primary underline hover:text-primary/80 font-medium transition-colors">
                  Regístrate
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
