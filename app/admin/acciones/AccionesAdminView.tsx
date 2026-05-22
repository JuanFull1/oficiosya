"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  nombre_completo: string;
  correo: string | null;
  foto_url: string | null;
};

type AccionAdmin = {
  id: string;
  admin_id: string;
  usuario_objetivo_id: string | null;
  reporte_id: string | null;
  accion: string;
  descripcion: string | null;
  creado_en: string;
};

type AccionVista = AccionAdmin & {
  admin?: Perfil | null;
  usuario_objetivo?: Perfil | null;
};

const CACHE_KEY = "oficiosya-admin-acciones-cache";

export default function AccionesAdminView() {
  const [acciones, setAcciones] = useState<AccionVista[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<
    "todas" | "advertencia" | "suspension" | "reporte" | "verificacion"
  >("todas");

  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState("");

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;

      setAcciones(JSON.parse(raw) as AccionVista[]);
    } catch (err) {
      console.error("No se pudo leer cache acciones admin:", err);
    }
  }, []);

  const guardarCache = useCallback((data: AccionVista[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("No se pudo guardar cache acciones admin:", err);
    }
  }, []);

  const cargarAcciones = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data, error: accionesError } = await supabase
        .from("acciones_admin")
        .select("*")
        .order("creado_en", { ascending: false });

      if (accionesError) {
        console.error("Error al cargar acciones:", accionesError);
        setError("No se pudieron cargar las acciones administrativas.");
        return;
      }

      const accionesBase = (data || []) as AccionAdmin[];

      const usuariosIds = Array.from(
        new Set(
          [
            ...accionesBase.map((a) => a.admin_id),
            ...accionesBase
              .map((a) => a.usuario_objetivo_id)
              .filter(Boolean),
          ] as string[]
        )
      );

      let perfiles: Perfil[] = [];

      if (usuariosIds.length > 0) {
        const { data: perfilesData } = await supabase
          .from("perfiles")
          .select("id,nombre_completo,correo,foto_url")
          .in("id", usuariosIds);

        perfiles = (perfilesData || []) as Perfil[];
      }

      const vista = accionesBase.map((accion) => ({
        ...accion,
        admin: perfiles.find((p) => p.id === accion.admin_id) || null,
        usuario_objetivo:
          perfiles.find((p) => p.id === accion.usuario_objetivo_id) || null,
      }));

      setAcciones(vista);
      guardarCache(vista);
    } catch (err) {
      console.error("Error general acciones admin:", err);
      setError("Ocurrió un error al sincronizar acciones administrativas.");
    } finally {
      setSincronizando(false);
    }
  }, [guardarCache]);

  useEffect(() => {
    leerCache();
    cargarAcciones();
  }, [leerCache, cargarAcciones]);

  const metricas = useMemo(() => {
    return {
      total: acciones.length,
      advertencias: acciones.filter((a) => a.accion === "advertencia").length,
      suspensiones: acciones.filter((a) => a.accion === "suspension").length,
      reportes: acciones.filter((a) => a.accion.includes("reporte")).length,
    };
  }, [acciones]);

  const accionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return acciones.filter((accion) => {
      const coincideTexto =
        !texto ||
        accion.accion.toLowerCase().includes(texto) ||
        accion.descripcion?.toLowerCase().includes(texto) ||
        accion.admin?.nombre_completo?.toLowerCase().includes(texto) ||
        accion.usuario_objetivo?.nombre_completo?.toLowerCase().includes(texto);

      const coincideFiltro =
        filtro === "todas" ||
        (filtro === "advertencia" && accion.accion === "advertencia") ||
        (filtro === "suspension" && accion.accion === "suspension") ||
        (filtro === "reporte" && accion.accion.includes("reporte")) ||
        (filtro === "verificacion" && accion.accion.includes("verificacion"));

      return coincideTexto && coincideFiltro;
    });
  }, [acciones, busqueda, filtro]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <Activity size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    Acciones administrativas
                  </h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Historial de advertencias, suspensiones y revisiones del sistema.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cargarAcciones}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <Loader2
                size={16}
                className={sincronizando ? "animate-spin" : ""}
              />
              Sincronizar
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard titulo="Total" valor={metricas.total} />
        <MetricCard titulo="Advertencias" valor={metricas.advertencias} ambar />
        <MetricCard titulo="Suspensiones" valor={metricas.suspensiones} rojo />
        <MetricCard titulo="Acciones sobre reportes" valor={metricas.reportes} />
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por acción, usuario, admin o descripción..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FiltroButton activo={filtro === "todas"} onClick={() => setFiltro("todas")}>
              Todas
            </FiltroButton>
            <FiltroButton activo={filtro === "advertencia"} onClick={() => setFiltro("advertencia")}>
              Advertencias
            </FiltroButton>
            <FiltroButton activo={filtro === "suspension"} onClick={() => setFiltro("suspension")}>
              Suspensiones
            </FiltroButton>
            <FiltroButton activo={filtro === "reporte"} onClick={() => setFiltro("reporte")}>
              Reportes
            </FiltroButton>
            <FiltroButton activo={filtro === "verificacion"} onClick={() => setFiltro("verificacion")}>
              Verificaciones
            </FiltroButton>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {accionesFiltradas.length === 0 ? (
          <EmptyCard texto="No hay acciones administrativas registradas." />
        ) : (
          accionesFiltradas.map((accion) => (
            <article
              key={accion.id}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
                    {accion.accion === "suspension" ? (
                      <AlertTriangle size={24} />
                    ) : accion.accion === "advertencia" ? (
                      <ShieldAlert size={24} />
                    ) : (
                      <FileText size={24} />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">
                        {traducirAccion(accion.accion)}
                      </h3>
                      <EstadoAccion accion={accion.accion} />
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {accion.descripcion || "Sin descripción registrada."}
                    </p>

                    <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                      <InfoLine
                        titulo="Administrador"
                        valor={accion.admin?.nombre_completo || "No disponible"}
                      />
                      <InfoLine
                        titulo="Usuario objetivo"
                        valor={
                          accion.usuario_objetivo?.nombre_completo ||
                          "No aplica"
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                  <Clock3 size={16} />
                  {formatearFecha(accion.creado_en)}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function MetricCard({
  titulo,
  valor,
  rojo = false,
  ambar = false,
}: {
  titulo: string;
  valor: number;
  rojo?: boolean;
  ambar?: boolean;
}) {
  let clases = "bg-slate-100 text-slate-700";
  if (rojo) clases = "bg-red-100 text-red-700";
  if (ambar) clases = "bg-amber-100 text-amber-700";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${clases}`}
      >
        <Activity size={21} />
      </div>

      <p className="text-sm font-semibold text-slate-500">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}

function FiltroButton({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        activo
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function EstadoAccion({ accion }: { accion: string }) {
  if (accion === "suspension") {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Suspensión
      </span>
    );
  }

  if (accion === "advertencia") {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        Advertencia
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      Registro
    </span>
  );
}

function InfoLine({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <UserRound size={15} className="text-slate-400" />
      <span>
        <span className="font-semibold text-slate-600">{titulo}:</span>{" "}
        {valor}
      </span>
    </div>
  );
}

function EmptyCard({ texto }: { texto: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500">
      {texto}
    </div>
  );
}

function traducirAccion(accion: string) {
  const mapa: Record<string, string> = {
    advertencia: "Advertencia a usuario",
    suspension: "Suspensión de usuario",
    reporte_en_revision: "Reporte marcado en revisión",
    reporte_resuelto: "Reporte resuelto",
    reporte_rechazado: "Reporte rechazado",
    verificacion_aprobada: "Verificación aprobada",
    verificacion_rechazada: "Verificación rechazada",
  };

  return mapa[accion] || accion;
}

function formatearFecha(fecha: string) {
  if (!fecha) return "";

  try {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(fecha));
  } catch {
    return "";
  }
}