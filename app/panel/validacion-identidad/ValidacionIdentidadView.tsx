"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  IdCard,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  correo: string | null;
  foto_url: string | null;
  verificado: boolean;
  es_admin: boolean;
};

type Verificacion = {
  id: string;
  usuario_id: string;
  tipo_documento: string;
  numero_documento: string;
  archivo_documento_url: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  revisado_por: string | null;
  revisado_en: string | null;
  creado_en: string;
  actualizado_en: string;
};

type VerificacionAdmin = Verificacion & {
  perfil?: Perfil | null;
};

type CacheValidacion = {
  usuarioId: string;
  perfil: Perfil | null;
  verificacion: Verificacion | null;
  verificacionesAdmin: VerificacionAdmin[];
};

const CACHE_KEY = "oficiosya-validacion-identidad-cache";

export default function ValidacionIdentidadView() {
  const [usuarioId, setUsuarioId] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [verificacion, setVerificacion] = useState<Verificacion | null>(null);
  const [verificacionesAdmin, setVerificacionesAdmin] = useState<
    VerificacionAdmin[]
  >([]);

  const [tipoDocumento, setTipoDocumento] = useState("cedula");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const esAdmin = perfil?.es_admin === true;
  const estadoActual = verificacion?.estado ?? "sin_enviar";

  const guardarCache = useCallback(
    (
      nuevoUsuarioId: string,
      nuevoPerfil: Perfil | null,
      nuevaVerificacion: Verificacion | null,
      nuevasVerificacionesAdmin: VerificacionAdmin[]
    ) => {
      try {
        const cache: CacheValidacion = {
          usuarioId: nuevoUsuarioId,
          perfil: nuevoPerfil,
          verificacion: nuevaVerificacion,
          verificacionesAdmin: nuevasVerificacionesAdmin,
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (err) {
        console.error("No se pudo guardar cache de validación:", err);
      }
    },
    []
  );

  const leerCache = useCallback(() => {
    try {
      const cacheRaw = localStorage.getItem(CACHE_KEY);
      if (!cacheRaw) return;

      const cache = JSON.parse(cacheRaw) as CacheValidacion;

      setUsuarioId(cache.usuarioId || "");
      setPerfil(cache.perfil || null);
      setVerificacion(cache.verificacion || null);
      setVerificacionesAdmin(cache.verificacionesAdmin || []);

      if (cache.verificacion) {
        setTipoDocumento(cache.verificacion.tipo_documento || "cedula");
        setNumeroDocumento(cache.verificacion.numero_documento || "");
      }
    } catch (err) {
      console.error("No se pudo leer cache de validación:", err);
    }
  }, []);

  const cargarVerificacionesAdmin = useCallback(async () => {
    const { data: verificacionesData, error: verificacionesError } =
      await supabase
        .from("verificaciones_identidad")
        .select("*")
        .order("creado_en", { ascending: false });

    if (verificacionesError) {
      console.error("Error al cargar verificaciones admin:", verificacionesError);
      return [];
    }

    const verificaciones = (verificacionesData || []) as Verificacion[];
    const usuariosIds = Array.from(
      new Set(verificaciones.map((item) => item.usuario_id))
    );

    let perfilesPorUsuario: Record<string, Perfil> = {};

    if (usuariosIds.length > 0) {
      const { data: perfilesData, error: perfilesError } = await supabase
        .from("perfiles")
        .select(
          "id,nombre_completo,telefono,correo,foto_url,verificado,es_admin"
        )
        .in("id", usuariosIds);

      if (!perfilesError && perfilesData) {
        perfilesPorUsuario = perfilesData.reduce((acc, item) => {
          acc[item.id] = item as Perfil;
          return acc;
        }, {} as Record<string, Perfil>);
      }
    }

    return verificaciones.map((item) => ({
      ...item,
      perfil: perfilesPorUsuario[item.usuario_id] || null,
    }));
  }, []);

  const cargarDatosSegundoPlano = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError("No se pudo validar tu sesión.");
        return;
      }

      const userId = authData.user.id;
      setUsuarioId(userId);

      const [{ data: perfilData, error: perfilError }, { data: verificacionData }] =
        await Promise.all([
          supabase
            .from("perfiles")
            .select(
              "id,nombre_completo,telefono,correo,foto_url,verificado,es_admin"
            )
            .eq("id", userId)
            .maybeSingle(),

          supabase
            .from("verificaciones_identidad")
            .select("*")
            .eq("usuario_id", userId)
            .order("creado_en", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (perfilError) {
        console.error("Error al cargar perfil:", perfilError);
        setError("No se pudo cargar tu perfil.");
        return;
      }

      const nuevoPerfil = (perfilData as Perfil | null) || null;
      const nuevaVerificacion = (verificacionData as Verificacion | null) || null;

      setPerfil(nuevoPerfil);
      setVerificacion(nuevaVerificacion);

      if (nuevaVerificacion) {
        setTipoDocumento(nuevaVerificacion.tipo_documento || "cedula");
        setNumeroDocumento(nuevaVerificacion.numero_documento || "");
      }

      let nuevasVerificacionesAdmin: VerificacionAdmin[] = [];

      if (nuevoPerfil?.es_admin) {
        nuevasVerificacionesAdmin = await cargarVerificacionesAdmin();
        setVerificacionesAdmin(nuevasVerificacionesAdmin);
      } else {
        setVerificacionesAdmin([]);
      }

      guardarCache(
        userId,
        nuevoPerfil,
        nuevaVerificacion,
        nuevasVerificacionesAdmin
      );
    } catch (err) {
      console.error("Error general al cargar validación:", err);
      setError("Ocurrió un error al sincronizar la validación.");
    } finally {
      setSincronizando(false);
    }
  }, [cargarVerificacionesAdmin, guardarCache]);

  useEffect(() => {
    leerCache();
    cargarDatosSegundoPlano();
  }, [leerCache, cargarDatosSegundoPlano]);

  const estadoInfo = useMemo(() => {
    if (estadoActual === "aprobado") {
      return {
        texto: "Identidad verificada",
        descripcion: "Tu cuenta ya fue revisada y aparece como verificada.",
        icono: CheckCircle2,
        clases: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (estadoActual === "rechazado") {
      return {
        texto: "Solicitud no aprobada",
        descripcion:
          "Puedes corregir tus datos y enviar nuevamente tu documento.",
        icono: XCircle,
        clases: "border-red-200 bg-red-50 text-red-700",
      };
    }

    if (estadoActual === "pendiente") {
      return {
        texto: "Solicitud enviada",
        descripcion: "Tus datos están pendientes de revisión.",
        icono: Clock3,
        clases: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    return {
      texto: "Validación pendiente",
      descripcion: "Envía tu documento para aumentar la confianza de tu perfil.",
      icono: IdCard,
      clases: "border-slate-200 bg-white text-slate-700",
    };
  }, [estadoActual]);

  const limpiarNombreArchivo = (nombre: string) => {
    return nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.-]/g, "");
  };

  const enviarVerificacion = async () => {
    setError("");
    setMensaje("");

    if (!usuarioId) {
      setError("Espera unos segundos mientras se sincroniza tu sesión.");
      await cargarDatosSegundoPlano();
      return;
    }

    if (!tipoDocumento.trim()) {
      setError("Selecciona el tipo de documento.");
      return;
    }

    if (!numeroDocumento.trim()) {
      setError("Ingresa el número de documento.");
      return;
    }

    if (!archivo && !verificacion?.archivo_documento_url) {
      setError("Sube una imagen o PDF de tu documento.");
      return;
    }

    try {
      setGuardando(true);

      let rutaArchivo = verificacion?.archivo_documento_url || null;

      if (archivo) {
        const extension = archivo.name.split(".").pop() || "pdf";
        const nombreSeguro = limpiarNombreArchivo(
          archivo.name || `documento.${extension}`
        );

        const ruta = `${usuarioId}/${Date.now()}-${nombreSeguro}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos-identidad")
          .upload(ruta, archivo, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Error al subir documento:", uploadError);
          setError("No se pudo subir el documento.");
          return;
        }

        rutaArchivo = ruta;
      }

      if (verificacion?.id) {
        const { data, error: updateError } = await supabase
          .from("verificaciones_identidad")
          .update({
            tipo_documento: tipoDocumento,
            numero_documento: numeroDocumento.trim(),
            archivo_documento_url: rutaArchivo,
            estado: "pendiente",
            actualizado_en: new Date().toISOString(),
          })
          .eq("id", verificacion.id)
          .eq("usuario_id", usuarioId)
          .select("*")
          .single();

        if (updateError) {
          console.error("Error al actualizar verificación:", updateError);
          setError("No se pudo actualizar la solicitud.");
          return;
        }

        const nuevaVerificacion = data as Verificacion;
        setVerificacion(nuevaVerificacion);
        guardarCache(usuarioId, perfil, nuevaVerificacion, verificacionesAdmin);
      } else {
        const { data, error: insertError } = await supabase
          .from("verificaciones_identidad")
          .insert({
            usuario_id: usuarioId,
            tipo_documento: tipoDocumento,
            numero_documento: numeroDocumento.trim(),
            archivo_documento_url: rutaArchivo,
            estado: "pendiente",
          })
          .select("*")
          .single();

        if (insertError) {
          console.error("Error al crear verificación:", insertError);
          setError("No se pudo enviar la solicitud.");
          return;
        }

        const nuevaVerificacion = data as Verificacion;
        setVerificacion(nuevaVerificacion);
        guardarCache(usuarioId, perfil, nuevaVerificacion, verificacionesAdmin);
      }

      setMensaje("Tu solicitud fue enviada correctamente.");
      setArchivo(null);
      cargarDatosSegundoPlano();
    } catch (err) {
      console.error("Error al enviar verificación:", err);
      setError("Ocurrió un error al enviar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  const abrirDocumento = async (ruta: string | null) => {
    if (!ruta) return;

    setError("");

    if (ruta.startsWith("http")) {
      window.open(ruta, "_blank");
      return;
    }

    const { data, error: signedError } = await supabase.storage
      .from("documentos-identidad")
      .createSignedUrl(ruta, 60 * 5);

    if (signedError || !data?.signedUrl) {
      console.error("Error al abrir documento:", signedError);
      setError("No se pudo abrir el documento.");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const revisarVerificacion = async (
    item: VerificacionAdmin,
    nuevoEstado: "aprobado" | "rechazado"
  ) => {
    if (!usuarioId) return;

    setError("");
    setMensaje("");
    setRevisandoId(item.id);

    const { data, error: updateError } = await supabase
      .from("verificaciones_identidad")
      .update({
        estado: nuevoEstado,
        revisado_por: usuarioId,
        revisado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", item.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error al revisar verificación:", updateError);
      setError("No se pudo actualizar la revisión.");
      setRevisandoId(null);
      return;
    }

    const listaActualizada = verificacionesAdmin.map((verif) =>
      verif.id === item.id
        ? {
            ...(data as Verificacion),
            perfil: item.perfil,
          }
        : verif
    );

    setVerificacionesAdmin(listaActualizada);

    guardarCache(usuarioId, perfil, verificacion, listaActualizada);

    setMensaje(
      nuevoEstado === "aprobado"
        ? "La identidad fue aprobada correctamente."
        : "La solicitud fue rechazada correctamente."
    );

    setRevisandoId(null);
    cargarDatosSegundoPlano();
  };

  const EstadoIcono = estadoInfo.icono;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <ShieldCheck size={22} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Validación de identidad
                </h1>

                {sincronizando && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    <Loader2 size={12} className="animate-spin" />
                    Actualizando
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-500">
                Verifica tu cuenta para generar más confianza en la comunidad.
              </p>
            </div>
          </div>

          {perfil?.verificado && (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <BadgeCheck size={18} />
              Perfil verificado
            </div>
          )}
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

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${estadoInfo.clases}`}
            >
              <EstadoIcono size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {estadoInfo.texto}
              </h2>
              <p className="text-sm text-slate-500">
                {estadoInfo.descripcion}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Tipo de documento
              </label>

              <select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                disabled={estadoActual === "aprobado"}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 disabled:bg-slate-100"
              >
                <option value="cedula">Cédula</option>
                <option value="pasaporte">Pasaporte</option>
                <option value="ruc">RUC</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Número de documento
              </label>

              <input
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                disabled={estadoActual === "aprobado"}
                placeholder="Ingresa tu número de documento"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Documento
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:bg-slate-100">
                <Upload className="mb-2 text-slate-500" size={28} />

                <span className="text-sm font-semibold text-slate-700">
                  {archivo
                    ? archivo.name
                    : verificacion?.archivo_documento_url
                    ? "Documento cargado"
                    : "Sube una imagen o PDF"}
                </span>

                <span className="mt-1 text-xs text-slate-500">
                  Formatos permitidos: JPG, PNG, WEBP o PDF
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={estadoActual === "aprobado"}
                  onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {verificacion?.archivo_documento_url && (
                <button
                  type="button"
                  onClick={() =>
                    abrirDocumento(verificacion.archivo_documento_url)
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={16} />
                  Ver documento enviado
                </button>
              )}
            </div>

            {estadoActual !== "aprobado" && (
              <button
                type="button"
                onClick={enviarVerificacion}
                disabled={guardando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {guardando ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
                {verificacion ? "Actualizar solicitud" : "Enviar solicitud"}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Información de tu perfil
          </h2>

          <div className="space-y-3">
            <InfoItem
              titulo="Nombre"
              valor={perfil?.nombre_completo || "Sin registrar"}
            />
            <InfoItem titulo="Correo" valor={perfil?.correo || "Sin registrar"} />
            <InfoItem
              titulo="Teléfono"
              valor={perfil?.telefono || "Sin registrar"}
            />
            <InfoItem
              titulo="Estado"
              valor={perfil?.verificado ? "Verificado" : "No verificado"}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 text-slate-500" size={20} />
              <p className="text-sm text-slate-600">
                Tus datos se usan únicamente para validar tu identidad y mejorar
                la confianza dentro de OficiosYA.
              </p>
            </div>
          </div>
        </section>
      </div>

      {esAdmin && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Solicitudes recibidas
              </h2>
              <p className="text-sm text-slate-500">
                Revisa los documentos enviados por los usuarios.
              </p>
            </div>
          </div>

          {verificacionesAdmin.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              No hay solicitudes de validación por ahora.
            </div>
          ) : (
            <div className="grid gap-4">
              {verificacionesAdmin.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <FileText size={22} />
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900">
                          {item.perfil?.nombre_completo || "Usuario sin nombre"}
                        </h3>

                        <p className="text-sm text-slate-500">
                          {item.perfil?.correo || "Correo no registrado"}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                            {item.tipo_documento}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                            {item.numero_documento}
                          </span>

                          <EstadoBadge estado={item.estado} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.archivo_documento_url && (
                        <button
                          type="button"
                          onClick={() => abrirDocumento(item.archivo_documento_url)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye size={16} />
                          Ver documento
                        </button>
                      )}

                      {item.estado === "pendiente" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              revisarVerificacion(item, "aprobado")
                            }
                            disabled={revisandoId === item.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
                          >
                            {revisandoId === item.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                            Aprobar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              revisarVerificacion(item, "rechazado")
                            }
                            disabled={revisandoId === item.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                          >
                            {revisandoId === item.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <XCircle size={16} />
                            )}
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function InfoItem({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{valor}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "aprobado") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
        Aprobado
      </span>
    );
  }

  if (estado === "rechazado") {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">
        Rechazado
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
      Pendiente
    </span>
  );
}