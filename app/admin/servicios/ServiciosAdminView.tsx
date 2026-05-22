"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  nombre_completo: string;
  correo: string | null;
  telefono: string | null;
  foto_url: string | null;
  zona: string | null;
  activo: boolean;
  verificado: boolean;
};

type Servicio = {
  id: string;
  solicitud_id: string;
  cliente_id: string;
  trabajador_id: string;
  propuesta_aceptada_id: string | null;
  estado: string;
  inicio_programado: string | null;
  iniciado_en: string | null;
  finalizado_en: string | null;
  creado_en: string;
  actualizado_en: string;
};

type Solicitud = {
  id: string;
  cliente_id: string;
  titulo: string;
  descripcion: string;
  zona: string | null;
  presupuesto: number | null;
  estado: string;
  creado_en: string;
};

type ServicioVista = Servicio & {
  cliente?: Perfil | null;
  trabajador?: Perfil | null;
  solicitud?: Solicitud | null;
};

const CACHE_KEY = "oficiosya-admin-servicios-cache";

export default function ServiciosAdminView() {
  const [servicios, setServicios] = useState<ServicioVista[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<
    "todos" | "activos" | "finalizados" | "cancelados"
  >("todos");

  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      setServicios(JSON.parse(raw) as ServicioVista[]);
    } catch (err) {
      console.error("No se pudo leer cache servicios admin:", err);
    }
  }, []);

  const guardarCache = useCallback((data: ServicioVista[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("No se pudo guardar cache servicios admin:", err);
    }
  }, []);

  const cargarServicios = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data: serviciosData, error: serviciosError } = await supabase
        .from("servicios")
        .select("*")
        .order("creado_en", { ascending: false });

      if (serviciosError) {
        console.error("Error al cargar servicios:", serviciosError);
        setError("No se pudieron cargar los servicios.");
        return;
      }

      const serviciosBase = (serviciosData || []) as Servicio[];

      const usuariosIds = Array.from(
        new Set([
          ...serviciosBase.map((item) => item.cliente_id),
          ...serviciosBase.map((item) => item.trabajador_id),
        ])
      );

      const solicitudesIds = Array.from(
        new Set(serviciosBase.map((item) => item.solicitud_id))
      );

      let perfiles: Perfil[] = [];
      let solicitudes: Solicitud[] = [];

      if (usuariosIds.length > 0) {
        const { data: perfilesData } = await supabase
          .from("perfiles")
          .select(
            "id,nombre_completo,correo,telefono,foto_url,zona,activo,verificado"
          )
          .in("id", usuariosIds);

        perfiles = (perfilesData || []) as Perfil[];
      }

      if (solicitudesIds.length > 0) {
        const { data: solicitudesData } = await supabase
          .from("solicitudes_servicio")
          .select(
            "id,cliente_id,titulo,descripcion,zona,presupuesto,estado,creado_en"
          )
          .in("id", solicitudesIds);

        solicitudes = (solicitudesData || []) as Solicitud[];
      }

      const vista = serviciosBase.map((servicio) => ({
        ...servicio,
        cliente:
          perfiles.find((perfil) => perfil.id === servicio.cliente_id) || null,
        trabajador:
          perfiles.find((perfil) => perfil.id === servicio.trabajador_id) ||
          null,
        solicitud:
          solicitudes.find((solicitud) => solicitud.id === servicio.solicitud_id) ||
          null,
      }));

      setServicios(vista);
      guardarCache(vista);
      setMensaje("");
    } catch (err) {
      console.error("Error general servicios admin:", err);
      setError("Ocurrió un error al sincronizar servicios.");
    } finally {
      setSincronizando(false);
    }
  }, [guardarCache]);

  useEffect(() => {
    leerCache();
    cargarServicios();
  }, [leerCache, cargarServicios]);

  const metricas = useMemo(() => {
    return {
      total: servicios.length,
      activos: servicios.filter((s) =>
        ["confirmado", "en_camino", "en_curso"].includes(s.estado)
      ).length,
      finalizados: servicios.filter((s) => s.estado === "finalizado").length,
      cancelados: servicios.filter((s) => s.estado === "cancelado").length,
    };
  }, [servicios]);

  const serviciosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return servicios.filter((servicio) => {
      const coincideTexto =
        !texto ||
        servicio.solicitud?.titulo?.toLowerCase().includes(texto) ||
        servicio.solicitud?.descripcion?.toLowerCase().includes(texto) ||
        servicio.solicitud?.zona?.toLowerCase().includes(texto) ||
        servicio.cliente?.nombre_completo?.toLowerCase().includes(texto) ||
        servicio.trabajador?.nombre_completo?.toLowerCase().includes(texto) ||
        servicio.estado?.toLowerCase().includes(texto);

      const esActivo = ["confirmado", "en_camino", "en_curso"].includes(
        servicio.estado
      );

      const coincideFiltro =
        filtro === "todos" ||
        (filtro === "activos" && esActivo) ||
        (filtro === "finalizados" && servicio.estado === "finalizado") ||
        (filtro === "cancelados" && servicio.estado === "cancelado");

      return coincideTexto && coincideFiltro;
    });
  }, [servicios, busqueda, filtro]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <ClipboardList size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    Moderación de servicios
                  </h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Revisa servicios activos, finalizados y posibles conflictos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cargarServicios}
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

      {mensaje && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard titulo="Total" valor={metricas.total} />
        <MetricCard titulo="Activos" valor={metricas.activos} ambar />
        <MetricCard titulo="Finalizados" valor={metricas.finalizados} verde />
        <MetricCard titulo="Cancelados" valor={metricas.cancelados} rojo />
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
              placeholder="Buscar por servicio, cliente, trabajador, zona o estado..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FiltroButton
              activo={filtro === "todos"}
              onClick={() => setFiltro("todos")}
            >
              Todos
            </FiltroButton>

            <FiltroButton
              activo={filtro === "activos"}
              onClick={() => setFiltro("activos")}
            >
              Activos
            </FiltroButton>

            <FiltroButton
              activo={filtro === "finalizados"}
              onClick={() => setFiltro("finalizados")}
            >
              Finalizados
            </FiltroButton>

            <FiltroButton
              activo={filtro === "cancelados"}
              onClick={() => setFiltro("cancelados")}
            >
              Cancelados
            </FiltroButton>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {serviciosFiltrados.length === 0 ? (
          <EmptyCard texto="No se encontraron servicios con esos filtros." />
        ) : (
          serviciosFiltrados.map((servicio) => (
            <article
              key={servicio.id}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <ShieldCheck size={22} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900">
                          {servicio.solicitud?.titulo || "Servicio sin título"}
                        </h3>

                        <EstadoBadge estado={servicio.estado} />
                      </div>

                      <p className="text-sm text-slate-500">
                        Creado: {formatearFecha(servicio.creado_en)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-slate-400">
                    ID servicio: {servicio.id.slice(0, 8)}
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <p className="text-sm leading-relaxed text-slate-700">
                  {servicio.solicitud?.descripcion ||
                    "No hay descripción registrada para este servicio."}
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <UsuarioBox titulo="Cliente" perfil={servicio.cliente} />
                  <UsuarioBox titulo="Trabajador" perfil={servicio.trabajador} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <InfoBox
                    titulo="Zona"
                    valor={servicio.solicitud?.zona || "No registrada"}
                    icon={<MapPin size={16} />}
                  />

                  <InfoBox
                    titulo="Presupuesto"
                    valor={
                      servicio.solicitud?.presupuesto
                        ? `$${Number(servicio.solicitud.presupuesto).toFixed(2)}`
                        : "No especificado"
                    }
                    icon={<ClipboardList size={16} />}
                  />

                  <InfoBox
                    titulo="Estado solicitud"
                    valor={servicio.solicitud?.estado || "No disponible"}
                    icon={<Clock3 size={16} />}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <InfoBox
                    titulo="Inicio programado"
                    valor={
                      servicio.inicio_programado
                        ? formatearFecha(servicio.inicio_programado)
                        : "No definido"
                    }
                    icon={<Clock3 size={16} />}
                  />

                  <InfoBox
                    titulo="Iniciado"
                    valor={
                      servicio.iniciado_en
                        ? formatearFecha(servicio.iniciado_en)
                        : "No iniciado"
                    }
                    icon={<CheckCircle2 size={16} />}
                  />

                  <InfoBox
                    titulo="Finalizado"
                    valor={
                      servicio.finalizado_en
                        ? formatearFecha(servicio.finalizado_en)
                        : "No finalizado"
                    }
                    icon={<XCircle size={16} />}
                  />
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
  verde = false,
  rojo = false,
  ambar = false,
}: {
  titulo: string;
  valor: number;
  verde?: boolean;
  rojo?: boolean;
  ambar?: boolean;
}) {
  let clases = "bg-slate-100 text-slate-700";
  if (verde) clases = "bg-emerald-100 text-emerald-700";
  if (rojo) clases = "bg-red-100 text-red-700";
  if (ambar) clases = "bg-amber-100 text-amber-700";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${clases}`}
      >
        <ClipboardList size={21} />
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

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "finalizado") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        Finalizado
      </span>
    );
  }

  if (estado === "cancelado") {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Cancelado
      </span>
    );
  }

  if (["confirmado", "en_camino", "en_curso"].includes(estado)) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        {estado.replace("_", " ")}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {estado}
    </span>
  );
}

function UsuarioBox({
  titulo,
  perfil,
}: {
  titulo: string;
  perfil?: Perfil | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <UserRound size={16} className="text-slate-500" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {titulo}
        </p>
      </div>

      <p className="mt-1 text-sm font-bold text-slate-800">
        {perfil?.nombre_completo || "No disponible"}
      </p>

      <p className="text-xs text-slate-500">
        {perfil?.correo || "Sin correo"}
      </p>

      {perfil && !perfil.activo && (
        <p className="mt-1 text-xs font-semibold text-red-600">
          Usuario suspendido
        </p>
      )}
    </div>
  );
}

function InfoBox({
  titulo,
  valor,
  icon,
}: {
  titulo: string;
  valor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {titulo}
        </p>
      </div>

      <p className="mt-1 text-sm font-bold text-slate-800">{valor}</p>
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

function formatearFecha(fecha: string) {
  if (!fecha) return "";

  try {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(fecha));
  } catch {
    return "";
  }
}