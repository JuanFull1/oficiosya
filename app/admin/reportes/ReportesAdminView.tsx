"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileImage,
  Flag,
  Loader2,
  Printer,
  Search,
  ShieldAlert,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type EstadoReporte = "pendiente" | "en_revision" | "resuelto" | "rechazado";

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

type Reporte = {
  id: string;
  reportante_id: string;
  usuario_reportado_id: string;
  servicio_id: string | null;
  motivo: string;
  descripcion: string | null;
  evidencia_url: string | null;
  estado: EstadoReporte;
  revisado_por: string | null;
  revisado_en: string | null;
  creado_en: string;
  actualizado_en: string;
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

type ReporteVista = Reporte & {
  reportante?: Perfil | null;
  reportado?: Perfil | null;
  servicio?: Servicio | null;
  solicitud?: Solicitud | null;
};

type ModalEvidencia = {
  abierto: boolean;
  titulo: string;
  url: string;
  tipo: "imagen" | "pdf" | "otro";
};

type ModalAccion = {
  abierto: boolean;
  tipo: "advertir" | "suspender" | null;
  reporte: ReporteVista | null;
};

const CACHE_KEY = "oficiosya-admin-reportes-cache";
const BUCKET_EVIDENCIAS = "evidencias-reportes";

const motivos: Record<string, string> = {
  mal_comportamiento: "Mal comportamiento",
  incumplimiento: "Incumplimiento del servicio",
  datos_falsos: "Datos falsos",
  cobro_indebido: "Cobro indebido",
  servicio_no_realizado: "Servicio no realizado",
  acoso: "Acoso o trato inadecuado",
  spam: "Spam",
  otro: "Otro",
};

export default function ReportesAdminView() {
  const [adminId, setAdminId] = useState("");
  const [reportes, setReportes] = useState<ReporteVista[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | EstadoReporte>("todos");

  const [sincronizando, setSincronizando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [modalEvidencia, setModalEvidencia] = useState<ModalEvidencia>({
    abierto: false,
    titulo: "",
    url: "",
    tipo: "otro",
  });

  const [modalAccion, setModalAccion] = useState<ModalAccion>({
    abierto: false,
    tipo: null,
    reporte: null,
  });

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const iframePdfRef = useRef<HTMLIFrameElement | null>(null);

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      setReportes(JSON.parse(raw) as ReporteVista[]);
    } catch (err) {
      console.error("No se pudo leer cache reportes admin:", err);
    }
  }, []);

  const guardarCache = useCallback((data: ReporteVista[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("No se pudo guardar cache reportes admin:", err);
    }
  }, []);

  const cargarReportes = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        setError("No se pudo validar la sesión.");
        return;
      }

      setAdminId(authData.user.id);

      const { data: reportesData, error: reportesError } = await supabase
        .from("reportes")
        .select("*")
        .order("creado_en", { ascending: false });

      if (reportesError) {
        console.error("Error al cargar reportes:", reportesError);
        setError("No se pudieron cargar los reportes.");
        return;
      }

      const baseReportes = (reportesData || []) as Reporte[];

      const usuariosIds = Array.from(
        new Set([
          ...baseReportes.map((r) => r.reportante_id),
          ...baseReportes.map((r) => r.usuario_reportado_id),
        ])
      );

      const serviciosIds = Array.from(
        new Set(
          baseReportes
            .map((r) => r.servicio_id)
            .filter(Boolean) as string[]
        )
      );

      let perfiles: Perfil[] = [];
      let servicios: Servicio[] = [];
      let solicitudes: Solicitud[] = [];

      if (usuariosIds.length > 0) {
        const { data } = await supabase
          .from("perfiles")
          .select(
            "id,nombre_completo,correo,telefono,foto_url,zona,activo,verificado"
          )
          .in("id", usuariosIds);

        perfiles = (data || []) as Perfil[];
      }

      if (serviciosIds.length > 0) {
        const { data } = await supabase
          .from("servicios")
          .select("id,solicitud_id,cliente_id,trabajador_id,estado,creado_en")
          .in("id", serviciosIds);

        servicios = (data || []) as Servicio[];
      }

      const solicitudIds = Array.from(
        new Set(servicios.map((s) => s.solicitud_id))
      );

      if (solicitudIds.length > 0) {
        const { data } = await supabase
          .from("solicitudes_servicio")
          .select("id,titulo,descripcion")
          .in("id", solicitudIds);

        solicitudes = (data || []) as Solicitud[];
      }

      const vista = baseReportes.map((reporte) => {
        const servicio =
          servicios.find((serv) => serv.id === reporte.servicio_id) || null;

        return {
          ...reporte,
          reportante:
            perfiles.find((perfil) => perfil.id === reporte.reportante_id) ||
            null,
          reportado:
            perfiles.find(
              (perfil) => perfil.id === reporte.usuario_reportado_id
            ) || null,
          servicio,
          solicitud: servicio
            ? solicitudes.find((sol) => sol.id === servicio.solicitud_id) ||
              null
            : null,
        };
      });

      setReportes(vista);
      guardarCache(vista);
    } catch (err) {
      console.error("Error general reportes admin:", err);
      setError("Ocurrió un error al sincronizar reportes.");
    } finally {
      setSincronizando(false);
    }
  }, [guardarCache]);

  useEffect(() => {
    leerCache();
    cargarReportes();
  }, [leerCache, cargarReportes]);

  const metricas = useMemo(() => {
    return {
      total: reportes.length,
      pendientes: reportes.filter((r) => r.estado === "pendiente").length,
      revision: reportes.filter((r) => r.estado === "en_revision").length,
      resueltos: reportes.filter((r) => r.estado === "resuelto").length,
      rechazados: reportes.filter((r) => r.estado === "rechazado").length,
    };
  }, [reportes]);

  const reportesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return reportes.filter((reporte) => {
      const coincideTexto =
        !texto ||
        reporte.reportante?.nombre_completo?.toLowerCase().includes(texto) ||
        reporte.reportado?.nombre_completo?.toLowerCase().includes(texto) ||
        reporte.motivo?.toLowerCase().includes(texto) ||
        reporte.descripcion?.toLowerCase().includes(texto) ||
        reporte.solicitud?.titulo?.toLowerCase().includes(texto);

      const coincideFiltro = filtro === "todos" || reporte.estado === filtro;

      return coincideTexto && coincideFiltro;
    });
  }, [reportes, busqueda, filtro]);

  const tipoArchivo = (ruta: string | null) => {
    if (!ruta) return "otro";

    const lower = ruta.toLowerCase();

    if (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif")
    ) {
      return "imagen";
    }

    if (lower.endsWith(".pdf")) return "pdf";

    return "otro";
  };

  const obtenerUrlFirmada = async (ruta: string | null) => {
    if (!ruta) return "";

    if (ruta.startsWith("http")) return ruta;

    const { data, error: signedError } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .createSignedUrl(ruta, 60 * 10);

    if (signedError || !data?.signedUrl) {
      console.error("Error al crear URL de evidencia:", signedError);
      setError("No se pudo abrir la evidencia.");
      return "";
    }

    return data.signedUrl;
  };

  const verEvidencia = async (reporte: ReporteVista) => {
    setMensaje("");
    setError("");

    if (!reporte.evidencia_url) {
      setError("Este reporte no tiene evidencia.");
      return;
    }

    const url = await obtenerUrlFirmada(reporte.evidencia_url);
    if (!url) return;

    setModalEvidencia({
      abierto: true,
      titulo: reporte.solicitud?.titulo || "Evidencia del reporte",
      url,
      tipo: tipoArchivo(reporte.evidencia_url),
    });
  };

  const cerrarModalEvidencia = () => {
    setModalEvidencia({
      abierto: false,
      titulo: "",
      url: "",
      tipo: "otro",
    });
  };

  const descargarEvidencia = async () => {
    if (!modalEvidencia.url) return;

    setError("");

    try {
      const respuesta = await fetch(modalEvidencia.url);

      if (!respuesta.ok) {
        setError("No se pudo descargar la evidencia.");
        return;
      }

      const blob = await respuesta.blob();
      const urlBlob = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = urlBlob;
      link.download = `${normalizarNombreArchivo(
        modalEvidencia.titulo || "evidencia"
      )}${extensionPorTipo(modalEvidencia.tipo)}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(urlBlob);
    } catch (err) {
      console.error("Error al descargar evidencia:", err);
      setError("No se pudo descargar la evidencia.");
    }
  };

  const imprimirEvidencia = async () => {
    if (!modalEvidencia.url) return;

    setError("");

    if (modalEvidencia.tipo === "pdf") {
      try {
        iframePdfRef.current?.contentWindow?.focus();
        iframePdfRef.current?.contentWindow?.print();
        return;
      } catch (err) {
        console.error("No se pudo imprimir PDF desde el visor:", err);
        setError(
          "No se pudo imprimir directamente este PDF. Usa el botón de imprimir del visor interno."
        );
        return;
      }
    }

    if (modalEvidencia.tipo !== "imagen") {
      setError("Este tipo de archivo no se puede imprimir directamente.");
      return;
    }

    try {
      const respuesta = await fetch(modalEvidencia.url);

      if (!respuesta.ok) {
        setError("No se pudo preparar la evidencia para imprimir.");
        return;
      }

      const blob = await respuesta.blob();
      const imagenBlobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.setAttribute("aria-hidden", "true");

      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (!doc) {
        URL.revokeObjectURL(imagenBlobUrl);
        iframe.remove();
        setError("No se pudo preparar la impresión.");
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${escapeHtml(modalEvidencia.titulo || "Evidencia")}</title>
            <style>
              @page {
                margin: 12mm;
              }

              * {
                box-sizing: border-box;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                width: 100%;
                min-height: 100%;
                background: white;
              }

              body {
                display: flex;
                align-items: center;
                justify-content: center;
              }

              img {
                display: block;
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
              }

              @media print {
                html,
                body {
                  width: 100%;
                  min-height: 100%;
                  background: white;
                }

                body {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }

                img {
                  max-width: 100%;
                  max-height: 100%;
                  page-break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            <img id="evidencia-imprimir" src="${imagenBlobUrl}" alt="${escapeHtml(
              modalEvidencia.titulo || "Evidencia"
            )}" />
          </body>
        </html>
      `);
      doc.close();

      const limpiar = () => {
        setTimeout(() => {
          URL.revokeObjectURL(imagenBlobUrl);
          iframe.remove();
        }, 1500);
      };

      iframe.onload = () => {
        const img = doc.getElementById(
          "evidencia-imprimir"
        ) as HTMLImageElement | null;

        if (!img) {
          limpiar();
          setError("No se pudo cargar la evidencia para imprimir.");
          return;
        }

        const imprimir = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.error("Error al imprimir evidencia:", err);
            setError("No se pudo imprimir la evidencia.");
          } finally {
            limpiar();
          }
        };

        if (img.complete) {
          setTimeout(imprimir, 500);
        } else {
          img.onload = () => setTimeout(imprimir, 500);
          img.onerror = () => {
            limpiar();
            setError("No se pudo cargar la evidencia para imprimir.");
          };
        }
      };
    } catch (err) {
      console.error("Error al preparar impresión:", err);
      setError("No se pudo preparar la impresión.");
    }
  };

  const registrarAccionAdmin = async ({
    reporte,
    accion,
    descripcion,
  }: {
    reporte: ReporteVista;
    accion: string;
    descripcion: string;
  }) => {
    if (!adminId) return;

    const { error: accionError } = await supabase.from("acciones_admin").insert({
      admin_id: adminId,
      usuario_objetivo_id: reporte.usuario_reportado_id,
      reporte_id: reporte.id,
      accion,
      descripcion,
    });

    if (accionError) {
      console.error("No se pudo registrar acción admin:", accionError);
    }
  };

  const crearNotificacionAdmin = async ({
    usuarioId,
    tipo,
    titulo,
    mensaje,
    reporte,
    accion,
  }: {
    usuarioId: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    reporte: ReporteVista;
    accion: string;
  }) => {
    const motivoLegible = motivos[reporte.motivo] || reporte.motivo;

    const { error: notificacionError } = await supabase
      .from("notificaciones")
      .insert({
        usuario_id: usuarioId,
        actor_id: adminId || null,
        tipo,
        titulo,
        mensaje,
        entidad_tipo: "reporte",
        entidad_id: reporte.id,
        url_destino: "/panel/reportes",
        metadata: {
          reporte_id: reporte.id,
          motivo: reporte.motivo,
          motivo_legible: motivoLegible,
          accion,
        },
        leida: false,
      });

    if (notificacionError) {
      console.error("No se pudo crear notificación admin:", notificacionError);
    }
  };

  const actualizarReporteLocal = (
    reporte: ReporteVista,
    cambios: Partial<ReporteVista>
  ) => {
    setReportes((prev) => {
      const nuevaLista = prev.map((item) =>
        item.id === reporte.id ? { ...item, ...cambios } : item
      );

      guardarCache(nuevaLista);
      return nuevaLista;
    });
  };

  const actualizarEstadoReporte = async (
    reporte: ReporteVista,
    nuevoEstado: EstadoReporte,
    mensajeExito = "Reporte actualizado correctamente."
  ) => {
    setMensaje("");
    setError("");

    if (!adminId) {
      setError("No se pudo identificar al administrador.");
      return false;
    }

    setProcesandoId(reporte.id);

    const ahora = new Date().toISOString();

    const { data, error: updateError } = await supabase
      .from("reportes")
      .update({
        estado: nuevoEstado,
        revisado_por: adminId,
        revisado_en: ahora,
        actualizado_en: ahora,
      })
      .eq("id", reporte.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error al actualizar reporte:", updateError);
      setError("No se pudo actualizar el reporte.");
      setProcesandoId(null);
      return false;
    }

    const actualizado: ReporteVista = {
      ...(data as Reporte),
      reportante: reporte.reportante,
      reportado: reporte.reportado,
      servicio: reporte.servicio,
      solicitud: reporte.solicitud,
    };

    setReportes((prev) => {
      const nuevaLista = prev.map((item) =>
        item.id === reporte.id ? actualizado : item
      );

      guardarCache(nuevaLista);
      return nuevaLista;
    });

    setMensaje(mensajeExito);
    setProcesandoId(null);
    return true;
  };

  const abrirModalAdvertencia = (reporte: ReporteVista) => {
    setMensaje("");
    setError("");

    setModalAccion({
      abierto: true,
      tipo: "advertir",
      reporte,
    });
  };

  const abrirModalSuspension = (reporte: ReporteVista) => {
    setMensaje("");
    setError("");

    setModalAccion({
      abierto: true,
      tipo: "suspender",
      reporte,
    });
  };

  const cerrarModalAccion = () => {
    if (procesandoId) return;

    setModalAccion({
      abierto: false,
      tipo: null,
      reporte: null,
    });
  };

  const confirmarAccion = async () => {
    const reporte = modalAccion.reporte;
    const tipo = modalAccion.tipo;

    if (!reporte || !tipo) return;

    if (tipo === "advertir") {
      await advertirUsuario(reporte);
      return;
    }

    if (tipo === "suspender") {
      await suspenderUsuario(reporte);
    }
  };

  const advertirUsuario = async (reporte: ReporteVista) => {
    setMensaje("");
    setError("");

    if (!adminId) {
      setError("No se pudo identificar al administrador.");
      return;
    }

    if (!reporte.usuario_reportado_id) {
      setError("No se encontró el usuario reportado.");
      return;
    }

    setProcesandoId(reporte.id);

    const motivoLegible = motivos[reporte.motivo] || reporte.motivo;

    await registrarAccionAdmin({
      reporte,
      accion: "advertencia",
      descripcion: `Advertencia aplicada por reporte: ${motivoLegible}.`,
    });

    await crearNotificacionAdmin({
      usuarioId: reporte.usuario_reportado_id,
      tipo: "advertencia_admin",
      titulo: "Advertencia administrativa",
      mensaje: `Has recibido una advertencia por un reporte relacionado con: ${motivoLegible}. Revisa tu comportamiento dentro de la plataforma para evitar una suspensión.`,
      reporte,
      accion: "advertencia",
    });

    const actualizado = await actualizarEstadoReporte(
      reporte,
      "en_revision",
      `Advertencia enviada a ${
        reporte.reportado?.nombre_completo || "el usuario reportado"
      }.`
    );

    if (actualizado) {
      setModalAccion({
        abierto: false,
        tipo: null,
        reporte: null,
      });
    }

    setProcesandoId(null);
  };

  const suspenderUsuario = async (reporte: ReporteVista) => {
    setMensaje("");
    setError("");

    if (!adminId) {
      setError("No se pudo identificar al administrador.");
      return;
    }

    if (!reporte.usuario_reportado_id) {
      setError("No se encontró el usuario reportado.");
      return;
    }

    setProcesandoId(reporte.id);

    const ahora = new Date().toISOString();
    const motivoLegible = motivos[reporte.motivo] || reporte.motivo;

    await crearNotificacionAdmin({
      usuarioId: reporte.usuario_reportado_id,
      tipo: "suspension_admin",
      titulo: "Cuenta suspendida",
      mensaje: `Tu cuenta fue suspendida por un reporte relacionado con: ${motivoLegible}. Si consideras que fue un error, comunícate con soporte.`,
      reporte,
      accion: "suspension",
    });

    const { error: perfilError } = await supabase
      .from("perfiles")
      .update({
        activo: false,
        actualizado_en: ahora,
      })
      .eq("id", reporte.usuario_reportado_id);

    if (perfilError) {
      console.error("Error al suspender usuario:", perfilError);
      setError("No se pudo suspender el usuario.");
      setProcesandoId(null);
      return;
    }

    await registrarAccionAdmin({
      reporte,
      accion: "suspension",
      descripcion: `Usuario suspendido por reporte: ${motivoLegible}.`,
    });

    const { data, error: reporteError } = await supabase
      .from("reportes")
      .update({
        estado: "resuelto",
        revisado_por: adminId,
        revisado_en: ahora,
        actualizado_en: ahora,
      })
      .eq("id", reporte.id)
      .select("*")
      .single();

    if (reporteError) {
      console.error("Error al resolver reporte:", reporteError);
      setError("El usuario fue suspendido, pero no se pudo resolver el reporte.");
      setProcesandoId(null);
      return;
    }

    actualizarReporteLocal(reporte, {
      ...(data as Reporte),
      reportado: reporte.reportado
        ? {
            ...reporte.reportado,
            activo: false,
          }
        : reporte.reportado,
      reportante: reporte.reportante,
      servicio: reporte.servicio,
      solicitud: reporte.solicitud,
    });

    setMensaje("Usuario suspendido, notificado y reporte resuelto correctamente.");
    setModalAccion({
      abierto: false,
      tipo: null,
      reporte: null,
    });
    setProcesandoId(null);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <Flag size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">Gestión de reportes</h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Revisa casos, evidencias y aplica acciones administrativas.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cargarReportes}
              disabled={sincronizando || Boolean(procesandoId)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard titulo="Total" valor={metricas.total} />
        <MetricCard titulo="Pendientes" valor={metricas.pendientes} ambar />
        <MetricCard titulo="En revisión" valor={metricas.revision} ambar />
        <MetricCard titulo="Resueltos" valor={metricas.resueltos} verde />
        <MetricCard titulo="Rechazados" valor={metricas.rechazados} rojo />
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
              placeholder="Buscar por usuario, motivo, servicio o descripción..."
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
              activo={filtro === "pendiente"}
              onClick={() => setFiltro("pendiente")}
            >
              Pendientes
            </FiltroButton>

            <FiltroButton
              activo={filtro === "en_revision"}
              onClick={() => setFiltro("en_revision")}
            >
              En revisión
            </FiltroButton>

            <FiltroButton
              activo={filtro === "resuelto"}
              onClick={() => setFiltro("resuelto")}
            >
              Resueltos
            </FiltroButton>

            <FiltroButton
              activo={filtro === "rechazado"}
              onClick={() => setFiltro("rechazado")}
            >
              Rechazados
            </FiltroButton>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {reportesFiltrados.length === 0 ? (
          <EmptyCard texto="No se encontraron reportes con esos filtros." />
        ) : (
          reportesFiltrados.map((reporte) => (
            <article
              key={reporte.id}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                      <AlertTriangle size={22} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900">
                          {reporte.solicitud?.titulo || "Reporte de servicio"}
                        </h3>
                        <EstadoBadge estado={reporte.estado} />
                      </div>

                      <p className="text-sm text-slate-500">
                        Motivo: {motivos[reporte.motivo] || reporte.motivo}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-slate-400">
                    {formatearFecha(reporte.creado_en)}
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <p className="text-sm leading-relaxed text-slate-700">
                  {reporte.descripcion || "Sin descripción adicional."}
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <UsuarioBox titulo="Reportante" perfil={reporte.reportante} />
                  <UsuarioBox titulo="Reportado" perfil={reporte.reportado} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {reporte.evidencia_url ? (
                    <button
                      type="button"
                      onClick={() => verEvidencia(reporte)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <Eye size={16} />
                      Ver evidencia
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-400">
                      <FileImage size={16} />
                      Sin evidencia
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      actualizarEstadoReporte(reporte, "en_revision")
                    }
                    disabled={procesandoId === reporte.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-70"
                  >
                    <Clock3 size={16} />
                    En revisión
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirModalAdvertencia(reporte)}
                    disabled={procesandoId === reporte.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    <ShieldAlert size={16} />
                    Advertir
                  </button>

                  <button
                    type="button"
                    onClick={() => actualizarEstadoReporte(reporte, "resuelto")}
                    disabled={procesandoId === reporte.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
                  >
                    <CheckCircle2 size={16} />
                    Resolver
                  </button>

                  <button
                    type="button"
                    onClick={() => actualizarEstadoReporte(reporte, "rechazado")}
                    disabled={procesandoId === reporte.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
                  >
                    <XCircle size={16} />
                    Rechazar
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirModalSuspension(reporte)}
                    disabled={
                      procesandoId === reporte.id ||
                      reporte.reportado?.activo === false
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Ban size={16} />
                    {reporte.reportado?.activo === false
                      ? "Usuario suspendido"
                      : "Suspender usuario"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {modalEvidencia.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {modalEvidencia.titulo}
                </h2>
                <p className="text-sm text-slate-500">
                  Vista previa de evidencia del reporte.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={descargarEvidencia}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Download size={16} />
                  Descargar
                </button>

                <button
                  type="button"
                  onClick={imprimirEvidencia}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Printer size={16} />
                  Imprimir
                </button>

                <button
                  type="button"
                  onClick={cerrarModalEvidencia}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-[60vh] overflow-auto bg-slate-100 p-4">
              {modalEvidencia.tipo === "imagen" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modalEvidencia.url}
                  alt={modalEvidencia.titulo}
                  className="mx-auto max-h-[70vh] max-w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
                />
              )}

              {modalEvidencia.tipo === "pdf" && (
                <iframe
                  ref={iframePdfRef}
                  src={modalEvidencia.url}
                  title={modalEvidencia.titulo}
                  className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white"
                />
              )}

              {modalEvidencia.tipo === "otro" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  No se puede previsualizar este archivo, pero puedes
                  descargarlo desde este mismo panel.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalAccion.abierto && modalAccion.reporte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
            <div
              className={`px-6 py-5 text-white ${
                modalAccion.tipo === "suspender"
                  ? "bg-gradient-to-r from-red-700 via-red-600 to-red-700"
                  : "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  {modalAccion.tipo === "suspender" ? (
                    <Ban size={24} />
                  ) : (
                    <ShieldAlert size={24} />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold">
                    {modalAccion.tipo === "suspender"
                      ? "Suspender usuario"
                      : "Registrar advertencia"}
                  </h2>
                  <p className="mt-1 text-sm text-white/80">
                    Esta acción se guardará en el historial administrativo y se
                    notificará al usuario.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Usuario reportado
                </p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {modalAccion.reporte.reportado?.nombre_completo ||
                    "Usuario no disponible"}
                </p>
                <p className="text-sm text-slate-500">
                  {modalAccion.reporte.reportado?.correo || "Sin correo"}
                </p>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle
                    size={20}
                    className="mt-0.5 shrink-0 text-amber-700"
                  />
                  <div>
                    <p className="font-bold text-amber-900">
                      {modalAccion.tipo === "suspender"
                        ? "Confirmar suspensión"
                        : "Confirmar advertencia"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-800">
                      {modalAccion.tipo === "suspender"
                        ? "El usuario quedará inactivo, recibirá una notificación y el reporte será marcado como resuelto."
                        : "Se registrará una advertencia administrativa, el usuario recibirá una notificación y el reporte pasará a estado en revisión."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarModalAccion}
                  disabled={Boolean(procesandoId)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={confirmarAccion}
                  disabled={Boolean(procesandoId)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    modalAccion.tipo === "suspender"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  {procesandoId ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : modalAccion.tipo === "suspender" ? (
                    <Ban size={16} />
                  ) : (
                    <ShieldAlert size={16} />
                  )}

                  {modalAccion.tipo === "suspender"
                    ? "Sí, suspender"
                    : "Sí, advertir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
        <Flag size={21} />
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

function EstadoBadge({ estado }: { estado: EstadoReporte }) {
  if (estado === "resuelto") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        Resuelto
      </span>
    );
  }

  if (estado === "rechazado") {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Rechazado
      </span>
    );
  }

  if (estado === "en_revision") {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        En revisión
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      Pendiente
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

function normalizarNombreArchivo(nombre: string) {
  return nombre
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 40);
}

function extensionPorTipo(tipo: "imagen" | "pdf" | "otro") {
  if (tipo === "pdf") return ".pdf";
  if (tipo === "imagen") return ".png";
  return "";
}

function escapeHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}