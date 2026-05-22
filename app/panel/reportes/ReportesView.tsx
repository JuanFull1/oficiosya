"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileImage,
  FileWarning,
  Flag,
  ImagePlus,
  Loader2,
  MessageSquare,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";

type TabReporte = "crear" | "enviados" | "recibidos" | "admin";

type Perfil = {
  id: string;
  nombre_completo: string;
  correo: string | null;
  telefono: string | null;
  foto_url: string | null;
  activo: boolean;
  es_admin: boolean;
};

type Servicio = {
  id: string;
  solicitud_id: string;
  cliente_id: string;
  trabajador_id: string;
  estado: string;
  creado_en: string;
};

type Solicitud = {
  id: string;
  titulo: string;
  descripcion: string;
};

type Reporte = {
  id: string;
  reportante_id: string;
  usuario_reportado_id: string;
  servicio_id: string | null;
  motivo: string;
  descripcion: string | null;
  evidencia_url: string | null;
  estado: "pendiente" | "en_revision" | "resuelto" | "rechazado";
  revisado_por: string | null;
  revisado_en: string | null;
  creado_en: string;
  actualizado_en: string;
};

type ReporteVista = Reporte & {
  reportante?: Perfil | null;
  reportado?: Perfil | null;
  servicio?: Servicio | null;
  solicitud?: Solicitud | null;
};

type CacheReportes = {
  usuarioId: string;
  perfil: Perfil | null;
  servicios: Servicio[];
  solicitudes: Solicitud[];
  perfiles: Perfil[];
  reportes: ReporteVista[];
  reportesAdmin: ReporteVista[];
};

const CACHE_KEY = "oficiosya-reportes-cache";
const BUCKET_EVIDENCIAS = "evidencias-reportes";

const motivos = [
  { value: "mal_comportamiento", label: "Mal comportamiento" },
  { value: "incumplimiento", label: "Incumplimiento del servicio" },
  { value: "datos_falsos", label: "Datos falsos" },
  { value: "cobro_indebido", label: "Cobro indebido" },
  { value: "servicio_mal_realizado", label: "Servicio mal realizado" },
  { value: "otro", label: "Otro motivo" },
];

const estadosReporte = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  resuelto: "Resuelto",
  rechazado: "Rechazado",
};

const cacheVacio: CacheReportes = {
  usuarioId: "",
  perfil: null,
  servicios: [],
  solicitudes: [],
  perfiles: [],
  reportes: [],
  reportesAdmin: [],
};

function leerCacheInicial(): CacheReportes {
  if (typeof window === "undefined") return cacheVacio;

  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return cacheVacio;

    const data = JSON.parse(cache) as Partial<CacheReportes>;

    return {
      usuarioId: data.usuarioId || "",
      perfil: data.perfil || null,
      servicios: data.servicios || [],
      solicitudes: data.solicitudes || [],
      perfiles: data.perfiles || [],
      reportes: data.reportes || [],
      reportesAdmin: data.reportesAdmin || [],
    };
  } catch {
    return cacheVacio;
  }
}

function guardarCache(data: CacheReportes) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    console.warn("No se pudo guardar caché de reportes.");
  }
}

