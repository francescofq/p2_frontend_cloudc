import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Building2, LayoutDashboard, Users, Briefcase, Gauge, Clock, Wallet, LogOut, Menu, X,
} from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Empleados", icon: Users },
  { to: "/recruitment", label: "Reclutamiento", icon: Briefcase },
  { to: "/performance", label: "Desempeño", icon: Gauge },
  { to: "/attendance", label: "Asistencia", icon: Clock },
  { to: "/payroll", label: "Nómina", icon: Wallet },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const current = nav.find((n) => pathname.startsWith(n.to));

  const handleLogout = () => {
    toast.dismiss(); // no dejar avisos de la sesión anterior en pantalla
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300">
      {/* Fondo oscuro al abrir el menú en móvil */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-card dark:bg-slate-900 dark:border-slate-800 flex flex-col transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between gap-2 px-5 font-semibold border-b dark:border-slate-800">
          <span className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> HCM Cloud
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted dark:hover:bg-slate-800"
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>

        <Separator className="dark:bg-slate-800" />

        <div className="p-4">
          <p className="text-sm font-medium truncate" title={user?.email}>{user?.email}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{user?.tenantId}</Badge>
            <Badge variant="outline">{user?.role}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Navbar */}
        <header className="h-16 shrink-0 flex items-center gap-3 border-b bg-card/80 dark:bg-slate-900/80 dark:border-slate-800 backdrop-blur px-4 md:px-8 sticky top-0 z-20">
          <Button
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu />
          </Button>
          <h2 className="text-sm font-medium text-muted-foreground">
            {current?.label ?? "HCM Cloud"}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">{user?.tenantId}</Badge>
            <Badge variant="outline" className="hidden sm:inline-flex">{user?.role}</Badge>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 bg-muted/30 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
