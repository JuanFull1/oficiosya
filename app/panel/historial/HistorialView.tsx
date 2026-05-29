"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Flag,
  History,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Star,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";

type TipoItem =
  | "solicitud"
  | "propuesta"
  | "estado"
  | "pago"
  | "reporte"
  | "resena";

type PerfilInfo = {
  id: string;
  nombre_completo: string | null;
  foto_url: string | null;
  zona: string | null;
  verificado?: boolean | null;
};

type SolicitudInfo = {
  id: string;
  cliente_id?: string;
  titulo: string | null;
  descripcion?: string | null;
  zona: string | null;
  estado?: string;
  presupuesto?: number | null;
  creado_en?: string;
};

type ServicioInfo = {
  id: string;
  solicitud_id: string;
  cliente_id: string;
  trabajador_id: string;
  estado: string;
  creado_en: string;
  finalizado_en: string | null;
  solicitud?: SolicitudInfo | null;
};

type HistorialEstado = {
  id: string;
  servicio_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  cambiado_por: string | null;
  notas: string | null;
  creado_en: string;
  cambiado?: PerfilInfo | null;
  servicio?: ServicioInfo | null;
};

type PropuestaInfo = {
  id: string;
  solicitud_id: string;
  trabajador_id: string;
  mensaje: string;
  valor_estimado: number | null;
  estado: string;
  creado_en: string;
  solicitud?: SolicitudInfo | null;
};

type PagoInfo = {
  id: string;
  servicio_id: string;
  cliente_id: string;
  trabajador_id: string;
  monto: number;
  metodo_pago: string | null;
  referencia_pago: string | null;
  comprobante_url: string | null;
  estado: string;
  reportado_en: string | null;
  confirmado_en: string | null;
  observacion: string | null;
  creado_en: string;
  servicio?: ServicioInfo | null;
};

type ReporteInfo = {
  id: string;
  reportante_id: string;
  usuario_reportado_id: string;
  servicio_id: string | null;
  motivo: string;
  descripcion: string | null;
  evidencia_url: string | null;
  estado: string;
  creado_en: string;
};

type ResenaInfo = {
  id: string;
  servicio_id: string;
  autor_id: string;
  usuario_calificado_id: string;
  puntuacion: number;
  comentario: string | null;
  creado_en: string;
  servicio?: ServicioInfo | null;
};

type IconoHistorial =
  | "solicitud"
  | "servicio"
  | "estado"
  | "propuesta"
  | "pago"
  | "reporte"
  | "resena"
  | "mensaje";

type ItemHistorial = {
  id: string;
  tipo: TipoItem;
  titulo: string;
  descripcion: string;
  detalle: string;
  fecha: string;
  estado?: string;
  icono: IconoHistorial;
};

type CacheHistorial = {
  usuarioId: string;
  items: ItemHistorial[];
};

const CACHE_KEY = "oficiosya-historial-cache";

