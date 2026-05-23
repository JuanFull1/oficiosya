"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Clock3,
  LocateFixed,
  Mail,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldCheck,
  Star,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

type PuntoMapa = {
  lat: number | null;
  lng: number | null;
  nombre: string;
  rumbo?: number | null;
};

type MapaSeguimientoProps = {
  cliente: PuntoMapa;
  trabajador: PuntoMapa;
  modo: "cliente" | "trabajador";
};

const MapaSeguimiento = dynamic<MapaSeguimientoProps>(
  () => import("./MapaSeguimiento"),
  { ssr: false }
);

type Coordenadas = {
  lat: number;
  lng: number;
};

type SolicitudServicio = {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  zona: string | null;
  referencia_direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  direccion_mapa: string | null;
  referencia_mapa: string | null;
};

type PerfilServicio = {
  id: string;
  nombre_completo: string | null;
  telefono: string | null;
  correo: string | null;
  foto_url: string | null;
  zona: string | null;
};

type ServicioActivo = {
  id: string;
  estado: string;
  solicitud_id: string;
  cliente_id: string;
  trabajador_id: string;
  creado_en?: string | null;
  solicitud?: SolicitudServicio | SolicitudServicio[] | null;
  cliente?: PerfilServicio | PerfilServicio[] | null;
  trabajador?: PerfilServicio | PerfilServicio[] | null;
};

type Seguimiento = {
  id: string;
  servicio_id: string;
  trabajador_id: string;
  cliente_id: string;
  activo: boolean;
  latitud_actual: number | null;
  longitud_actual: number | null;
  precision_metros: number | null;
  velocidad: number | null;
  direccion_grados: number | null;
  ultima_actualizacion: string | null;
  iniciado_en: string | null;
  finalizado_en: string | null;
};

type UbicacionLocal = {
  lat: number | null;
  lng: number | null;
  rumbo: number | null;
};

const marcadorEdicionIcono = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 10px 14px rgba(220,38,38,.35));
    ">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="#dc2626" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.6" fill="white"/>
      </svg>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 40],
  popupAnchor: [0, -38],
});

