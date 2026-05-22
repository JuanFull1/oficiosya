"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ConfiguracionPublicaciones = {
  id: number;
  clave: string;
  max_solicitudes: number;
  ventana_minutos: number;
  activo: boolean;
  actualizado_en: string;
};

const CACHE_KEY = "oficiosya-admin-parametros-cache";
const CLAVE_PUBLICACIONES = "limite_publicaciones";

export default function ParametrosAdminView() {
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionPublicaciones | null>(null);

  const [maxSolicitudes, setMaxSolicitudes] = useState(3);
  const [ventanaMinutos, setVentanaMinutos] = useState(10);
  const [activo, setActivo] = useState(true);

  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw) as ConfiguracionPublicaciones;
      setConfiguracion(data);
      setMaxSolicitudes(Number(data.max_solicitudes || 3));
      setVentanaMinutos(Number(data.ventana_minutos || 10));
      setActivo(Boolean(data.activo));
    } catch (err) {
      console.error("No se pudo leer cache parámetros admin:", err);
    }
  }, []);

  const guardarCache = useCallback((data: ConfiguracionPublicaciones) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("No se pudo guardar cache parámetros admin:", err);
    }
  }, []);

  const aplicarConfiguracion = useCallback(
    (data: ConfiguracionPublicaciones) => {
      setConfiguracion(data);
      setMaxSolicitudes(Number(data.max_solicitudes || 3));
      setVentanaMinutos(Number(data.ventana_minutos || 10));
      setActivo(Boolean(data.activo));
      guardarCache(data);
    },
    [guardarCache]
  );

  const cargarConfiguracion = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data, error: consultaError } = await supabase
        .from("configuracion_publicaciones")
        .select("id,clave,max_solicitudes,ventana_minutos,activo,actualizado_en")
        .order("id", { ascending: true })
        .limit(1);

      if (consultaError) {
        console.error("Error al cargar configuración:", consultaError);
        setError("No se pudieron cargar los parámetros del sistema.");
        return;
      }

      const registro = data?.[0] as ConfiguracionPublicaciones | undefined;

      if (registro) {
        aplicarConfiguracion(registro);
        return;
      }

      const nuevaConfig = {
        clave: CLAVE_PUBLICACIONES,
        max_solicitudes: 3,
        ventana_minutos: 10,
        activo: true,
      };

      const { data: insertada, error: insertError } = await supabase
        .from("configuracion_publicaciones")
        .insert(nuevaConfig)
        .select(
          "id,clave,max_solicitudes,ventana_minutos,activo,actualizado_en"
        )
        .single();

      if (insertError) {
        console.error("Error al crear configuración inicial:", insertError);
        setError(
          "No se encontró configuración inicial y no se pudo crear automáticamente."
        );
        return;
      }

      aplicarConfiguracion(insertada as ConfiguracionPublicaciones);
    } catch (err) {
      console.error("Error general parámetros admin:", err);
      setError("Ocurrió un error al sincronizar los parámetros.");
    } finally {
      setSincronizando(false);
    }
  }, [aplicarConfiguracion]);

  useEffect(() => {
    leerCache();
    cargarConfiguracion();
  }, [leerCache, cargarConfiguracion]);

  const guardarCambios = async () => {
    setGuardando(true);
    setMensaje("");
    setError("");

    const maxNormalizado = Number(maxSolicitudes);
    const ventanaNormalizada = Number(ventanaMinutos);

    if (!Number.isFinite(maxNormalizado) || maxNormalizado < 1) {
      setError("El máximo de publicaciones debe ser mayor o igual a 1.");
      setGuardando(false);
      return;
    }

    if (!Number.isFinite(ventanaNormalizada) || ventanaNormalizada < 1) {
      setError("La ventana de tiempo debe ser mayor o igual a 1 minuto.");
      setGuardando(false);
      return;
    }

    if (maxNormalizado > 50) {
      setError("El máximo de publicaciones no debería superar 50.");
      setGuardando(false);
      return;
    }

    if (ventanaNormalizada > 1440) {
      setError("La ventana de tiempo no debería superar 1440 minutos.");
      setGuardando(false);
      return;
    }

    try {
      let respuesta;

      if (configuracion?.id) {
        respuesta = await supabase
          .from("configuracion_publicaciones")
          .update({
            max_solicitudes: maxNormalizado,
            ventana_minutos: ventanaNormalizada,
            activo,
            actualizado_en: new Date().toISOString(),
          })
          .eq("id", configuracion.id)
          .select(
            "id,clave,max_solicitudes,ventana_minutos,activo,actualizado_en"
          )
          .single();
      } else {
        respuesta = await supabase
          .from("configuracion_publicaciones")
          .insert({
            clave: CLAVE_PUBLICACIONES,
            max_solicitudes: maxNormalizado,
            ventana_minutos: ventanaNormalizada,
            activo,
          })
          .select(
            "id,clave,max_solicitudes,ventana_minutos,activo,actualizado_en"
          )
          .single();
      }

      if (respuesta.error) {
        console.error("Error al guardar parámetros:", respuesta.error);
        setError("No se pudieron guardar los parámetros.");
        return;
      }

      aplicarConfiguracion(respuesta.data as ConfiguracionPublicaciones);
      setMensaje("Parámetros actualizados correctamente.");
    } catch (err) {
      console.error("Error general guardando parámetros:", err);
      setError("Ocurrió un error al guardar los parámetros.");
    } finally {
      setGuardando(false);
    }
  };

  const reglaTexto = useMemo(() => {
    if (!activo) {
      return "La regla anti-spam está desactivada. Los usuarios podrán publicar sin este límite.";
    }

    return `Un usuario podrá publicar hasta ${maxSolicitudes} solicitud(es) cada ${ventanaMinutos} minuto(s).`;
  }, [activo, maxSolicitudes, ventanaMinutos]);

  const estadoRegla = activo ? "Activa" : "Desactivada";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <Settings2 size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    Parámetros del sistema
                  </h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Controla reglas generales del sistema, como límites de
                  publicación para evitar spam.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cargarConfiguracion}
              disabled={sincronizando || guardando}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw
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
        <MetricCard
          titulo="Estado de regla"
          valor={estadoRegla}
          icon={<ShieldCheck size={21} />}
          verde={activo}
          rojo={!activo}
        />

        <MetricCard
          titulo="Máximo permitido"
          valor={`${maxSolicitudes}`}
          subtitulo="solicitudes"
          icon={<SlidersHorizontal size={21} />}
          ambar
        />

        <MetricCard
          titulo="Ventana de tiempo"
          valor={`${ventanaMinutos}`}
          subtitulo="minutos"
          icon={<Clock3 size={21} />}
        />

        <MetricCard
          titulo="Última actualización"
          valor={
            configuracion?.actualizado_en
              ? formatearFecha(configuracion.actualizado_en)
              : "Sin registro"
          }
          icon={<CheckCircle2 size={21} />}
          verde
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <SlidersHorizontal size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Regla anti-spam de publicaciones
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Define cuántas solicitudes puede publicar un usuario en un
                rango corto de tiempo.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    Activar regla de control
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Cuando esté activa, el sistema bloqueará publicaciones
                    repetidas en poco tiempo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActivo((prev) => !prev)}
                  className={`relative h-9 w-16 rounded-full transition ${
                    activo ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label="Activar o desactivar regla"
                >
                  <span
                    className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${
                      activo ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CampoNumero
                titulo="Máximo de solicitudes"
                descripcion="Cantidad máxima que podrá publicar un usuario."
                valor={maxSolicitudes}
                onChange={setMaxSolicitudes}
                min={1}
                max={50}
              />

              <CampoNumero
                titulo="Ventana de tiempo"
                descripcion="Tiempo en minutos que se tomará para revisar publicaciones repetidas."
                valor={ventanaMinutos}
                onChange={setVentanaMinutos}
                min={1}
                max={1440}
              />
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 text-amber-700">
                  <AlertTriangle size={20} />
                </div>

                <div>
                  <p className="font-bold text-amber-900">
                    Vista previa de la regla
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800">
                    {reglaTexto}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={cargarConfiguracion}
                disabled={sincronizando || guardando}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  size={16}
                  className={sincronizando ? "animate-spin" : ""}
                />
                Restaurar
              </button>

              <button
                type="button"
                onClick={guardarCambios}
                disabled={sincronizando || guardando}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Cómo se aplicará
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Esta configuración se usará al momento de publicar una nueva
                solicitud.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Paso
              numero="1"
              titulo="El cliente intenta publicar"
              texto="El sistema revisa si la regla está activa."
            />

            <Paso
              numero="2"
              titulo="Se revisan publicaciones recientes"
              texto="Se cuentan las solicitudes creadas por ese usuario dentro de la ventana definida."
            />

            <Paso
              numero="3"
              titulo="Se permite o se bloquea"
              texto="Si supera el máximo, se muestra un mensaje y no se registra la solicitud."
            />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mensaje sugerido al usuario
            </p>

            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">
              Has publicado varias solicitudes en poco tiempo. Intenta
              nuevamente en unos minutos.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  titulo,
  valor,
  subtitulo,
  icon,
  verde = false,
  rojo = false,
  ambar = false,
}: {
  titulo: string;
  valor: string;
  subtitulo?: string;
  icon: ReactNode;
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
        {icon}
      </div>

      <p className="text-sm font-semibold text-slate-500">{titulo}</p>

      <div className="mt-1 flex items-end gap-2">
        <p className="text-2xl font-bold text-slate-900">{valor}</p>
        {subtitulo && (
          <p className="pb-1 text-xs font-semibold text-slate-400">
            {subtitulo}
          </p>
        )}
      </div>
    </div>
  );
}

function CampoNumero({
  titulo,
  descripcion,
  valor,
  onChange,
  min,
  max,
}: {
  titulo: string;
  descripcion: string;
  valor: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block rounded-3xl border border-slate-200 bg-white p-4">
      <span className="font-bold text-slate-900">{titulo}</span>
      <span className="mt-1 block text-sm text-slate-500">{descripcion}</span>

      <input
        type="number"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white"
      />
    </label>
  );
}

function Paso({
  numero,
  titulo,
  texto,
}: {
  numero: string;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
          {numero}
        </div>

        <div>
          <p className="font-bold text-slate-900">{titulo}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {texto}
          </p>
        </div>
      </div>
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