export default function HistorialView() {
  const { estilos, modoOscuro } = usePanelContext();

  const [usuarioId, setUsuarioId] = useState("");
  const [items, setItems] = useState<ItemHistorial[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | TipoItem>("todos");
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");

  const guardarCache = (data: CacheHistorial) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      console.warn("No se pudo guardar el caché del historial.");
    }
  };

  const cargarCache = () => {
    try {
      const cache = localStorage.getItem(CACHE_KEY);
      if (!cache) return;

      const data = JSON.parse(cache) as CacheHistorial;
      setUsuarioId(data.usuarioId || "");
      setItems(data.items || []);
    } catch {
      console.warn("No se pudo leer el caché del historial.");
    }
  };

  const cargarHistorial = async () => {
    try {
      setActualizando(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("No se encontró el usuario autenticado.");
        return;
      }

      setUsuarioId(user.id);

      const [
        serviciosRes,
        solicitudesRes,
        propuestasTrabajadorRes,
        pagosRes,
        reportesRes,
        resenasRealizadasRes,
        resenasRecibidasRes,
      ] = await Promise.all([
        supabase
          .from("servicios")
          .select(
            `
            id,
            solicitud_id,
            cliente_id,
            trabajador_id,
            estado,
            creado_en,
            finalizado_en,
            solicitud:solicitudes_servicio (
              id,
              cliente_id,
              titulo,
              descripcion,
              zona,
              estado,
              presupuesto,
              creado_en
            )
          `
          )
          .or(`cliente_id.eq.${user.id},trabajador_id.eq.${user.id}`)
          .order("creado_en", { ascending: false }),

        supabase
          .from("solicitudes_servicio")
          .select(
            `
            id,
            cliente_id,
            titulo,
            descripcion,
            zona,
            estado,
            presupuesto,
            creado_en
          `
          )
          .eq("cliente_id", user.id)
          .order("creado_en", { ascending: false }),

        supabase
          .from("propuestas_servicio")
          .select(
            `
            id,
            solicitud_id,
            trabajador_id,
            mensaje,
            valor_estimado,
            estado,
            creado_en,
            solicitud:solicitudes_servicio (
              id,
              cliente_id,
              titulo,
              descripcion,
              zona,
              estado,
              presupuesto,
              creado_en
            )
          `
          )
          .eq("trabajador_id", user.id)
          .order("creado_en", { ascending: false }),

        supabase
          .from("pagos_manuales")
          .select(
            `
            id,
            servicio_id,
            cliente_id,
            trabajador_id,
            monto,
            metodo_pago,
            referencia_pago,
            comprobante_url,
            estado,
            reportado_en,
            confirmado_en,
            observacion,
            creado_en,
            servicio:servicios (
              id,
              solicitud_id,
              cliente_id,
              trabajador_id,
              estado,
              creado_en,
              finalizado_en,
              solicitud:solicitudes_servicio (
                id,
                titulo,
                zona
              )
            )
          `
          )
          .or(`cliente_id.eq.${user.id},trabajador_id.eq.${user.id}`)
          .order("creado_en", { ascending: false }),

        supabase
          .from("reportes")
          .select(
            `
            id,
            reportante_id,
            usuario_reportado_id,
            servicio_id,
            motivo,
            descripcion,
            evidencia_url,
            estado,
            creado_en
          `
          )
          .or(`reportante_id.eq.${user.id},usuario_reportado_id.eq.${user.id}`)
          .order("creado_en", { ascending: false }),

        supabase
          .from("resenas")
          .select(
            `
            id,
            servicio_id,
            autor_id,
            usuario_calificado_id,
            puntuacion,
            comentario,
            creado_en,
            servicio:servicios (
              id,
              solicitud_id,
              cliente_id,
              trabajador_id,
              estado,
              creado_en,
              finalizado_en,
              solicitud:solicitudes_servicio (
                id,
                titulo,
                zona
              )
            )
          `
          )
          .eq("autor_id", user.id)
          .order("creado_en", { ascending: false }),

        supabase
          .from("resenas")
          .select(
            `
            id,
            servicio_id,
            autor_id,
            usuario_calificado_id,
            puntuacion,
            comentario,
            creado_en,
            servicio:servicios (
              id,
              solicitud_id,
              cliente_id,
              trabajador_id,
              estado,
              creado_en,
              finalizado_en,
              solicitud:solicitudes_servicio (
                id,
                titulo,
                zona
              )
            )
          `
          )
          .eq("usuario_calificado_id", user.id)
          .order("creado_en", { ascending: false }),
      ]);

      if (serviciosRes.error) throw serviciosRes.error;
      if (solicitudesRes.error) throw solicitudesRes.error;
      if (propuestasTrabajadorRes.error) throw propuestasTrabajadorRes.error;
      if (pagosRes.error) throw pagosRes.error;
      if (reportesRes.error) throw reportesRes.error;
      if (resenasRealizadasRes.error) throw resenasRealizadasRes.error;
      if (resenasRecibidasRes.error) throw resenasRecibidasRes.error;

      const servicios = (serviciosRes.data || []) as unknown as ServicioInfo[];
      const solicitudes = (solicitudesRes.data || []) as unknown as SolicitudInfo[];
      const propuestasTrabajador = (propuestasTrabajadorRes.data ||
        []) as unknown as PropuestaInfo[];
      const pagos = (pagosRes.data || []) as unknown as PagoInfo[];
      const reportes = (reportesRes.data || []) as unknown as ReporteInfo[];
      const resenasRealizadas = (resenasRealizadasRes.data || []) as unknown as ResenaInfo[];
      const resenasRecibidas = (resenasRecibidasRes.data || []) as unknown as ResenaInfo[];

      const idsServicios = servicios.map((servicio) => servicio.id);

      let historialEstados: HistorialEstado[] = [];

      if (idsServicios.length > 0) {
        const { data, error } = await supabase
          .from("historial_estados_servicio")
          .select(
            `
            id,
            servicio_id,
            estado_anterior,
            estado_nuevo,
            cambiado_por,
            notas,
            creado_en,
            cambiado:perfiles!historial_estados_servicio_cambiado_por_fkey (
              id,
              nombre_completo,
              foto_url,
              zona,
              verificado
            ),
            servicio:servicios (
              id,
              solicitud_id,
              cliente_id,
              trabajador_id,
              estado,
              creado_en,
              finalizado_en,
              solicitud:solicitudes_servicio (
                id,
                titulo,
                zona
              )
            )
          `
          )
          .in("servicio_id", idsServicios)
          .order("creado_en", { ascending: false });

        if (error) throw error;

        historialEstados = (data || []) as unknown as HistorialEstado[];
      }

      const nuevosItems: ItemHistorial[] = [
        ...solicitudes.map((solicitud) => ({
          id: `solicitud-${solicitud.id}`,
          tipo: "solicitud" as TipoItem,
          titulo: "Solicitud publicada",
          descripcion: solicitud.titulo || "Solicitud de servicio",
          detalle: solicitud.zona || "Zona no definida",
          fecha: solicitud.creado_en || "",
          estado: solicitud.estado,
          icono: "solicitud" as IconoHistorial,
        })),

        ...servicios.map((servicio) => ({
          id: `servicio-${servicio.id}`,
          tipo: "estado" as TipoItem,
          titulo: "Servicio creado",
          descripcion: servicio.solicitud?.titulo || "Servicio confirmado",
          detalle: servicio.solicitud?.zona || "Zona no definida",
          fecha: servicio.creado_en,
          estado: servicio.estado,
          icono: "servicio" as IconoHistorial,
        })),

        ...historialEstados.map((historial) => ({
          id: `estado-${historial.id}`,
          tipo: "estado" as TipoItem,
          titulo: "Cambio de estado",
          descripcion: `${formatearEstado(historial.estado_anterior)} → ${formatearEstado(
            historial.estado_nuevo
          )}`,
          detalle:
            historial.notas ||
            historial.servicio?.solicitud?.titulo ||
            "Actualización del servicio",
          fecha: historial.creado_en,
          estado: historial.estado_nuevo,
          icono: "estado" as IconoHistorial,
        })),

        ...propuestasTrabajador.map((propuesta) => ({
          id: `propuesta-${propuesta.id}`,
          tipo: "propuesta" as TipoItem,
          titulo: "Propuesta enviada",
          descripcion: propuesta.solicitud?.titulo || "Solicitud de servicio",
          detalle: propuesta.valor_estimado
            ? `Valor estimado: $${Number(propuesta.valor_estimado).toFixed(2)}`
            : propuesta.mensaje,
          fecha: propuesta.creado_en,
          estado: propuesta.estado,
          icono: "propuesta" as IconoHistorial,
        })),

        ...pagos.map((pago) => ({
          id: `pago-${pago.id}`,
          tipo: "pago" as TipoItem,
          titulo: "Movimiento de pago",
          descripcion: pago.servicio?.solicitud?.titulo || "Pago manual",
          detalle: `Monto: $${Number(pago.monto || 0).toFixed(2)}${
            pago.metodo_pago ? ` · ${pago.metodo_pago}` : ""
          }`,
          fecha: pago.confirmado_en || pago.reportado_en || pago.creado_en,
          estado: pago.estado,
          icono: "pago" as IconoHistorial,
        })),

        ...reportes.map((reporte) => ({
          id: `reporte-${reporte.id}`,
          tipo: "reporte" as TipoItem,
          titulo:
            reporte.reportante_id === user.id ? "Reporte enviado" : "Reporte recibido",
          descripcion: reporte.motivo,
          detalle: reporte.descripcion || "Sin descripción adicional",
          fecha: reporte.creado_en,
          estado: reporte.estado,
          icono: "reporte" as IconoHistorial,
        })),

        ...resenasRealizadas.map((resena) => ({
          id: `resena-realizada-${resena.id}`,
          tipo: "resena" as TipoItem,
          titulo: "Reseña realizada",
          descripcion: resena.servicio?.solicitud?.titulo || "Servicio finalizado",
          detalle: `${resena.puntuacion}/5 estrellas`,
          fecha: resena.creado_en,
          estado: "realizada",
          icono: "resena" as IconoHistorial,
        })),

        ...resenasRecibidas.map((resena) => ({
          id: `resena-recibida-${resena.id}`,
          tipo: "resena" as TipoItem,
          titulo: "Reseña recibida",
          descripcion: resena.servicio?.solicitud?.titulo || "Servicio finalizado",
          detalle: `${resena.puntuacion}/5 estrellas`,
          fecha: resena.creado_en,
          estado: "recibida",
          icono: "resena" as IconoHistorial,
        })),
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setItems(nuevosItems);
      guardarCache({ usuarioId: user.id, items: nuevosItems });
    } catch (error) {
      console.error("Error al cargar historial:", error);
      setError("No se pudo cargar el historial.");
    } finally {
      setActualizando(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      cargarCache();
      cargarHistorial();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const itemsFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return items.filter((item) => {
      const coincideFiltro = filtro === "todos" || item.tipo === filtro;

      const coincideBusqueda =
        !texto ||
        item.titulo.toLowerCase().includes(texto) ||
        item.descripcion.toLowerCase().includes(texto) ||
        item.detalle.toLowerCase().includes(texto) ||
        formatearEstado(item.estado).toLowerCase().includes(texto);

      return coincideFiltro && coincideBusqueda;
    });
  }, [items, busqueda, filtro]);

  const totalServicios = items.filter((item) => item.tipo === "estado").length;
  const totalPagos = items.filter((item) => item.tipo === "pago").length;
  const totalReportes = items.filter((item) => item.tipo === "reporte").length;
  const totalResenas = items.filter((item) => item.tipo === "resena").length;

  return (
    <div className="flex flex-col gap-4">
      <section className={`rounded-[18px] border p-5 sm:p-6 ${estilos.tarjeta}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[#0B3C7F] mb-3 ${
                modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
              }`}
            >
              <History className="w-4 h-4" />
              Actividad de la cuenta
            </div>

            <h1 className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}>
              Historial
            </h1>

            <p className={`mt-2 ${estilos.textoSecundario}`}>
              Revisa tus solicitudes, propuestas, cambios de estado, reportes y
              reseñas en un solo lugar.
            </p>
          </div>

          <button
            onClick={cargarHistorial}
            disabled={actualizando}
            className="rounded-2xl px-4 py-3 font-bold bg-[#0B3C7F] hover:bg-[#082f63] text-white transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${actualizando ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ResumenCard
          icon={<ClipboardList className="w-5 h-5" />}
          titulo="Servicios"
          valor={String(totalServicios)}
          detalle="Estados y avances"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />


        <ResumenCard
          icon={<Flag className="w-5 h-5" />}
          titulo="Reportes"
          valor={String(totalReportes)}
          detalle="Enviados o recibidos"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />

        <ResumenCard
          icon={<Star className="w-5 h-5" />}
          titulo="Reseñas"
          valor={String(totalResenas)}
          detalle="Realizadas y recibidas"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      <section className={`rounded-[18px] border p-4 ${estilos.tarjeta}`}>
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por servicio, estado, pago, reporte o reseña..."
              className={`w-full rounded-2xl border py-3 pl-10 pr-4 outline-none ${
                modoOscuro
                  ? "bg-[#111827] border-[#334155] text-white placeholder:text-gray-500"
                  : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-400"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
            <FiltroButton
              activo={filtro === "todos"}
              texto="Todos"
              onClick={() => setFiltro("todos")}
              modoOscuro={modoOscuro}
            />
            <FiltroButton
              activo={filtro === "solicitud"}
              texto="Solicitudes"
              onClick={() => setFiltro("solicitud")}
              modoOscuro={modoOscuro}
            />
            <FiltroButton
              activo={filtro === "propuesta"}
              texto="Propuestas"
              onClick={() => setFiltro("propuesta")}
              modoOscuro={modoOscuro}
            />
            <FiltroButton
              activo={filtro === "estado"}
              texto="Estados"
              onClick={() => setFiltro("estado")}
              modoOscuro={modoOscuro}
            />
            
            <FiltroButton
              activo={filtro === "reporte"}
              texto="Reportes"
              onClick={() => setFiltro("reporte")}
              modoOscuro={modoOscuro}
            />
            <FiltroButton
              activo={filtro === "resena"}
              texto="Reseñas"
              onClick={() => setFiltro("resena")}
              modoOscuro={modoOscuro}
            />
          </div>
        </div>
      </section>

      {itemsFiltrados.length === 0 ? (
        <Vacio modoOscuro={modoOscuro} />
      ) : (
        <section className={`rounded-[18px] border p-4 sm:p-5 ${estilos.tarjeta}`}>
          <div className="relative">
            <div
              className={`absolute left-6 top-2 bottom-2 w-px ${
                modoOscuro ? "bg-[#334155]" : "bg-gray-200"
              }`}
            />

            <div className="space-y-4">
              {itemsFiltrados.map((item) => (
                <HistorialCard
                  key={item.id}
                  item={item}
                  estilos={estilos}
                  modoOscuro={modoOscuro}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function IconoHistorialView({ tipo }: { tipo: IconoHistorial }) {
  if (tipo === "solicitud") return <FileText className="w-5 h-5" />;
  if (tipo === "servicio") return <ClipboardList className="w-5 h-5" />;
  if (tipo === "estado") return <History className="w-5 h-5" />;
  if (tipo === "propuesta") return <Send className="w-5 h-5" />;
  if (tipo === "pago") return <CreditCard className="w-5 h-5" />;
  if (tipo === "reporte") return <Flag className="w-5 h-5" />;
  if (tipo === "resena") return <Star className="w-5 h-5" />;
  if (tipo === "mensaje") return <MessageSquare className="w-5 h-5" />;

  return <UserRound className="w-5 h-5" />;
}

function HistorialCard({
  item,
  estilos,
  modoOscuro,
}: {
  item: ItemHistorial;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
}) {
  return (
    <article className="relative flex gap-4">
      <div className="relative z-10">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[#0B3C7F] border ${
            modoOscuro
              ? "bg-[#172554] border-[#334155]"
              : "bg-[#e7f0ff] border-blue-100"
          }`}
        >
         <IconoHistorialView tipo={item.icono} />
        </div>
      </div>

      <div
        className={`flex-1 rounded-[22px] border p-4 ${
          modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-white border-gray-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-extrabold ${estilos.textoPrincipal}`}>
                {item.titulo}
              </h3>

              {item.estado && (
                <span className={claseEstado(item.estado, modoOscuro)}>
                  {formatearEstado(item.estado)}
                </span>
              )}
            </div>

            <p className={`mt-1 text-sm font-semibold ${estilos.textoPrincipal}`}>
              {item.descripcion}
            </p>

            <p className={`mt-1 text-sm ${estilos.textoSecundario}`}>
              {item.detalle}
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
              modoOscuro ? "bg-[#0f172a] text-gray-300" : "bg-gray-100 text-gray-600"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            {formatearFecha(item.fecha)}
          </div>
        </div>
      </div>
    </article>
  );
}