function SelectorMapaUbicacion({
  posicion,
  setPosicion,
}: {
  posicion: Coordenadas | null;
  setPosicion: (posicion: Coordenadas) => void;
}) {
  useMapEvents({
    click(event) {
      setPosicion({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  if (!posicion) return null;

  return (
    <Marker
      position={[posicion.lat, posicion.lng]}
      icon={marcadorEdicionIcono}
    />
  );
}

function RecentrarMapaUbicacion({
  posicion,
}: {
  posicion: Coordenadas | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (posicion) {
      setTimeout(() => {
        map.invalidateSize();
        map.setView([posicion.lat, posicion.lng], 17);
      }, 150);
    }
  }, [map, posicion]);

  return null;
}

function obtenerPrimero<T>(data: T | T[] | null | undefined): T | null {
  return Array.isArray(data) ? data[0] || null : data || null;
}

function extraerCoordenadas(texto?: string | null) {
  if (!texto) return { lat: null, lng: null };

  const limpio = texto.replace(/[()]/g, " ");
  const partes = limpio
    .split(/[,\s]+/)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  if (partes.length >= 2) {
    return {
      lat: partes[0],
      lng: partes[1],
    };
  }

  return { lat: null, lng: null };
}

function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const radioTierra = 6371000;
  const rad = Math.PI / 180;

  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return radioTierra * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SeguimientoView() {
  const watchIdRef = useRef<number | null>(null);
  const ultimaSubidaRef = useRef<{
    tiempo: number;
    lat: number | null;
    lng: number | null;
  }>({
    tiempo: 0,
    lat: null,
    lng: null,
  });

  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [servicio, setServicio] = useState<ServicioActivo | null>(null);
  const [seguimiento, setSeguimiento] = useState<Seguimiento | null>(null);
  const [ubicacionActual, setUbicacionActual] = useState<UbicacionLocal>({
    lat: null,
    lng: null,
    rumbo: null,
  });

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [compartiendoUbicacion, setCompartiendoUbicacion] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [modalUbicacionAbierto, setModalUbicacionAbierto] = useState(false);
  const [modalCancelarAbierto, setModalCancelarAbierto] = useState(false);
  const [nuevaUbicacion, setNuevaUbicacion] = useState<Coordenadas | null>(
    null
  );
  const [nuevaReferencia, setNuevaReferencia] = useState("");
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);
  const [ubicandoCliente, setUbicandoCliente] = useState(false);

  const solicitud = useMemo(
    () => obtenerPrimero(servicio?.solicitud),
    [servicio]
  );

  const cliente = useMemo(() => obtenerPrimero(servicio?.cliente), [servicio]);

  const trabajador = useMemo(
    () => obtenerPrimero(servicio?.trabajador),
    [servicio]
  );

  const esClienteEnEsteServicio = servicio?.cliente_id === usuarioId;
  const esTrabajadorEnEsteServicio = servicio?.trabajador_id === usuarioId;

  const personaMostrada = esTrabajadorEnEsteServicio ? cliente : trabajador;

  const tituloPersona = esTrabajadorEnEsteServicio
    ? "Información del cliente"
    : "Información del trabajador";

  const nombrePersona =
    personaMostrada?.nombre_completo ||
    (esTrabajadorEnEsteServicio
      ? "Cliente del servicio"
      : "Trabajador asignado");

  const nombreTrabajador = trabajador?.nombre_completo || "Trabajador asignado";

  const direccionServicio =
    solicitud?.zona ||
    solicitud?.referencia_mapa ||
    solicitud?.referencia_direccion ||
    solicitud?.direccion_mapa ||
    "Dirección del servicio";

  const estadoTexto = useMemo(() => {
    const estados: Record<string, string> = {
      solicitado: "Solicitado",
      en_negociacion: "En negociación",
      confirmado: "Confirmado",
      en_camino: "El trabajador va en camino",
      en_curso: "Servicio en curso",
      finalizado: "Servicio finalizado",
      cancelado: "Servicio cancelado",
    };

    return estados[servicio?.estado || ""] || "Sin estado";
  }, [servicio?.estado]);

  const cargarSeguimiento = async () => {
    if (!usuarioId) return;

    setError("");
    setCargando(true);

    try {
      const { data: servicioData, error: servicioError } = await supabase
        .from("servicios")
        .select(
          `
          id,
          estado,
          solicitud_id,
          cliente_id,
          trabajador_id,
          creado_en,
          solicitud:solicitudes_servicio!servicios_solicitud_id_fkey (
            id,
            titulo,
            descripcion,
            zona,
            referencia_direccion,
            latitud,
            longitud,
            direccion_mapa,
            referencia_mapa
          ),
          cliente:perfiles!servicios_cliente_id_fkey (
            id,
            nombre_completo,
            telefono,
            correo,
            foto_url,
            zona
          ),
          trabajador:perfiles!servicios_trabajador_id_fkey (
            id,
            nombre_completo,
            telefono,
            correo,
            foto_url,
            zona
          )
        `
        )
        .or(`cliente_id.eq.${usuarioId},trabajador_id.eq.${usuarioId}`)
        .in("estado", ["confirmado", "en_camino", "en_curso"])
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (servicioError) throw servicioError;

      if (!servicioData) {
        setServicio(null);
        setSeguimiento(null);
        return;
      }

      setServicio(servicioData as unknown as ServicioActivo);

      const { data: seguimientoData, error: seguimientoError } = await supabase
        .from("seguimientos_servicio")
        .select("*")
        .eq("servicio_id", servicioData.id)
        .maybeSingle();

      if (seguimientoError) throw seguimientoError;

      setSeguimiento(seguimientoData as Seguimiento | null);
    } catch (err) {
      console.error("Error al cargar seguimiento:", err);
      setError("No se pudo cargar el seguimiento del servicio.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const obtenerUsuario = async () => {
      const { data } = await supabase.auth.getUser();
      setUsuarioId(data.user?.id || null);
    };

    obtenerUsuario();
  }, []);

  useEffect(() => {
    if (usuarioId) cargarSeguimiento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  useEffect(() => {
    if (!servicio?.id) return;

    const nombreCanal = `seguimiento-servicio-${servicio.id}-${Date.now()}`;

    const canal = supabase
      .channel(nombreCanal)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seguimientos_servicio",
          filter: `servicio_id=eq.${servicio.id}`,
        },
        (payload) => {
          if (payload.new) {
            setSeguimiento(payload.new as Seguimiento);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "servicios",
          filter: `id=eq.${servicio.id}`,
        },
        (payload) => {
          if (payload.new) {
            setServicio((actual) =>
              actual
                ? { ...actual, ...(payload.new as Partial<ServicioActivo>) }
                : actual
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solicitudes_servicio",
          filter: `id=eq.${servicio.solicitud_id}`,
        },
        (payload) => {
          if (payload.new) {
            setServicio((actual) =>
              actual
                ? {
                    ...actual,
                    solicitud: payload.new as SolicitudServicio,
                  }
                : actual
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [servicio?.id, servicio?.solicitud_id]);

  useEffect(() => {
    if (!esTrabajadorEnEsteServicio) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUbicacionActual({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          rumbo: position.coords.heading || null,
        });
      },
      (err) => {
        console.error("No se pudo obtener ubicación inicial:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      }
    );
  }, [esTrabajadorEnEsteServicio]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const guardarUbicacionTrabajador = async (position: GeolocationPosition) => {
    if (!servicio?.id) return;

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const rumbo = position.coords.heading || null;
    const ahoraMs = Date.now();

    setUbicacionActual({
      lat,
      lng,
      rumbo,
    });

    const ultima = ultimaSubidaRef.current;

    const pasaronDiezSegundos = ahoraMs - ultima.tiempo >= 10000;

    const distancia =
      ultima.lat !== null && ultima.lng !== null
        ? distanciaMetros(ultima.lat, ultima.lng, lat, lng)
        : 9999;

    const seMovioSuficiente = distancia >= 10;

    const esPrimeraUbicacion = ultima.lat === null || ultima.lng === null;

    if (!esPrimeraUbicacion && (!pasaronDiezSegundos || !seMovioSuficiente)) {
      return;
    }

    const ahora = new Date().toISOString();

    const { error } = await supabase
      .from("seguimientos_servicio")
      .update({
        latitud_actual: lat,
        longitud_actual: lng,
        precision_metros: position.coords.accuracy || null,
        velocidad: position.coords.speed || null,
        direccion_grados: rumbo,
        ultima_actualizacion: ahora,
        actualizado_en: ahora,
      })
      .eq("servicio_id", servicio.id);

    if (error) {
      console.error("Error al guardar ubicación:", error);
      setError("No se pudo actualizar tu ubicación en vivo.");
      return;
    }

    ultimaSubidaRef.current = {
      tiempo: ahoraMs,
      lat,
      lng,
    };
  };

  const iniciarGPS = () => {
    if (!navigator.geolocation) {
      setError("Tu navegador no permite usar geolocalización.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setCompartiendoUbicacion(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      guardarUbicacionTrabajador,
      (err) => {
        console.error("Error de GPS:", err);
        setCompartiendoUbicacion(false);
        setError("Activa el permiso de ubicación para compartir tu recorrido.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      }
    );
  };

  const cambiarEstadoServicio = async (nuevoEstado: string) => {
    if (!servicio?.id) return;

    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      const ahora = new Date().toISOString();

      const datosServicio: Record<string, string> = {
        estado: nuevoEstado,
        actualizado_en: ahora,
      };

      if (nuevoEstado === "en_camino") datosServicio.iniciado_en = ahora;
      if (nuevoEstado === "finalizado") datosServicio.finalizado_en = ahora;

      const { error: servicioError } = await supabase
        .from("servicios")
        .update(datosServicio)
        .eq("id", servicio.id);

      if (servicioError) throw servicioError;

      if (nuevoEstado === "en_camino") {
        const { error: seguimientoError } = await supabase
          .from("seguimientos_servicio")
          .update({
            activo: true,
            iniciado_en: ahora,
            ultima_actualizacion: ahora,
            actualizado_en: ahora,
          })
          .eq("servicio_id", servicio.id);

        if (seguimientoError) throw seguimientoError;

        iniciarGPS();
      }

      if (nuevoEstado === "en_curso") {
        const { error: seguimientoError } = await supabase
          .from("seguimientos_servicio")
          .update({
            activo: true,
            actualizado_en: ahora,
          })
          .eq("servicio_id", servicio.id);

        if (seguimientoError) throw seguimientoError;
      }

      if (nuevoEstado === "finalizado") {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        setCompartiendoUbicacion(false);

        const { error: seguimientoError } = await supabase
          .from("seguimientos_servicio")
          .update({
            activo: false,
            finalizado_en: ahora,
            actualizado_en: ahora,
          })
          .eq("servicio_id", servicio.id);

        if (seguimientoError) throw seguimientoError;
      }

      setMensaje("Estado actualizado correctamente.");
      await cargarSeguimiento();
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      setError("No se pudo actualizar el estado del servicio.");
    } finally {
      setProcesando(false);
    }
  };

  const solicitarCancelarServicio = () => {
    if (!servicio?.id || procesando) return;
    setError("");
    setMensaje("");
    setModalCancelarAbierto(true);
  };

  const cancelarServicio = async () => {
    if (!servicio?.id) return;

    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      const ahora = new Date().toISOString();

      const { error: errorServicio } = await supabase
        .from("servicios")
        .update({
          estado: "cancelado",
          finalizado_en: ahora,
          actualizado_en: ahora,
        })
        .eq("id", servicio.id);

      if (errorServicio) throw errorServicio;

      const { error: errorSeguimiento } = await supabase
        .from("seguimientos_servicio")
        .update({
          activo: false,
          finalizado_en: ahora,
          actualizado_en: ahora,
        })
        .eq("servicio_id", servicio.id);

      if (errorSeguimiento) throw errorSeguimiento;

      setModalCancelarAbierto(false);
      setMensaje("El servicio fue cancelado correctamente.");
      await cargarSeguimiento();
    } catch (err) {
      console.error("Error al cancelar servicio:", err);
      setError("No se pudo cancelar el servicio.");
    } finally {
      setProcesando(false);
    }
  };

  const abrirModalUbicacion = () => {
    if (!solicitud) return;

    const coords = extraerCoordenadas(solicitud.direccion_mapa);

    setNuevaUbicacion(
      solicitud.latitud !== null && solicitud.longitud !== null
        ? {
            lat: solicitud.latitud,
            lng: solicitud.longitud,
          }
        : coords.lat !== null && coords.lng !== null
        ? {
            lat: coords.lat,
            lng: coords.lng,
          }
        : null
    );

    setNuevaReferencia(
      solicitud.referencia_direccion ||
        solicitud.referencia_mapa ||
        solicitud.zona ||
        ""
    );

    setModalUbicacionAbierto(true);
  };

  const usarMiUbicacionCliente = () => {
    setError("");

    if (!navigator.geolocation) {
      setError("Tu navegador no permite obtener la ubicación.");
      return;
    }

    setUbicandoCliente(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNuevaUbicacion({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setUbicandoCliente(false);
      },
      (err) => {
        console.error("Error al obtener ubicación:", err);
        setError("No se pudo obtener tu ubicación. Puedes marcarla manualmente.");
        setUbicandoCliente(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const guardarNuevaUbicacionServicio = async () => {
    if (!solicitud?.id) return;

    if (!nuevaUbicacion) {
      setError("Selecciona una ubicación en el mapa.");
      return;
    }

    setGuardandoUbicacion(true);
    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      const ahora = new Date().toISOString();
      const latitudNumero = nuevaUbicacion.lat;
      const longitudNumero = nuevaUbicacion.lng;
      const referenciaFinal = nuevaReferencia.trim() || null;

      const { error: errorDireccion } = await supabase
        .from("solicitudes_servicio")
        .update({
          latitud: latitudNumero,
          longitud: longitudNumero,
          direccion_mapa: `${latitudNumero.toFixed(7)}, ${longitudNumero.toFixed(7)}`,
          referencia_mapa: referenciaFinal,
          referencia_direccion: referenciaFinal,
          ubicacion_confirmada: true,
          actualizado_en: ahora,
        })
        .eq("id", solicitud.id);

      if (errorDireccion) throw errorDireccion;

      setServicio((actual) => {
        if (!actual) return actual;

        const solicitudActualizada: SolicitudServicio = {
          ...solicitud,
          latitud: latitudNumero,
          longitud: longitudNumero,
          direccion_mapa: `${latitudNumero.toFixed(7)}, ${longitudNumero.toFixed(7)}`,
          referencia_mapa: referenciaFinal,
          referencia_direccion: referenciaFinal,
        };

        return {
          ...actual,
          solicitud: solicitudActualizada,
        };
      });

      setMensaje("Ubicación del servicio actualizada correctamente.");
      setModalUbicacionAbierto(false);
      await cargarSeguimiento();
    } catch (err) {
      console.error("Error al actualizar ubicación:", err);
      setError("No se pudo actualizar la ubicación del servicio.");
    } finally {
      setGuardandoUbicacion(false);
      setProcesando(false);
    }
  };

  const cambiarDireccion = async () => {
    abrirModalUbicacion();
  };

  const coordsSolicitud = extraerCoordenadas(solicitud?.direccion_mapa);

  const clienteLat = Number(solicitud?.latitud ?? coordsSolicitud.lat ?? 0);
  const clienteLng = Number(solicitud?.longitud ?? coordsSolicitud.lng ?? 0);

  const trabajadorLat = Number(
    seguimiento?.latitud_actual ?? ubicacionActual.lat ?? 0
  );

  const trabajadorLng = Number(
    seguimiento?.longitud_actual ?? ubicacionActual.lng ?? 0
  );

  const trabajadorRumbo =
    seguimiento?.direccion_grados ?? ubicacionActual.rumbo ?? null;

  const tieneUbicacionCliente =
    Number.isFinite(clienteLat) &&
    clienteLat !== 0 &&
    Number.isFinite(clienteLng) &&
    clienteLng !== 0;

  const tieneUbicacionTrabajador =
    Number.isFinite(trabajadorLat) &&
    trabajadorLat !== 0 &&
    Number.isFinite(trabajadorLng) &&
    trabajadorLng !== 0 &&
    (seguimiento?.activo === true ||
      (esTrabajadorEnEsteServicio && ubicacionActual.lat !== null));

  if (cargando) {
    return (
      <div className="space-y-5">
        <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
        <div className="h-[420px] animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!servicio) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
            <Clock3 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              No tienes servicios activos
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Cuando aceptes una propuesta o tengas un servicio confirmado,
              aparecerá aquí el seguimiento.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <main className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Navigation size={14} />
                  Seguimiento activo
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <Clock3 size={14} />
                  {estadoTexto}
                </span>

                {esTrabajadorEnEsteServicio && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    Trabajador
                  </span>
                )}

                {esClienteEnEsteServicio && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Cliente
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-bold text-slate-900">
                {solicitud?.titulo || "Servicio confirmado"}
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                {esTrabajadorEnEsteServicio
                  ? "Revisa la ubicación del cliente. Cuando decidas avanzar, comparte tu ubicación en vivo."
                  : "Puedes revisar el avance del trabajador cuando comparta su ubicación en vivo."}
              </p>
            </div>

            <button
              onClick={cargarSeguimiento}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {mensaje && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={18} />
              {mensaje}
            </div>
          )}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-bold text-slate-900">Mapa en vivo</h2>
              <p className="text-sm text-slate-500">
                Flecha azul: trabajador. Pin rojo: ubicación del servicio.
              </p>
            </div>

            <div className="h-[460px]">
              <MapaSeguimiento
                modo={esTrabajadorEnEsteServicio ? "trabajador" : "cliente"}
                cliente={{
                  lat: tieneUbicacionCliente ? clienteLat : null,
                  lng: tieneUbicacionCliente ? clienteLng : null,
                  nombre: direccionServicio,
                }}
                trabajador={{
                  lat: tieneUbicacionTrabajador ? trabajadorLat : null,
                  lng: tieneUbicacionTrabajador ? trabajadorLng : null,
                  nombre: nombreTrabajador,
                  rumbo: trabajadorRumbo,
                }}
              />
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-bold text-slate-900">{tituloPersona}</h2>

              <div className="flex items-center gap-4">
                {personaMostrada?.foto_url ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
                    <Image
                      src={personaMostrada.foto_url}
                      alt={nombrePersona}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <UserRound size={30} />
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-slate-900">{nombrePersona}</h3>
                  <div className="mt-1 flex items-center gap-1 text-sm text-amber-500">
                    <Star size={15} fill="currentColor" />
                    <span className="text-slate-600">
                      {esTrabajadorEnEsteServicio
                        ? "Cliente del servicio"
                        : "Trabajador asignado"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <ShieldCheck className="text-emerald-600" size={18} />
                  <span className="text-slate-700">
                    Información disponible para este servicio
                  </span>
                </div>

                {personaMostrada?.telefono && (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <Phone className="text-blue-600" size={18} />
                    <span className="text-slate-700">
                      {personaMostrada.telefono}
                    </span>
                  </div>
                )}

                {personaMostrada?.correo && (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <Mail className="text-sky-600" size={18} />
                    <span className="text-slate-700">
                      {personaMostrada.correo}
                    </span>
                  </div>
                )}

                {personaMostrada?.zona && (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <MapPin className="text-rose-600" size={18} />
                    <span className="text-slate-700">{personaMostrada.zona}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <Briefcase className="text-violet-600" size={18} />
                  <span className="text-slate-700">{estadoTexto}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-bold text-slate-900">
                Dirección del servicio
              </h2>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {direccionServicio}
                </p>

                <p className="mt-1">
                  {solicitud?.referencia_direccion ||
                    solicitud?.referencia_mapa ||
                    solicitud?.direccion_mapa ||
                    "Sin referencia adicional"}
                </p>

                {tieneUbicacionCliente && (
                  <p className="mt-2 text-xs text-slate-500">
                    Coordenadas: {clienteLat.toFixed(6)}, {clienteLng.toFixed(6)}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {esClienteEnEsteServicio &&
                  servicio.estado !== "en_curso" &&
                  servicio.estado !== "finalizado" &&
                  servicio.estado !== "cancelado" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={abrirModalUbicacion}
                        disabled={procesando}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        <MapPin size={17} />
                        Editar ubicación
                      </button>

                      <button
                        onClick={solicitarCancelarServicio}
                        disabled={procesando}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        <XCircle size={17} />
                        Cancelar servicio
                      </button>
                    </div>
                  )}

                {esTrabajadorEnEsteServicio &&
                  servicio.estado === "confirmado" && (
                    <button
                      onClick={() => cambiarEstadoServicio("en_camino")}
                      disabled={procesando}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Navigation size={17} />
                      Voy en camino
                    </button>
                  )}

                {esTrabajadorEnEsteServicio &&
                  servicio.estado === "en_camino" && (
                    <button
                      onClick={() => cambiarEstadoServicio("en_curso")}
                      disabled={procesando}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      <Briefcase size={17} />
                      Iniciar trabajo
                    </button>
                  )}

                {esTrabajadorEnEsteServicio &&
                  servicio.estado === "en_curso" && (
                    <button
                      onClick={() => cambiarEstadoServicio("finalizado")}
                      disabled={procesando}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <CheckCircle2 size={17} />
                      Finalizar servicio
                    </button>
                  )}

                {esTrabajadorEnEsteServicio &&
                  servicio.estado === "en_camino" &&
                  !compartiendoUbicacion && (
                    <button
                      onClick={iniciarGPS}
                      disabled={procesando}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      <Navigation size={17} />
                      Compartir ubicación
                    </button>
                  )}
              </div>
            </section>
          </aside>
        </section>
      </main>

      {/* Modal Cancelar Servicio */}
      {modalCancelarAbierto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!procesando) setModalCancelarAbierto(false);
            }}
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="p-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <XCircle size={28} />
              </div>

              <div className="mt-4 text-center">
                <h3 className="text-xl font-bold text-slate-900">
                  Cancelar servicio
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  ¿Seguro que deseas cancelar este servicio? Esta acción cerrará
                  el seguimiento y notificará el cambio correspondiente.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModalCancelarAbierto(false)}
                  disabled={procesando}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Mantener servicio
                </button>

                <button
                  type="button"
                  onClick={cancelarServicio}
                  disabled={procesando}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {procesando ? (
                    "Cancelando..."
                  ) : (
                    <>
                      <XCircle size={17} />
                      Cancelar servicio
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Ubicación - CORREGIDO PARA MÓVIL */}
      {modalUbicacionAbierto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!guardandoUbicacion) setModalUbicacionAbierto(false);
            }}
          />

          {/* Modal con scroll en móvil */}
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            
            {/* Header sticky */}
            <div className={`sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:p-5`}>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  Editar ubicación del servicio
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Marca un nuevo punto en el mapa. El trabajador verá el cambio
                  automáticamente.
                </p>
              </div>

              <button
                type="button"
                disabled={guardandoUbicacion}
                onClick={() => setModalUbicacionAbierto(false)}
                className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido con scroll interno */}
            <div className="p-4 sm:p-5">
              <div className="mb-4">
                <label className="text-sm font-bold text-slate-900">
                  Referencia de ubicación
                </label>
                <input
                  type="text"
                  value={nuevaReferencia}
                  onChange={(e) => setNuevaReferencia(e.target.value)}
                  placeholder="Ejemplo: Casa azul junto a la tienda"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#0B3C7F]"
                />
              </div>

              {/* Mapa con altura responsive */}
              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <div className="h-[40vh] sm:h-[360px]">
                  <MapContainer
                    center={[
                      nuevaUbicacion?.lat || clienteLat || -1.24908,
                      nuevaUbicacion?.lng || clienteLng || -78.61675,
                    ]}
                    zoom={nuevaUbicacion ? 17 : 13}
                    className="h-full w-full"
                    style={{ zIndex: 0 }}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <SelectorMapaUbicacion
                      posicion={nuevaUbicacion}
                      setPosicion={setNuevaUbicacion}
                    />

                    <RecentrarMapaUbicacion posicion={nuevaUbicacion} />
                  </MapContainer>
                </div>
              </div>

              <div className="mt-3 text-xs sm:text-sm font-medium text-slate-500">
                {nuevaUbicacion ? (
                  <span>
                    Coordenadas seleccionadas:{" "}
                    {nuevaUbicacion.lat.toFixed(6)},{" "}
                    {nuevaUbicacion.lng.toFixed(6)}
                  </span>
                ) : (
                  <span>Haz clic en el mapa o usa tu ubicación actual.</span>
                )}
              </div>

              {/* Botones responsivos */}
              <div className="mt-5 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={usarMiUbicacionCliente}
                  disabled={ubicandoCliente || guardandoUbicacion}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  <LocateFixed size={16} />
                  {ubicandoCliente ? "Ubicando..." : "Mi ubicación"}
                </button>

                <button
                  type="button"
                  onClick={() => setModalUbicacionAbierto(false)}
                  disabled={guardandoUbicacion}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={guardarNuevaUbicacionServicio}
                  disabled={guardandoUbicacion || !nuevaUbicacion}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0B3C7F] px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-semibold text-white hover:bg-[#092f63] disabled:opacity-60"
                >
                  <Check size={16} />
                  {guardandoUbicacion ? "Guardando..." : "Guardar ubicación"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}