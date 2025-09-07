// src/shell/Shell.tsx
import { NavLink, Outlet } from "react-router-dom";

export default function Shell() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[220px_1fr]">
      <aside className="border-r border-base-800 p-4">
        <div className="mb-4 text-base font-semibold">KKB Admin</div>
        <nav className="grid gap-1">
          <Nav to="/">Dashboard</Nav>
          <Nav to="/kanal-kontrol-botu">Kanal Kontrol Botu</Nav>
          <Nav to="/banka-regression-botu">Banka Regresyon Botu</Nav>
          <Nav to="/kart-durum-raporu">Kart Durum Raporu</Nav>
          <Nav to="/parametre-durum-kontrol">Parametre Durum Kontrol</Nav>
          
          {/* Divider */}
          <div className="my-2 border-t border-base-800"></div>
          
          <Nav to="/changelog">📋 Changelog</Nav>
        </nav>
      </aside>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

function Nav({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-xl px-3 py-2 text-sm ${
          isActive ? "bg-base-900 text-base-100" : "text-base-300 hover:bg-base-900"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
