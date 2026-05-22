"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ClipboardList,
  FileCheck2,
  Flag,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Settings2,
  ShieldAlert,
  Tags,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PerfilAdmin = {
  id: string;
  nombre_completo: string;
  correo: string | null;
  foto_url: string | null;
  es_admin: boolean;
};

const menuAdmin = [
  {
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Usuarios",
    path: "/admin/usuarios",
    icon: UsersRound,
  },
  {
    label: "Verificaciones",
    path: "/admin/verificaciones",
    icon: FileCheck2,
  },
  {
    label: "Reportes",
    path: "/admin/reportes",
    icon: Flag,
  },
  {
    label: "Categorías",
    path: "/admin/categorias",
    icon: Tags,
  },
  {
    label: "Servicios",
    path: "/admin/servicios",
    icon: ClipboardList,
  },
  {
    label: "Acciones",
    path: "/admin/acciones",
    icon: BarChart3,
  },

  {
  label: "Parámetros",
  path: "/admin/parametros",
  icon: Settings2,
},


];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [perfil, setPerfil] = useState<PerfilAdmin | null>(null);
  const [validando, setValidando] = useState(true);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [sidebarCompacto, setSidebarCompacto] = useState(false);

  useEffect(() => {
    const validarAdmin = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: perfilData, error: perfilError } = await supabase
        .from("perfiles")
        .select("id,nombre_completo,correo,foto_url,es_admin")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (perfilError || !perfilData || !perfilData.es_admin) {
        router.replace("/panel");
        return;
      }

      setPerfil(perfilData as PerfilAdmin);
      setValidando(false);
    };

    validarAdmin();
  }, [router]);

  const tituloActual = useMemo(() => {
    return (
      menuAdmin.find((item) => pathname.startsWith(item.path))?.label ||
      "Administración"
    );
  }, [pathname]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (validando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
            <Loader2 className="animate-spin" size={20} />
            Validando acceso administrativo...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      {sidebarAbierto && (
        <button
          type="button"
          onClick={() => setSidebarAbierto(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          aria-label="Cerrar menú"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300 ${
          sidebarCompacto ? "lg:w-24" : "lg:w-72"
        } ${
          sidebarAbierto
            ? "w-72 translate-x-0"
            : "w-72 -translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <ShieldAlert size={22} />
            </div>

            {!sidebarCompacto && (
              <div>
                <h1 className="text-base font-bold text-slate-900">
                  Admin
                </h1>
                <p className="text-xs font-medium text-slate-400">
                  OficiosYA
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarAbierto(false)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {menuAdmin.map((item) => {
            const Icon = item.icon;
            const activo = pathname.startsWith(item.path);

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  router.push(item.path);
                  setSidebarAbierto(false);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activo
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                } ${sidebarCompacto ? "lg:justify-center lg:px-3" : ""}`}
              >
                <Icon size={20} />
                {!sidebarCompacto && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          

          <button
            type="button"
            onClick={cerrarSesion}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 ${
              sidebarCompacto ? "lg:justify-center lg:px-3" : ""
            }`}
          >
            <LogOut size={20} />
            {!sidebarCompacto && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <section
        className={`min-h-screen transition-all duration-300 ${
          sidebarCompacto ? "lg:pl-24" : "lg:pl-72"
        }`}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/90 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarAbierto(true)}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-sm lg:hidden"
              >
                <Menu size={20} />
              </button>

              <button
                type="button"
                onClick={() => setSidebarCompacto((prev) => !prev)}
                className="hidden rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-sm lg:inline-flex"
              >
                <ChevronLeft
                  size={20}
                  className={sidebarCompacto ? "rotate-180" : ""}
                />
              </button>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {tituloActual}
                </h2>
                <p className="text-sm text-slate-500">
                  Gestión administrativa del sistema
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm md:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                {perfil?.nombre_completo?.charAt(0)?.toUpperCase() || "A"}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900">
                  {perfil?.nombre_completo || "Administrador"}
                </p>
                <p className="text-xs text-slate-400">
                  {perfil?.correo || "Cuenta admin"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">{children}</div>
      </section>
    </main>
  );
}