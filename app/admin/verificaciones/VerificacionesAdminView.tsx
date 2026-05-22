"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Loader2,
  Printer,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type EstadoVerificacion = "pendiente" | "aprobada" | "rechazada";

type Perfil = {
  id: string;
  nombre_completo: string;
  correo: string | null;
  telefono: string | null;
  foto_url: string | null;
  zona: string | null;
  verificado: boolean;
  activo: boolean;
};

type Verificacion = {
  id: string;
  usuario_id: string;
  tipo_documento: string;
  numero_documento: string;
  archivo_documento_url: string | null;
  estado: EstadoVerificacion;
  revisado_por: string | null;
  revisado_en: string | null;
  creado_en: string;
  actualizado_en: string;
};

type VerificacionVista = Verificacion & {
  usuario?: Perfil | null;
};

type ModalDocumento = {
  abierto: boolean;
  titulo: string;
  ruta: string | null;
  url: string;
  tipo: "imagen" | "pdf" | "otro";
};

const CACHE_KEY = "oficiosya-admin-verificaciones-cache";
const BUCKET_DOCUMENTOS = "documentos-identidad";

export default function VerificacionesAdminView() {
  const [adminId, setAdminId] = useState("");
  const [verificaciones, setVerificaciones] = useState<VerificacionVista[]>(
    []
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todas" | EstadoVerificacion>("todas");

  const [sincronizando, setSincronizando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [modalDocumento, setModalDocumento] = useState<ModalDocumento>({
    abierto: false,
    titulo: "",
    ruta: null,
    url: "",
    tipo: "otro",
  });

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const iframePdfRef = useRef<HTMLIFrameElement | null>(null);

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;

      const cache = JSON.parse(raw) as VerificacionVista[];
      setVerificaciones(cache || []);
    } catch (err) {
      console.error("No se pudo leer cache verificaciones admin:", err);
    }
  }, []);

  const guardarCache = useCallback((data: VerificacionVista[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("No se pudo guardar cache verificaciones admin:", err);
    }
  }, []);

  const cargarVerificaciones = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError("No se pudo validar la sesión.");
        return;
      }

      setAdminId(authData.user.id);

      const { data: verificacionesData, error: verificacionesError } =
        await supabase
          .from("verificaciones_identidad")
          .select("*")
          .order("creado_en", { ascending: false });

      if (verificacionesError) {
        console.error("Error al cargar verificaciones:", verificacionesError);
        setError("No se pudieron cargar las verificaciones.");
        return;
      }

      const verificacionesBase = (verificacionesData || []) as Verificacion[];

      const usuariosIds = Array.from(
        new Set(verificacionesBase.map((item) => item.usuario_id))
      );

      let perfiles: Perfil[] = [];

      if (usuariosIds.length > 0) {
        const { data: perfilesData, error: perfilesError } = await supabase
          .from("perfiles")
          .select(
            "id,nombre_completo,correo,telefono,foto_url,zona,verificado,activo"
          )
          .in("id", usuariosIds);

        if (perfilesError) {
          console.error("Error al cargar perfiles:", perfilesError);
        } else {
          perfiles = (perfilesData || []) as Perfil[];
        }
      }

      const vista = verificacionesBase.map((verificacion) => ({
        ...verificacion,
        usuario: perfiles.find((p) => p.id === verificacion.usuario_id) || null,
      }));

      setVerificaciones(vista);
      guardarCache(vista);
    } catch (err) {
      console.error("Error general verificaciones admin:", err);
      setError("Ocurrió un error al sincronizar verificaciones.");
    } finally {
      setSincronizando(false);
    }
  }, [guardarCache]);

  useEffect(() => {
    leerCache();
    cargarVerificaciones();
  }, [leerCache, cargarVerificaciones]);

  const metricas = useMemo(() => {
    return {
      total: verificaciones.length,
      pendientes: verificaciones.filter((v) => v.estado === "pendiente")
        .length,
      aprobadas: verificaciones.filter((v) => v.estado === "aprobada").length,
      rechazadas: verificaciones.filter((v) => v.estado === "rechazada")
        .length,
    };
  }, [verificaciones]);

  const verificacionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return verificaciones.filter((item) => {
      const usuario = item.usuario;

      const coincideTexto =
        !texto ||
        usuario?.nombre_completo?.toLowerCase().includes(texto) ||
        usuario?.correo?.toLowerCase().includes(texto) ||
        usuario?.telefono?.toLowerCase().includes(texto) ||
        item.tipo_documento?.toLowerCase().includes(texto) ||
        item.numero_documento?.toLowerCase().includes(texto);

      const coincideFiltro = filtro === "todas" || item.estado === filtro;

      return coincideTexto && coincideFiltro;
    });
  }, [verificaciones, busqueda, filtro]);

  const detectarTipoArchivo = (ruta: string | null) => {
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

    if (lower.endsWith(".pdf")) {
      return "pdf";
    }

    return "otro";
  };

  const obtenerUrlFirmada = async (ruta: string | null) => {
    if (!ruta) return "";

    if (ruta.startsWith("http")) return ruta;

    const { data, error: signedError } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrl(ruta, 60 * 10);

    if (signedError || !data?.signedUrl) {
      console.error("Error al crear signed URL:", signedError);
      setError("No se pudo abrir el documento.");
      return "";
    }

    return data.signedUrl;
  };

  const verDocumento = async (verificacion: VerificacionVista) => {
    setMensaje("");
    setError("");

    if (!verificacion.archivo_documento_url) {
      setError("Esta solicitud no tiene documento cargado.");
      return;
    }

    const url = await obtenerUrlFirmada(verificacion.archivo_documento_url);

    if (!url) return;

    setModalDocumento({
      abierto: true,
      titulo: `${verificacion.usuario?.nombre_completo || "Documento"} - ${
        verificacion.tipo_documento
      }`,
      ruta: verificacion.archivo_documento_url,
      url,
      tipo: detectarTipoArchivo(verificacion.archivo_documento_url),
    });
  };

  const cerrarModalDocumento = () => {
    setModalDocumento({
      abierto: false,
      titulo: "",
      ruta: null,
      url: "",
      tipo: "otro",
    });
  };

  const descargarDocumento = async () => {
    if (!modalDocumento.url) return;

    setError("");

    try {
      const respuesta = await fetch(modalDocumento.url);

      if (!respuesta.ok) {
        setError("No se pudo descargar el documento.");
        return;
      }

      const blob = await respuesta.blob();
      const urlBlob = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = urlBlob;
      link.download = `${normalizarNombreArchivo(
        modalDocumento.titulo || "documento"
      )}${extensionPorTipo(modalDocumento.tipo, modalDocumento.ruta)}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(urlBlob);
    } catch (err) {
      console.error("Error al descargar documento:", err);
      setError("No se pudo descargar el documento.");
    }
  };

  const imprimirDocumento = async () => {
    if (!modalDocumento.url) return;

    setError("");

    if (modalDocumento.tipo === "pdf") {
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

    if (modalDocumento.tipo !== "imagen") {
      setError("Este tipo de archivo no se puede imprimir directamente.");
      return;
    }

    try {
      const respuesta = await fetch(modalDocumento.url);

      if (!respuesta.ok) {
        setError("No se pudo preparar la imagen para imprimir.");
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
            <title>${escapeHtml(modalDocumento.titulo || "Documento")}</title>
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
            <img id="documento-imprimir" src="${imagenBlobUrl}" alt="${escapeHtml(
              modalDocumento.titulo || "Documento"
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
          "documento-imprimir"
        ) as HTMLImageElement | null;

        if (!img) {
          limpiar();
          setError("No se pudo cargar la imagen para imprimir.");
          return;
        }

        const imprimir = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.error("Error al imprimir imagen:", err);
            setError("No se pudo imprimir la imagen.");
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
            setError("No se pudo cargar la imagen para imprimir.");
          };
        }
      };
    } catch (err) {
      console.error("Error al preparar impresión:", err);
      setError("No se pudo preparar la impresión.");
    }
  };

  const revisarVerificacion = async (
    verificacion: VerificacionVista,
    nuevoEstado: "aprobada" | "rechazada"
  ) => {
    setMensaje("");
    setError("");

    if (!adminId) {
      setError("No se pudo identificar al administrador.");
      return;
    }

    setProcesandoId(verificacion.id);

    const ahora = new Date().toISOString();

    const { data, error: updateError } = await supabase
      .from("verificaciones_identidad")
      .update({
        estado: nuevoEstado,
        revisado_por: adminId,
        revisado_en: ahora,
        actualizado_en: ahora,
      })
      .eq("id", verificacion.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error al revisar verificación:", updateError);
      setError("No se pudo actualizar la verificación.");
      setProcesandoId(null);
      return;
    }

    const { error: perfilUpdateError } = await supabase
      .from("perfiles")
      .update({
        verificado: nuevoEstado === "aprobada",
        actualizado_en: ahora,
      })
      .eq("id", verificacion.usuario_id);

    if (perfilUpdateError) {
      console.error(
        "Error al actualizar perfil verificado:",
        perfilUpdateError
      );
      setError("La verificación cambió, pero no se pudo actualizar el perfil.");
    }

    const actualizada: VerificacionVista = {
      ...(data as Verificacion),
      usuario: verificacion.usuario
        ? {
            ...verificacion.usuario,
            verificado: nuevoEstado === "aprobada",
          }
        : null,
    };

    setVerificaciones((prev) => {
      const nuevaLista = prev.map((item) =>
        item.id === verificacion.id ? actualizada : item
      );

      guardarCache(nuevaLista);
      return nuevaLista;
    });

    setMensaje(
      nuevoEstado === "aprobada"
        ? "Verificación aprobada correctamente."
        : "Verificación rechazada correctamente."
    );

    setProcesandoId(null);
    cargarVerificaciones();
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <FileCheck2 size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    Verificaciones de identidad
                  </h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Revisa documentos, aprueba o rechaza solicitudes de identidad.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cargarVerificaciones}
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard titulo="Total" valor={metricas.total} />
        <MetricCard titulo="Pendientes" valor={metricas.pendientes} ambar />
        <MetricCard titulo="Aprobadas" valor={metricas.aprobadas} verde />
        <MetricCard titulo="Rechazadas" valor={metricas.rechazadas} rojo />
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
              placeholder="Buscar por nombre, correo, teléfono o documento..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FiltroButton
              activo={filtro === "todas"}
              onClick={() => setFiltro("todas")}
            >
              Todas
            </FiltroButton>

            <FiltroButton
              activo={filtro === "pendiente"}
              onClick={() => setFiltro("pendiente")}
            >
              Pendientes
            </FiltroButton>

            <FiltroButton
              activo={filtro === "aprobada"}
              onClick={() => setFiltro("aprobada")}
            >
              Aprobadas
            </FiltroButton>

            <FiltroButton
              activo={filtro === "rechazada"}
              onClick={() => setFiltro("rechazada")}
            >
              Rechazadas
            </FiltroButton>
          </div>
        </div>
      </section>






<section className="space-y-4">
  {verificacionesFiltradas.length === 0 ? (
    <EmptyCard texto="No se encontraron verificaciones con esos filtros." />
  ) : (
    verificacionesFiltradas.map((verificacion) => (
      <article
        key={verificacion.id}
        className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 text-xl font-bold text-slate-700">
              {verificacion.usuario?.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={verificacion.usuario.foto_url}
                  alt={verificacion.usuario.nombre_completo}
                  className="h-full w-full object-cover"
                />
              ) : (
                verificacion.usuario?.nombre_completo
                  ?.charAt(0)
                  ?.toUpperCase() || "U"
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {verificacion.usuario?.nombre_completo ||
                    "Usuario sin nombre"}
                </h3>

                <EstadoBadge estado={verificacion.estado} />

                {verificacion.usuario?.verificado && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <BadgeCheck size={14} />
                    Perfil verificado
                  </span>
                )}
              </div>

              <div className="mt-2 grid gap-1 text-sm text-slate-500">
                <InfoLine
                  icon={<UserRound size={15} />}
                  texto={verificacion.usuario?.correo || "Sin correo"}
                />
                <InfoLine
                  icon={<FileText size={15} />}
                  texto={`${verificacion.tipo_documento} · ${verificacion.numero_documento}`}
                />
                <InfoLine
                  icon={<Clock3 size={15} />}
                  texto={`Enviado: ${formatearFecha(
                    verificacion.creado_en
                  )}`}
                />
              </div>
            </div>
          </div>


<div className="flex flex-wrap gap-2 lg:justify-end">
  {verificacion.archivo_documento_url && (
    <button
      type="button"
      onClick={() => verDocumento(verificacion)}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      <Eye size={16} />
      Ver documento
    </button>
  )}

  {verificacion.estado !== "aprobada" && (
    <button
      type="button"
      onClick={() => revisarVerificacion(verificacion, "aprobada")}
      disabled={procesandoId === verificacion.id}
      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
    >
      {procesandoId === verificacion.id ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <CheckCircle2 size={16} />
      )}
      Aprobar
    </button>
  )}

  {verificacion.estado === "pendiente" && (
    <button
      type="button"
      onClick={() => revisarVerificacion(verificacion, "rechazada")}
      disabled={procesandoId === verificacion.id}
      className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
    >
      {procesandoId === verificacion.id ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <XCircle size={16} />
      )}
      Rechazar
    </button>
  )}

  {verificacion.estado === "aprobada" && (
    <button
      type="button"
      onClick={() => revisarVerificacion(verificacion, "rechazada")}
      disabled={procesandoId === verificacion.id}
      className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
    >
      {procesandoId === verificacion.id ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <XCircle size={16} />
      )}
      Quitar verificación
    </button>
  )}
</div>
        </div>
      </article>
    ))
  )}
</section>






      {modalDocumento.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {modalDocumento.titulo}
                </h2>
                <p className="text-sm text-slate-500">
                  Vista previa del documento enviado.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={descargarDocumento}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Download size={16} />
                  Descargar
                </button>

                <button
                  type="button"
                  onClick={imprimirDocumento}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Printer size={16} />
                  Imprimir
                </button>

                <button
                  type="button"
                  onClick={cerrarModalDocumento}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-[60vh] overflow-auto bg-slate-100 p-4">
              {modalDocumento.tipo === "imagen" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modalDocumento.url}
                  alt={modalDocumento.titulo}
                  className="mx-auto max-h-[70vh] max-w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
                />
              )}

              {modalDocumento.tipo === "pdf" && (
                <iframe
                  ref={iframePdfRef}
                  src={modalDocumento.url}
                  title={modalDocumento.titulo}
                  className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white"
                />
              )}

              {modalDocumento.tipo === "otro" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  No se puede previsualizar este archivo, pero puedes
                  descargarlo desde este mismo panel.
                </div>
              )}
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
        <ShieldCheck size={21} />
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

function EstadoBadge({ estado }: { estado: EstadoVerificacion }) {
  if (estado === "aprobada") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={14} />
        Aprobada
      </span>
    );
  }

  if (estado === "rechazada") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        <XCircle size={14} />
        Rechazada
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
      <Clock3 size={14} />
      Pendiente
    </span>
  );
}

function InfoLine({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span>{texto}</span>
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
    .slice(0, 45);
}

function extensionPorTipo(
  tipo: "imagen" | "pdf" | "otro",
  ruta: string | null
) {
  if (ruta) {
    const limpia = ruta.split("?")[0];
    const match = limpia.match(/\.[a-zA-Z0-9]+$/);
    if (match?.[0]) return match[0].toLowerCase();
  }

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