export default function ReportesView() {
  const { modoOscuro, estilos } = usePanelContext();

  const [cacheInicial] = useState<CacheReportes>(() => leerCacheInicial());

  const [usuarioId, setUsuarioId] = useState(cacheInicial.usuarioId);
  const [perfil, setPerfil] = useState<Perfil | null>(cacheInicial.perfil);
  const [servicios, setServicios] = useState<Servicio[]>(cacheInicial.servicios);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(cacheInicial.solicitudes);
  const [perfiles, setPerfiles] = useState<Perfil[]>(cacheInicial.perfiles);
  const [reportes, setReportes] = useState<ReporteVista[]>(cacheInicial.reportes);
  const [reportesAdmin, setReportesAdmin] = useState<ReporteVista[]>(
    cacheInicial.reportesAdmin
  );

  const [tab, setTab] = useState<TabReporte>("crear");
  const [busqueda, setBusqueda] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [servicioSeleccionado, setServicioSeleccionado] = useState("");
  const [usuarioReportadoId, setUsuarioReportadoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState("");

  const esAdmin = perfil?.es_admin === true;

  const serviciosParaReportar = useMemo(() => {
    return servicios.filter((servicio) => servicio.estado !== "cancelado");
  }, [servicios]);

  const reportesCreadosPorMi = useMemo(() => {
    return reportes.filter((item) => item.reportante_id === usuarioId);
  }, [reportes, usuarioId]);

  const reportesContraMi = useMemo(() => {
    return reportes.filter((item) => item.usuario_reportado_id === usuarioId);
  }, [reportes, usuarioId]);

  const servicioActual = useMemo(() => {
    return servicios.find((item) => item.id === servicioSeleccionado) || null;
  }, [servicioSeleccionado, servicios]);

  const solicitudActual = useMemo(() => {
    if (!servicioActual) return null;
    return solicitudes.find((item) => item.id === servicioActual.solicitud_id) || null;
  }, [servicioActual, solicitudes]);

  const usuarioReportadoActual = useMemo(() => {
    return perfiles.find((item) => item.id === usuarioReportadoId) || null;
  }, [usuarioReportadoId, perfiles]);

  const cargarDesdeCache = useCallback(() => {
    const cache = leerCacheInicial();

    if (cache.usuarioId) {
      setUsuarioId(cache.usuarioId);
      setPerfil(cache.perfil);
      setServicios(cache.servicios);
      setSolicitudes(cache.solicitudes);
      setPerfiles(cache.perfiles);
      setReportes(cache.reportes);
      setReportesAdmin(cache.reportesAdmin || []);
    }
  }, []);

  const armarReportesVista = useCallback(
    (
      baseReportes: Reporte[],
      baseServicios: Servicio[],
      baseSolicitudes: Solicitud[],
      basePerfiles: Perfil[]
    ): ReporteVista[] => {
      return baseReportes.map((reporte) => {
        const servicio =
          baseServicios.find((item) => item.id === reporte.servicio_id) || null;

        const solicitud = servicio
          ? baseSolicitudes.find((item) => item.id === servicio.solicitud_id) || null
          : null;

        const reportante =
          basePerfiles.find((item) => item.id === reporte.reportante_id) || null;

        const reportado =
          basePerfiles.find((item) => item.id === reporte.usuario_reportado_id) ||
          null;

        return {
          ...reporte,
          servicio,
          solicitud,
          reportante,
          reportado,
        };
      });
    },
    []
  );

  const cargarReportes = useCallback(async () => {
    try {
      setSincronizando(true);
      setError("");
      setMensaje("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("No se encontró el usuario autenticado.");
        return;
      }

      setUsuarioId(user.id);

      const { data: perfilData, error: perfilError } = await supabase
        .from("perfiles")
        .select("id,nombre_completo,correo,telefono,foto_url,activo,es_admin")
        .eq("id", user.id)
        .single();

      if (perfilError || !perfilData) {
        setError("No se pudo cargar tu perfil.");
        return;
      }

      const nuevoPerfil = perfilData as Perfil;
      setPerfil(nuevoPerfil);

      const { data: serviciosData, error: serviciosError } = await supabase
        .from("servicios")
        .select("id,solicitud_id,cliente_id,trabajador_id,estado,creado_en")
        .or(`cliente_id.eq.${user.id},trabajador_id.eq.${user.id}`)
        .order("creado_en", { ascending: false });

      if (serviciosError) {
        setError("No se pudieron cargar tus servicios.");
        return;
      }

      const nuevosServicios = (serviciosData || []) as Servicio[];

      const solicitudIds = Array.from(
        new Set(nuevosServicios.map((item) => item.solicitud_id).filter(Boolean))
      );

      let nuevasSolicitudes: Solicitud[] = [];

      if (solicitudIds.length > 0) {
        const { data: solicitudesData } = await supabase
          .from("solicitudes_servicio")
          .select("id,titulo,descripcion")
          .in("id", solicitudIds);

        nuevasSolicitudes = (solicitudesData || []) as Solicitud[];
      }

      const usuariosIds = Array.from(
        new Set([
          ...nuevosServicios.map((item) => item.cliente_id),
          ...nuevosServicios.map((item) => item.trabajador_id),
          user.id,
        ])
      );

      let nuevosPerfiles: Perfil[] = [];

      if (usuariosIds.length > 0) {
        const { data: perfilesData } = await supabase
          .from("perfiles")
          .select("id,nombre_completo,correo,telefono,foto_url,activo,es_admin")
          .in("id", usuariosIds);

        nuevosPerfiles = (perfilesData || []) as Perfil[];
      }

      const { data: reportesData, error: reportesError } = await supabase
        .from("reportes")
        .select(
          "id,reportante_id,usuario_reportado_id,servicio_id,motivo,descripcion,evidencia_url,estado,revisado_por,revisado_en,creado_en,actualizado_en"
        )
        .or(`reportante_id.eq.${user.id},usuario_reportado_id.eq.${user.id}`)
        .order("creado_en", { ascending: false });

      if (reportesError) {
        setError("No se pudieron cargar los reportes.");
        return;
      }

      const reportesBase = (reportesData || []) as Reporte[];

      const nuevosReportes = armarReportesVista(
        reportesBase,
        nuevosServicios,
        nuevasSolicitudes,
        nuevosPerfiles
      );

      let nuevosReportesAdmin: ReporteVista[] = [];

      if (nuevoPerfil?.es_admin) {
        const { data: reportesAdminData } = await supabase
          .from("reportes")
          .select(
            "id,reportante_id,usuario_reportado_id,servicio_id,motivo,descripcion,evidencia_url,estado,revisado_por,revisado_en,creado_en,actualizado_en"
          )
          .order("creado_en", { ascending: false });

        const reportesBaseAdmin = (reportesAdminData || []) as Reporte[];

        const adminServicioIds = Array.from(
          new Set(
            reportesBaseAdmin
              .map((item) => item.servicio_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        let serviciosAdmin: Servicio[] = [];

        if (adminServicioIds.length > 0) {
          const { data: serviciosAdminData } = await supabase
            .from("servicios")
            .select("id,solicitud_id,cliente_id,trabajador_id,estado,creado_en")
            .in("id", adminServicioIds);

          serviciosAdmin = (serviciosAdminData || []) as Servicio[];
        }

        const adminSolicitudIds = Array.from(
          new Set(serviciosAdmin.map((item) => item.solicitud_id))
        );

        let solicitudesAdmin: Solicitud[] = [];

        if (adminSolicitudIds.length > 0) {
          const { data: solicitudesAdminData } = await supabase
            .from("solicitudes_servicio")
            .select("id,titulo,descripcion")
            .in("id", adminSolicitudIds);

          solicitudesAdmin = (solicitudesAdminData || []) as Solicitud[];
        }

        const adminUsuariosIds = Array.from(
          new Set([
            ...reportesBaseAdmin.map((item) => item.reportante_id),
            ...reportesBaseAdmin.map((item) => item.usuario_reportado_id),
            ...serviciosAdmin.map((item) => item.cliente_id),
            ...serviciosAdmin.map((item) => item.trabajador_id),
          ])
        );

        let perfilesAdmin: Perfil[] = [];

        if (adminUsuariosIds.length > 0) {
          const { data: perfilesAdminData } = await supabase
            .from("perfiles")
            .select("id,nombre_completo,correo,telefono,foto_url,activo,es_admin")
            .in("id", adminUsuariosIds);

          perfilesAdmin = (perfilesAdminData || []) as Perfil[];
        }

        nuevosReportesAdmin = armarReportesVista(
          reportesBaseAdmin,
          serviciosAdmin,
          solicitudesAdmin,
          perfilesAdmin
        );
      }

      setServicios(nuevosServicios);
      setSolicitudes(nuevasSolicitudes);
      setPerfiles(nuevosPerfiles);
      setReportes(nuevosReportes);
      setReportesAdmin(nuevosReportesAdmin);

      guardarCache({
        usuarioId: user.id,
        perfil: nuevoPerfil,
        servicios: nuevosServicios,
        solicitudes: nuevasSolicitudes,
        perfiles: nuevosPerfiles,
        reportes: nuevosReportes,
        reportesAdmin: nuevosReportesAdmin,
      });
    } catch (error) {
      console.error("Error inesperado al cargar reportes:", error);
      setError("Ocurrió un error inesperado al cargar reportes.");
    } finally {
      setSincronizando(false);
    }
  }, [armarReportesVista]);

  useEffect(() => {
    cargarDesdeCache();

    const timeout = window.setTimeout(() => {
      cargarReportes();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [cargarDesdeCache, cargarReportes]);

  const serviciosOpciones = useMemo(() => {
    return serviciosParaReportar.map((servicio) => {
      const solicitud = solicitudes.find((item) => item.id === servicio.solicitud_id);

      const contraparteId =
        servicio.cliente_id === usuarioId ? servicio.trabajador_id : servicio.cliente_id;

      const contraparte = perfiles.find((item) => item.id === contraparteId);

      return {
        servicio,
        solicitud,
        contraparte,
        contraparteId,
      };
    });
  }, [serviciosParaReportar, solicitudes, perfiles, usuarioId]);

  const actualizarSeleccionServicio = (idServicio: string) => {
    setServicioSeleccionado(idServicio);

    const servicio = servicios.find((item) => item.id === idServicio);

    if (!servicio) {
      setUsuarioReportadoId("");
      return;
    }

    const contraparteId =
      servicio.cliente_id === usuarioId ? servicio.trabajador_id : servicio.cliente_id;

    setUsuarioReportadoId(contraparteId);
  };

  const limpiarFormulario = () => {
    setServicioSeleccionado("");
    setUsuarioReportadoId("");
    setMotivo("");
    setDescripcion("");
    setArchivo(null);
    setVistaPrevia("");
  };

  const subirEvidencia = async (reporteId: string) => {
    if (!archivo || !usuarioId) return null;

    const extension = archivo.name.split(".").pop() || "jpg";
    const nombreArchivo = `${usuarioId}/${reporteId}_${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .upload(nombreArchivo, archivo, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .getPublicUrl(nombreArchivo);

    return data.publicUrl;
  };

  const crearReporte = async () => {
    setError("");
    setMensaje("");

    if (!usuarioId) {
      setError("No se encontró el usuario autenticado.");
      return;
    }

    if (!servicioSeleccionado) {
      setError("Selecciona el servicio relacionado.");
      return;
    }

    if (!usuarioReportadoId) {
      setError("No se pudo identificar al usuario reportado.");
      return;
    }

    if (!motivo) {
      setError("Selecciona el motivo del reporte.");
      return;
    }

    if (usuarioReportadoId === usuarioId) {
      setError("No puedes reportarte a ti mismo.");
      return;
    }

    try {
      setGuardando(true);

      const { data: reporteInsertado, error: insertError } = await supabase
        .from("reportes")
        .insert({
          reportante_id: usuarioId,
          usuario_reportado_id: usuarioReportadoId,
          servicio_id: servicioSeleccionado,
          motivo,
          descripcion: descripcion.trim() || null,
          estado: "pendiente",
        })
        .select(
          "id,reportante_id,usuario_reportado_id,servicio_id,motivo,descripcion,evidencia_url,estado,revisado_por,revisado_en,creado_en,actualizado_en"
        )
        .single();

      if (insertError || !reporteInsertado) {
        setError(insertError?.message || "No se pudo crear el reporte.");
        return;
      }

      let evidenciaUrl: string | null = null;

      if (archivo) {
        evidenciaUrl = await subirEvidencia(reporteInsertado.id);

        const { error: updateError } = await supabase
          .from("reportes")
          .update({ evidencia_url: evidenciaUrl })
          .eq("id", reporteInsertado.id);

        if (updateError) {
          setError(
            "El reporte se creó, pero no se pudo adjuntar la evidencia. Puedes intentarlo nuevamente."
          );
        }
      }

      const reporteFinal: Reporte = {
        ...(reporteInsertado as Reporte),
        evidencia_url: evidenciaUrl,
      };

      const nuevoReporteVista = armarReportesVista(
        [reporteFinal],
        servicios,
        solicitudes,
        perfiles
      )[0];

      const reportesActualizados = [nuevoReporteVista, ...reportes];

      setReportes(reportesActualizados);

      guardarCache({
        usuarioId,
        perfil,
        servicios,
        solicitudes,
        perfiles,
        reportes: reportesActualizados,
        reportesAdmin,
      });

      limpiarFormulario();
      setMensaje("Reporte enviado correctamente.");
      setTab("enviados");
    } catch (error) {
      console.error("Error al crear reporte:", error);
      setError("No se pudo crear el reporte. Revisa la evidencia e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const seleccionarArchivo = (file: File | null) => {
    setArchivo(file);

    if (!file) {
      setVistaPrevia("");
      return;
    }

    const url = URL.createObjectURL(file);
    setVistaPrevia(url);
  };

  const filtrarReportes = useCallback(
    (lista: ReporteVista[]) => {
      const texto = busqueda.trim().toLowerCase();

      if (!texto) return lista;

      return lista.filter((item) => {
        const titulo = item.solicitud?.titulo?.toLowerCase() || "";
        const reportante = item.reportante?.nombre_completo?.toLowerCase() || "";
        const reportado = item.reportado?.nombre_completo?.toLowerCase() || "";
        const motivoTexto = traducirMotivo(item.motivo).toLowerCase();
        const estadoTexto = estadosReporte[item.estado].toLowerCase();

        return (
          titulo.includes(texto) ||
          reportante.includes(texto) ||
          reportado.includes(texto) ||
          motivoTexto.includes(texto) ||
          estadoTexto.includes(texto)
        );
      });
    },
    [busqueda]
  );

  const enviadosFiltrados = useMemo(
    () => filtrarReportes(reportesCreadosPorMi),
    [filtrarReportes, reportesCreadosPorMi]
  );

  const recibidosFiltrados = useMemo(
    () => filtrarReportes(reportesContraMi),
    [filtrarReportes, reportesContraMi]
  );

  const reportesAdminFiltrados = useMemo(
    () => filtrarReportes(reportesAdmin),
    [reportesAdmin, busqueda]
  );

  const actualizarEstadoReporte = async (
    reporte: ReporteVista,
    nuevoEstado: "pendiente" | "en_revision" | "resuelto" | "rechazado"
  ) => {
    setError("");
    setMensaje("");

    if (!esAdmin || !usuarioId) {
      setError("No tienes permisos para revisar reportes.");
      return;
    }

    try {
      const { error } = await supabase
        .from("reportes")
        .update({
          estado: nuevoEstado,
          revisado_por: usuarioId,
          revisado_en: new Date().toISOString(),
        })
        .eq("id", reporte.id);

      if (error) {
        setError(error.message);
        return;
      }

      const actualizar = (item: ReporteVista): ReporteVista =>
        item.id === reporte.id
          ? {
              ...item,
              estado: nuevoEstado,
              revisado_por: usuarioId,
              revisado_en: new Date().toISOString(),
            }
          : item;

      const reportesActualizados = reportes.map(actualizar);
      const adminActualizados = reportesAdmin.map(actualizar);

      setReportes(reportesActualizados);
      setReportesAdmin(adminActualizados);

      guardarCache({
        usuarioId,
        perfil,
        servicios,
        solicitudes,
        perfiles,
        reportes: reportesActualizados,
        reportesAdmin: adminActualizados,
      });

      setMensaje("Estado del reporte actualizado.");
    } catch (error) {
      console.error("Error actualizando reporte:", error);
      setError("No se pudo actualizar el reporte.");
    }
  };

  return (
    <div className="space-y-4">
      <section
        className={`rounded-[18px] border p-5 sm:p-6 ${estilos.tarjeta}`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[#0B3C7F] mb-3 ${
                modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
              }`}
            >
              <Flag className="w-4 h-4" />
              Reportes
            </div>

            <h1 className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}>
              Centro de reportes
            </h1>

            <p className={`mt-2 max-w-3xl ${estilos.textoSecundario}`}>
              Informa problemas relacionados con servicios realizados, revisa tus reportes
              enviados y consulta casos donde hayas sido mencionado.
            </p>
          </div>

          <button
            onClick={cargarReportes}
            disabled={sincronizando}
            className="rounded-2xl px-4 py-3 font-bold bg-[#0B3C7F] hover:bg-[#082f63] text-white transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${sincronizando ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ResumenCard
          icon={<MessageSquareWarning className="w-5 h-5" />}
          titulo="Servicios"
          valor={String(serviciosParaReportar.length)}
          detalle="Disponibles para reportar"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />

        <ResumenCard
          icon={<FileWarning className="w-5 h-5" />}
          titulo="Enviados"
          valor={String(reportesCreadosPorMi.length)}
          detalle="Reportes creados por ti"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />

        <ResumenCard
          icon={<AlertTriangle className="w-5 h-5" />}
          titulo="Recibidos"
          valor={String(reportesContraMi.length)}
          detalle="Casos donde apareces"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />

      </div>

      {(mensaje || error) && (
        <div
          className={`rounded-2xl border px-4 py-3 flex items-start gap-3 ${
            error
              ? "border-red-200 bg-red-50"
              : modoOscuro
              ? "border-green-900 bg-green-950"
              : "border-green-200 bg-green-50"
          }`}
        >
          {error ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          )}

          <p
            className={`text-sm font-medium ${
              error ? "text-red-700" : modoOscuro ? "text-green-300" : "text-green-700"
            }`}
          >
            {error || mensaje}
          </p>
        </div>
      )}

      <section className={`rounded-[18px] border p-4 ${estilos.tarjeta}`}>
        <div className="flex flex-col xl:flex-row gap-3">
          <div className={`grid grid-cols-2 ${esAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-2`}>
            <TabButton
              activo={tab === "crear"}
              texto="Crear"
              onClick={() => setTab("crear")}
              modoOscuro={modoOscuro}
            />
            <TabButton
              activo={tab === "enviados"}
              texto={`Enviados (${reportesCreadosPorMi.length})`}
              onClick={() => setTab("enviados")}
              modoOscuro={modoOscuro}
            />
            <TabButton
              activo={tab === "recibidos"}
              texto={`Recibidos (${reportesContraMi.length})`}
              onClick={() => setTab("recibidos")}
              modoOscuro={modoOscuro}
            />
            {esAdmin && (
  <TabButton
    activo={tab === "admin"}
    texto={`Admin (${reportesAdmin.length})`}
    onClick={() => setTab("admin")}
    modoOscuro={modoOscuro}
  />
)}
          </div>

          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por servicio, usuario, motivo o estado..."
              className={`w-full rounded-2xl border py-3 pl-10 pr-4 outline-none ${
                modoOscuro
                  ? "bg-[#111827] border-[#334155] text-white placeholder:text-gray-500"
                  : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-400"
              }`}
            />
          </div>
        </div>
      </section>

      {tab === "crear" && (
        <FormularioReporte
          serviciosOpciones={serviciosOpciones}
          servicioSeleccionado={servicioSeleccionado}
          actualizarSeleccionServicio={actualizarSeleccionServicio}
          solicitudActual={solicitudActual}
          usuarioReportadoActual={usuarioReportadoActual}
          motivo={motivo}
          setMotivo={setMotivo}
          descripcion={descripcion}
          setDescripcion={setDescripcion}
          archivo={archivo}
          seleccionarArchivo={seleccionarArchivo}
          vistaPrevia={vistaPrevia}
          crearReporte={crearReporte}
          guardando={guardando}
          modoOscuro={modoOscuro}
          estilos={estilos}
        />
      )}

      {tab === "enviados" && (
        <ListaReportes
          titulo="Reportes enviados"
          descripcion="Estos son los reportes que has creado."
          reportes={enviadosFiltrados}
          modoOscuro={modoOscuro}
          estilos={estilos}
          vacio="Aún no has creado reportes."
          tipo="enviados"
        />
      )}

      {tab === "recibidos" && (
        <ListaReportes
          titulo="Reportes recibidos"
          descripcion="Aquí aparecen reportes donde otro usuario te mencionó."
          reportes={recibidosFiltrados}
          modoOscuro={modoOscuro}
          estilos={estilos}
          vacio="No tienes reportes recibidos."
          tipo="recibidos"
        />
      )}

      {tab === "admin" && esAdmin && (
        <ListaAdmin
          reportes={reportesAdminFiltrados}
          modoOscuro={modoOscuro}
          estilos={estilos}
          actualizarEstadoReporte={actualizarEstadoReporte}
        />
      )}
    </div>
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
  estilos: ReturnType<typeof usePanelContext>["estilos"];
  modoOscuro: boolean;
}) {
  return (
    <div className={`rounded-[20px] border p-5 ${estilos.tarjeta}`}>
      <div className="flex items-start justify-between gap-3">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            modoOscuro ? "bg-[#172554] text-[#7fb3ff]" : "bg-[#e7f0ff] text-[#0B3C7F]"
          }`}
        >
          {icon}
        </div>

        <span className={`text-3xl font-black ${estilos.textoPrincipal}`}>
          {valor}
        </span>
      </div>

      <p className={`mt-4 font-extrabold ${estilos.textoPrincipal}`}>{titulo}</p>
      <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>{detalle}</p>
    </div>
  );
}

function TabButton({
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
      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
        activo
          ? "bg-[#0B3C7F] text-white"
          : modoOscuro
          ? "bg-[#111827] text-slate-300 hover:bg-[#1e293b]"
          : "bg-[#f0f2f5] text-gray-600 hover:bg-[#e7f0ff]"
      }`}
    >
      {texto}
    </button>
  );
}

function FormularioReporte({
  serviciosOpciones,
  servicioSeleccionado,
  actualizarSeleccionServicio,
  solicitudActual,
  usuarioReportadoActual,
  motivo,
  setMotivo,
  descripcion,
  setDescripcion,
  archivo,
  seleccionarArchivo,
  vistaPrevia,
  crearReporte,
  guardando,
  modoOscuro,
  estilos,
}: {
  serviciosOpciones: {
    servicio: Servicio;
    solicitud?: Solicitud;
    contraparte?: Perfil;
    contraparteId: string;
  }[];
  servicioSeleccionado: string;
  actualizarSeleccionServicio: (idServicio: string) => void;
  solicitudActual: Solicitud | null;
  usuarioReportadoActual: Perfil | null;
  motivo: string;
  setMotivo: (valor: string) => void;
  descripcion: string;
  setDescripcion: (valor: string) => void;
  archivo: File | null;
  seleccionarArchivo: (file: File | null) => void;
  vistaPrevia: string;
  crearReporte: () => void;
  guardando: boolean;
  modoOscuro: boolean;
  estilos: ReturnType<typeof usePanelContext>["estilos"];
}) {
  return (
    <section className={`rounded-[22px] border p-5 sm:p-6 ${estilos.tarjeta}`}>
      <div className="flex items-start gap-3 mb-6">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            modoOscuro ? "bg-[#172554] text-[#7fb3ff]" : "bg-[#e7f0ff] text-[#0B3C7F]"
          }`}
        >
          <Flag className="w-5 h-5" />
        </div>

        <div>
          <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
            Crear nuevo reporte
          </h2>
          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            Selecciona un servicio y explica el inconveniente de forma clara.
          </p>
        </div>
      </div>

      {serviciosOpciones.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed p-8 text-center ${
            modoOscuro ? "border-[#334155] bg-[#111827]" : "border-gray-300 bg-[#f8fafc]"
          }`}
        >
          <MessageSquare className="w-10 h-10 mx-auto text-gray-400" />
          <p className={`mt-3 font-bold ${estilos.textoPrincipal}`}>
            No tienes servicios para reportar
          </p>
          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            Cuando tengas servicios confirmados o finalizados, podrás reportarlos aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
          <div className="space-y-4">
            <div>
              <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                Servicio relacionado
              </label>
              <select
                value={servicioSeleccionado}
                onChange={(e) => actualizarSeleccionServicio(e.target.value)}
                className={inputClass(modoOscuro)}
              >
                <option value="">Selecciona un servicio</option>
                {serviciosOpciones.map((item) => (
                  <option key={item.servicio.id} value={item.servicio.id}>
                    {(item.solicitud?.titulo || "Servicio sin título") +
                      " - " +
                      (item.contraparte?.nombre_completo || "Usuario")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                Usuario reportado
              </label>
              <div className={readOnlyClass(modoOscuro)}>
                {usuarioReportadoActual?.nombre_completo || "Selecciona un servicio"}
              </div>
            </div>

            <div>
              <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                Motivo
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={inputClass(modoOscuro)}
              >
                <option value="">Selecciona un motivo</option>
                {motivos.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                Descripción opcional
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={5}
                placeholder="Describe qué ocurrió, cuándo pasó y cualquier detalle importante."
                className={`${inputClass(modoOscuro)} resize-none`}
              />
            </div>

            <div>
              <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                Evidencia opcional
              </label>

              <label
                className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition ${
                  modoOscuro
                    ? "border-[#334155] bg-[#111827] hover:bg-[#1e293b]"
                    : "border-gray-300 bg-[#f8fafc] hover:bg-[#eef5ff]"
                }`}
              >
                <ImagePlus className="w-9 h-9 text-[#0B3C7F]" />
                <p className={`mt-2 text-sm font-bold ${estilos.textoPrincipal}`}>
                  {archivo ? archivo.name : "Subir imagen o captura"}
                </p>
                <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                  JPG, PNG o WEBP
                </p>

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => seleccionarArchivo(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <button
              onClick={crearReporte}
              disabled={guardando}
              className="w-full rounded-2xl bg-[#0B3C7F] text-white px-5 py-3 font-bold hover:bg-[#082f63] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {guardando ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Flag className="w-5 h-5" />
              )}
              {guardando ? "Enviando reporte..." : "Enviar reporte"}
            </button>
          </div>

          <div className={`rounded-2xl border p-5 ${estilos.tarjetaSuave}`}>
            <h3 className={`font-extrabold ${estilos.textoPrincipal}`}>
              Resumen del reporte
            </h3>

            <div className="mt-4 space-y-4">
              <InfoLinea
                label="Servicio"
                value={solicitudActual?.titulo || "Sin seleccionar"}
                estilos={estilos}
              />
              <InfoLinea
                label="Usuario reportado"
                value={usuarioReportadoActual?.nombre_completo || "Sin seleccionar"}
                estilos={estilos}
              />
              <InfoLinea
                label="Motivo"
                value={motivo ? traducirMotivo(motivo) : "Sin seleccionar"}
                estilos={estilos}
              />

              {vistaPrevia ? (
                <div className="mt-4">
                  <p className={`text-xs font-bold mb-2 ${estilos.textoSecundario}`}>
                    Vista previa
                  </p>
                  <img
                    src={vistaPrevia}
                    alt="Vista previa"
                    className="w-full max-h-56 object-cover rounded-2xl border border-gray-200"
                  />
                </div>
              ) : (
                <div
                  className={`rounded-2xl border border-dashed p-6 text-center ${
                    modoOscuro
                      ? "border-[#334155] bg-[#0f172a]"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <FileImage className="w-8 h-8 mx-auto text-gray-400" />
                  <p className={`text-xs mt-2 ${estilos.textoSecundario}`}>
                    Puedes adjuntar evidencia para ayudar en la revisión.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function InfoLinea({
  label,
  value,
  estilos,
}: {
  label: string;
  value: string;
  estilos: ReturnType<typeof usePanelContext>["estilos"];
}) {
  return (
    <div>
      <p className={`text-xs font-bold ${estilos.textoSecundario}`}>{label}</p>
      <p className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}>
        {value}
      </p>
    </div>
  );
}

function ListaReportes({
  titulo,
  descripcion,
  reportes,
  modoOscuro,
  estilos,
  vacio,
  tipo,
}: {
  titulo: string;
  descripcion: string;
  reportes: ReporteVista[];
  modoOscuro: boolean;
  estilos: ReturnType<typeof usePanelContext>["estilos"];
  vacio: string;
  tipo: "enviados" | "recibidos";
}) {
  return (
    <section className={`rounded-[22px] border p-5 sm:p-6 ${estilos.tarjeta}`}>
      <div className="mb-5">
        <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
          {titulo}
        </h2>
        <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
          {descripcion}
        </p>
      </div>

      {reportes.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed p-8 text-center ${
            modoOscuro ? "border-[#334155] bg-[#111827]" : "border-gray-300 bg-[#f8fafc]"
          }`}
        >
          <FileWarning className="w-10 h-10 mx-auto text-gray-400" />
          <p className={`mt-3 font-bold ${estilos.textoPrincipal}`}>{vacio}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {reportes.map((reporte) => (
            <ReporteCard
              key={reporte.id}
              reporte={reporte}
              modoOscuro={modoOscuro}
              estilos={estilos}
              tipo={tipo}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ListaAdmin({
  reportes,
  modoOscuro,
  estilos,
  actualizarEstadoReporte,
}: {
  reportes: ReporteVista[];
  modoOscuro: boolean;
  estilos: ReturnType<typeof usePanelContext>["estilos"];
  actualizarEstadoReporte: (
    reporte: ReporteVista,
    nuevoEstado: "pendiente" | "en_revision" | "resuelto" | "rechazado"
  ) => void;
}) {
  return (
    <section className={`rounded-[22px] border p-5 sm:p-6 ${estilos.tarjeta}`}>
      <div className="mb-5">
        <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
          Administración de reportes
        </h2>
        <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
          Revisa reportes pendientes, cambia estados y da seguimiento.
        </p>
      </div>

      {reportes.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed p-8 text-center ${
            modoOscuro ? "border-[#334155] bg-[#111827]" : "border-gray-300 bg-[#f8fafc]"
          }`}
        >
          <ShieldAlert className="w-10 h-10 mx-auto text-gray-400" />
          <p className={`mt-3 font-bold ${estilos.textoPrincipal}`}>
            No hay reportes administrativos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {reportes.map((reporte) => (
            <ReporteAdminCard
              key={reporte.id}
              reporte={reporte}
              modoOscuro={modoOscuro}
              estilos={estilos}
              actualizarEstadoReporte={actualizarEstadoReporte}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReporteAdminCard({
  reporte,
  modoOscuro,
  estilos,
  actualizarEstadoReporte,
}: {
  reporte: ReporteVista;
  modoOscuro: boolean;
  estilos: ReturnType<typeof usePanelContext>["estilos"];
  actualizarEstadoReporte: (
    reporte: ReporteVista,
    nuevoEstado: "pendiente" | "en_revision" | "resuelto" | "rechazado"
  ) => void;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 ${
        modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-white border-gray-100"
      }`}
    >
      <ReporteContenido reporte={reporte} estilos={estilos} modoOscuro={modoOscuro} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => actualizarEstadoReporte(reporte, "en_revision")}
          className="rounded-2xl px-3 py-2 text-sm font-bold bg-[#e7f0ff] text-[#0B3C7F] hover:bg-[#d9e9ff] transition"
        >
          En revisión
        </button>

        <button
          onClick={() => actualizarEstadoReporte(reporte, "resuelto")}
          className="rounded-2xl px-3 py-2 text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200 transition"
        >
          Resolver
        </button>

        <button
          onClick={() => actualizarEstadoReporte(reporte, "rechazado")}
          className="rounded-2xl px-3 py-2 text-sm font-bold bg-red-100 text-red-700 hover:bg-red-200 transition"
        >
          Rechazar
        </button>
      </div>
    </article>
  );
}

function ReporteCard({
  reporte,
  modoOscuro,
  estilos,
  tipo,
}: {
  reporte: ReporteVista;
  modoOscuro: boolean;
  estilos: ReturnType<typeof usePanelContext>["estilos"];
  tipo: "enviados" | "recibidos";
}) {
  return (
    <article
      className={`rounded-2xl border p-5 ${
        modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-white border-gray-100"
      }`}
    >
      <ReporteContenido
        reporte={reporte}
        estilos={estilos}
        modoOscuro={modoOscuro}
        tipo={tipo}
      />
    </article>
  );
}

function ReporteContenido({
  reporte,
  estilos,
  modoOscuro,
  tipo,
}: {
  reporte: ReporteVista;
  estilos: ReturnType<typeof usePanelContext>["estilos"];
  modoOscuro: boolean;
  tipo?: "enviados" | "recibidos";
}) {
  const usuarioPrincipal =
    tipo === "recibidos"
      ? reporte.reportante?.nombre_completo
      : reporte.reportado?.nombre_completo;

  const etiquetaUsuario = tipo === "recibidos" ? "Reportado por" : "Usuario reportado";

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`font-extrabold ${estilos.textoPrincipal}`}>
            {reporte.solicitud?.titulo || "Reporte de servicio"}
          </h3>
          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            {traducirMotivo(reporte.motivo)}
          </p>
        </div>

        <EstadoBadge estado={reporte.estado} />
      </div>

      <div className="mt-4 space-y-3">
        <InfoLinea
          label={etiquetaUsuario}
          value={usuarioPrincipal || "Usuario no disponible"}
          estilos={estilos}
        />

        <InfoLinea
          label="Fecha"
          value={formatearFecha(reporte.creado_en)}
          estilos={estilos}
        />

        {reporte.descripcion && (
          <div>
            <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
              Descripción
            </p>
            <p className={`mt-1 text-sm leading-6 ${estilos.textoPrincipal}`}>
              {reporte.descripcion}
            </p>
          </div>
        )}

        {reporte.evidencia_url && (
          <a
            href={reporte.evidencia_url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold ${
              modoOscuro
                ? "bg-[#1e293b] text-[#7fb3ff]"
                : "bg-[#e7f0ff] text-[#0B3C7F]"
            }`}
          >
            <Eye className="w-4 h-4" />
            Ver evidencia
          </a>
        )}
      </div>
    </>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: "pendiente" | "en_revision" | "resuelto" | "rechazado";
}) {
  if (estado === "resuelto") {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
        Resuelto
      </span>
    );
  }

  if (estado === "rechazado") {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
        Rechazado
      </span>
    );
  }

  if (estado === "en_revision") {
    return (
      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
        En revisión
      </span>
    );
  }

  return (
    <span
      className={`rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700`}
    >
      Pendiente
    </span>
  );
}

function inputClass(modoOscuro: boolean) {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none ${
    modoOscuro
      ? "bg-[#0f172a] border-[#334155] text-white placeholder:text-gray-500"
      : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-400"
  }`;
}

function readOnlyClass(modoOscuro: boolean) {
  return `flex min-h-[48px] items-center rounded-2xl border px-4 text-sm font-bold ${
    modoOscuro
      ? "bg-[#0f172a] border-[#334155] text-gray-300"
      : "bg-[#f8fafc] border-gray-200 text-gray-700"
  }`;
}

function traducirMotivo(motivo: string) {
  const encontrado = motivos.find((item) => item.value === motivo);
  return encontrado?.label || motivo;
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