function ResumenCard({
  icon,
  titulo,
  valor,
  detalle,
  estilos,
  modoOscuro,
}: {
  icon: ReactNode;
  titulo: string;
  valor: string;
  detalle: string;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border p-5 ${
        modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-[#0B3C7F] ${
            modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
          }`}
        >
          {icon}
        </div>

        <p className={`text-2xl font-extrabold ${estilos.textoPrincipal}`}>
          {valor}
        </p>
      </div>

      <h3 className={`mt-4 font-extrabold ${estilos.textoPrincipal}`}>{titulo}</h3>
      <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>{detalle}</p>
    </div>
  );
}

function FiltroButton({
  activo,
  texto,
  onClick,
  modoOscuro,
}: {
  activo: boolean;
  texto: string;
  onClick: () => void;
  modoOscuro: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-3 rounded-2xl text-sm font-bold transition ${
        activo
          ? "bg-[#0B3C7F] text-white"
          : modoOscuro
          ? "bg-[#111827] text-white border border-[#334155]"
          : "bg-[#f3f4f6] text-gray-700"
      }`}
    >
      {texto}
    </button>
  );
}

function Vacio({ modoOscuro }: { modoOscuro: boolean }) {
  return (
    <div
      className={`rounded-[22px] border border-dashed p-8 text-center ${
        modoOscuro
          ? "bg-[#111827] border-[#334155] text-gray-300"
          : "bg-white border-gray-300 text-gray-600"
      }`}
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center mb-4">
        <History className="w-7 h-7" />
      </div>

      <p className="font-bold">No hay movimientos para mostrar.</p>
    </div>
  );
}

