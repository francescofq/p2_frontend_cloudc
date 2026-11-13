import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useDarkMode } from "@/hooks/useDarkMode";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import ComingSoon from "@/components/ComingSoon";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Attendance from "@/pages/Attendance";

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [isDark] = useDarkMode();
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/employees" element={<ComingSoon title="Empleados" />} />
            <Route path="/recruitment" element={<ComingSoon title="Reclutamiento" />} />
            <Route path="/performance" element={<ComingSoon title="Desempeño" />} />
            <Route path="/payroll" element={<ComingSoon title="Nómina" />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme={isDark ? "dark" : "light"} richColors position="bottom-right" />
    </AuthProvider>
  );
}
