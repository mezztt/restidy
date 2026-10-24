import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { THEME_KEY } from "./config";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Panel general (Mezztt)
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import Sistemas from "./pages/admin/Sistemas";
import Pagos from "./pages/admin/Pagos";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminSettings from "./pages/admin/AdminSettings";
import MailCenter from "./pages/admin/MailCenter";

// Sistema del local
import ClientLayout from "./pages/app/ClientLayout";
import Inicio from "./pages/app/Inicio";
import Usuarios from "./pages/app/Usuarios";
import Configuracion from "./pages/app/Configuracion";
// un archivo por módulo (cada agente completa el suyo)
import CartaPage from "./pages/app/carta/Index";
import SalonPage from "./pages/app/salon/Index";
import CocinaPage from "./pages/app/cocina/Index";
import MostradorPage from "./pages/app/mostrador/Index";
import CajaPage from "./pages/app/caja/Index";
import DeliveryPage from "./pages/app/delivery/Index";
import ReservasPage from "./pages/app/reservas/Index";
import StockPage from "./pages/app/stock/Index";
import ComprasPage from "./pages/app/compras/Index";
import PersonalPage from "./pages/app/personal/Index";
import ClientesPage from "./pages/app/clientes/Index";
import ReportesPage from "./pages/app/reportes/Index";

// Hojas para imprimir (carta, QR de mesas, cartel del libro de quejas)
import PrintCarta from "./pages/print/PrintCarta";
import PrintQr from "./pages/print/PrintQr";
import PrintCartel from "./pages/print/PrintCartel";

// Webs públicas del local
import Carta from "./pages/public/Carta";
import MesaQR from "./pages/public/MesaQR";
import ReservarMesa from "./pages/public/ReservarMesa";
import PedirOnline from "./pages/public/PedirOnline";
import Seguimiento from "./pages/public/Seguimiento";
import Legal from "./pages/public/Legal";

function App() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    // las páginas públicas se ven siempre en claro (lo fuerza useLightPage)
    if (/^\/(c|m|r|p|seguimiento|legal)\//.test(window.location.pathname)) return;
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* PANEL GENERAL (Mezztt) */}
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/sistemas" element={<Sistemas />} />
          <Route path="/admin/pagos" element={<Pagos />} />
          <Route path="/admin/facturacion" element={<AdminBilling />} />
          <Route path="/admin/correos" element={<MailCenter />} />
          <Route path="/admin/configuracion" element={<AdminSettings />} />
        </Route>

        {/* SISTEMA DEL LOCAL */}
        <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
          <Route path="/app" element={<Inicio />} />
          <Route path="/app/carta" element={<CartaPage />} />
          <Route path="/app/salon" element={<SalonPage />} />
          <Route path="/app/cocina" element={<CocinaPage />} />
          <Route path="/app/mostrador" element={<MostradorPage />} />
          <Route path="/app/caja" element={<CajaPage />} />
          <Route path="/app/delivery" element={<DeliveryPage />} />
          <Route path="/app/reservas" element={<ReservasPage />} />
          <Route path="/app/stock" element={<StockPage />} />
          <Route path="/app/compras" element={<ComprasPage />} />
          <Route path="/app/personal" element={<PersonalPage />} />
          <Route path="/app/clientes" element={<ClientesPage />} />
          <Route path="/app/reportes" element={<ReportesPage />} />
          <Route path="/app/usuarios" element={<Usuarios />} />
          <Route path="/app/configuracion" element={<Configuracion />} />
        </Route>

        {/* HOJAS PARA IMPRIMIR (con login, sin menú) */}
        <Route path="/print/carta" element={<ProtectedRoute><PrintCarta /></ProtectedRoute>} />
        <Route path="/print/qr-mesas" element={<ProtectedRoute><PrintQr /></ProtectedRoute>} />
        <Route path="/print/cartel/quejas" element={<ProtectedRoute><PrintCartel /></ProtectedRoute>} />

        {/* WEBS PÚBLICAS (sin login) */}
        <Route path="/c/:slug" element={<Carta />} />
        <Route path="/m/:slug/:token" element={<MesaQR />} />
        <Route path="/r/:slug" element={<ReservarMesa />} />
        <Route path="/p/:slug" element={<PedirOnline />} />
        <Route path="/seguimiento/:token" element={<Seguimiento />} />

        {/* LEGALES (sin login) */}
        <Route path="/legal/terminos" element={<Legal doc="terminos" />} />
        <Route path="/legal/privacidad" element={<Legal doc="privacidad" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