function formatearFecha(fecha: string | null) {
  if (!fecha) return "Sin fecha";

  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "Sin fecha";

  return valor.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatearEstado(estado?: string | null) {
  if (!estado) return "Sin estado";

  const textos: Record<string, string> = {
    solicitado: "Solicitado",
    en_negociacion: "En negociación",
    confirmado: "Confirmado",
    en_camino: "En camino",
    en_curso: "En curso",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
    enviada: "Enviada",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    cancelada: "Cancelada",
    pendiente: "Pendiente",
    reportado_por_cliente: "Reportado por cliente",
    resuelto: "Resuelto",
    en_revision: "En revisión",
    realizada: "Realizada",
    recibida: "Recibida",
  };

  return textos[estado] || estado.replaceAll("_", " ");
}

function claseEstado(estado: string, modoOscuro: boolean) {
  const limpio = estado.toLowerCase();

  if (
    limpio.includes("finalizado") ||
    limpio.includes("confirmado") ||
    limpio.includes("aceptada") ||
    limpio.includes("resuelto") ||
    limpio.includes("realizada") ||
    limpio.includes("recibida")
  ) {
    return modoOscuro
      ? "px-3 py-1 rounded-full text-xs font-bold bg-green-950 text-green-300"
      : "px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700";
  }

  if (
    limpio.includes("cancelado") ||
    limpio.includes("rechazado") ||
    limpio.includes("rechazada")
  ) {
    return "px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700";
  }

  if (limpio.includes("camino") || limpio.includes("curso") || limpio.includes("revision")) {
    return modoOscuro
      ? "px-3 py-1 rounded-full text-xs font-bold bg-blue-950 text-blue-300"
      : "px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700";
  }

  return modoOscuro
    ? "px-3 py-1 rounded-full text-xs font-bold bg-[#0f172a] text-gray-300"
    : "px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700";
}