"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Briefcase,
  MapPin,
  CalendarDays,
  DollarSign,
  Eye,
  Send,
  AlertCircle,
  UserRound,
  Tag,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Image,
  ShieldCheck,
  Pencil,
  Trash2,
  Save,
  LocateFixed,
  Check,
  Navigation,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";


type Coordenadas = {
  lat: number;
  lng: number;
};

const CENTRO_INICIAL: Coordenadas = {
  lat: -1.24908,
  lng: -78.61675,
};

const marcadorIcono = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: #0B3C7F;
      border: 4px solid white;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function SelectorMapa({
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

  return <Marker position={[posicion.lat, posicion.lng]} icon={marcadorIcono} />;
}

function RecentrarMapa({ posicion }: { posicion: Coordenadas | null }) {
  const map = useMap();

  useEffect(() => {
    if (posicion) {
      map.setView([posicion.lat, posicion.lng], 16);
    }
  }, [map, posicion]);

  return null;
}

type CategoriaRelacion =
  | {
      id: string;
      nombre: string;
    }
  | {
      id: string;
      nombre: string;
    }[]
  | null;

type UbicacionItem = {
  id: number;
  nombre: string;
};

type Categoria = {
  id: string;
  nombre: string;
};

type SolicitudRespuesta = {
  id: string;
  cliente_id: string;
  categoria_id: string | null;
  titulo: string | null;
  descripcion: string | null;
  zona: string | null;
  referencia_direccion: string | null;
  direccion_mapa: string | null;
  fecha_preferida: string | null;
  presupuesto: number | null;
  estado: string | null;
  created_at: string | null;
  provincia_id: number | null;
  canton_id: number | null;
  parroquia_id: number | null;
  barrio_id: number | null;
  sector_id: number | null;
  barrio_manual: string | null;
  sector_manual: string | null;
  latitud: number | null;
  longitud: number | null;
  referencia_mapa: string | null;
  ubicacion_confirmada: boolean | null;
  categorias: CategoriaRelacion;
};

type Solicitud = {
  id: string;
  cliente_id: string;
  categoria_id: string | null;
  categoria: string;
  titulo: string;
  descripcion: string;
  zona: string;
  referencia_direccion: string | null;
  direccion_mapa: string | null;
  fecha_preferida: string | null;
  presupuesto: number | null;
  estado: string;
  created_at: string | null;
  provincia_id: number | null;
  canton_id: number | null;
  parroquia_id: number | null;
  barrio_id: number | null;
  sector_id: number | null;
  barrio_manual: string | null;
  sector_manual: string | null;
  latitud: number | null;
  longitud: number | null;
  referencia_mapa: string | null;
  ubicacion_confirmada: boolean | null;
};

type SolicitudAdjunto = {
  id: string;
  solicitud_id: string;
  url: string;
  nombre: string | null;
  tipo: string | null;
};

type TabActiva = "disponibles" | "mis";

type CacheSolicitudes = {
  usuarioId: string;
  misSolicitudes: Solicitud[];
  solicitudesDisponibles: Solicitud[];
  adjuntosPorSolicitud: Record<string, SolicitudAdjunto[]>;
  propuestasEnviadas: string[];
};

const CACHE_KEY = "oficiosya-solicitudes-cache";

const cacheVacio: CacheSolicitudes = {
  usuarioId: "",
  misSolicitudes: [],
  solicitudesDisponibles: [],
  adjuntosPorSolicitud: {},
  propuestasEnviadas: [],
};

const leerCacheInicial = (): CacheSolicitudes => {
  if (typeof window === "undefined") return cacheVacio;

  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return cacheVacio;

    const data = JSON.parse(cache) as Partial<CacheSolicitudes>;

    return {
      usuarioId: data.usuarioId || "",
      misSolicitudes: data.misSolicitudes || [],
      solicitudesDisponibles: data.solicitudesDisponibles || [],
      adjuntosPorSolicitud: data.adjuntosPorSolicitud || {},
      propuestasEnviadas: data.propuestasEnviadas || [],
    };
  } catch {
    return cacheVacio;
  }
};

const guardarCache = (data: CacheSolicitudes) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    console.warn("No se pudo guardar el caché de solicitudes.");
  }
};

const obtenerNombreCategoria = (categorias: CategoriaRelacion) => {
  if (!categorias) return "Sin categoría";
  if (Array.isArray(categorias)) return categorias[0]?.nombre || "Sin categoría";
  return categorias.nombre || "Sin categoría";
};

const formatearFecha = (fecha: string | null) => {
  if (!fecha) return "Sin fecha definida";

  const soloFecha = fecha.includes("T") ? fecha.split("T")[0] : fecha;
  const fechaLocal = new Date(`${soloFecha}T00:00:00`);

  if (Number.isNaN(fechaLocal.getTime())) return "Sin fecha definida";

  return fechaLocal.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatearPresupuesto = (valor: number | null) => {
  if (valor === null || Number.isNaN(valor)) return "Opcional";
  return `$${valor}`;
};

const obtenerClaseEstado = (estado: string, modoOscuro: boolean) => {
  const estadoNormalizado = estado.toLowerCase();

  if (estadoNormalizado.includes("solicitado")) {
    return modoOscuro
      ? "bg-blue-950/40 text-blue-200 border-blue-800"
      : "bg-blue-50 text-[#0B3C7F] border-blue-100";
  }

  if (estadoNormalizado.includes("confirmado")) {
    return modoOscuro
      ? "bg-green-950/40 text-green-200 border-green-800"
      : "bg-green-50 text-green-700 border-green-100";
  }

  if (estadoNormalizado.includes("curso")) {
    return modoOscuro
      ? "bg-yellow-950/40 text-yellow-100 border-yellow-800"
      : "bg-yellow-50 text-yellow-700 border-yellow-100";
  }

  if (estadoNormalizado.includes("cancelado")) {
    return modoOscuro
      ? "bg-red-950/40 text-red-200 border-red-800"
      : "bg-red-50 text-red-700 border-red-100";
  }

  return modoOscuro
    ? "bg-slate-800 text-slate-200 border-slate-700"
    : "bg-gray-50 text-gray-600 border-gray-100";
};

export default function SolicitudesView() {
  const { estilos, modoOscuro, perfil } = usePanelContext();

  const [cacheInicial] = useState<CacheSolicitudes>(() => leerCacheInicial());

  const [usuarioId, setUsuarioId] = useState(cacheInicial.usuarioId);
  const [tabActiva, setTabActiva] = useState<TabActiva>("disponibles");

  const [misSolicitudes, setMisSolicitudes] = useState<Solicitud[]>(
    cacheInicial.misSolicitudes
  );
  const [solicitudesDisponibles, setSolicitudesDisponibles] = useState<
    Solicitud[]
  >(cacheInicial.solicitudesDisponibles);

  const [adjuntosPorSolicitud, setAdjuntosPorSolicitud] = useState<
    Record<string, SolicitudAdjunto[]>
  >(cacheInicial.adjuntosPorSolicitud);

  const [propuestasEnviadas, setPropuestasEnviadas] = useState<Set<string>>(
    () => new Set(cacheInicial.propuestasEnviadas)
  );

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [solicitudSeleccionada, setSolicitudSeleccionada] =
    useState<Solicitud | null>(null);
  const [solicitudDetalle, setSolicitudDetalle] = useState<Solicitud | null>(
    null
  );

  const [modalPropuestaAbierto, setModalPropuestaAbierto] = useState(false);
  const [mensajePropuesta, setMensajePropuesta] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [enviandoPropuesta, setEnviandoPropuesta] = useState(false);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [solicitudEditando, setSolicitudEditando] = useState<Solicitud | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoSolicitud, setEliminandoSolicitud] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [provincias, setProvincias] = useState<UbicacionItem[]>([]);
  const [cantones, setCantones] = useState<UbicacionItem[]>([]);
  const [parroquias, setParroquias] = useState<UbicacionItem[]>([]);
  const [barrios, setBarrios] = useState<UbicacionItem[]>([]);
  const [sectores, setSectores] = useState<UbicacionItem[]>([]);

  const [editCategoriaId, setEditCategoriaId] = useState("");
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editProvinciaId, setEditProvinciaId] = useState("");
  const [editCantonId, setEditCantonId] = useState("");
  const [editParroquiaId, setEditParroquiaId] = useState("");
  const [editBarrioId, setEditBarrioId] = useState("");
  const [editSectorId, setEditSectorId] = useState("");
  const [editBarrioManual, setEditBarrioManual] = useState("");
  const [editSectorManual, setEditSectorManual] = useState("");
  const [editZona, setEditZona] = useState("");
  const [editReferenciaDireccion, setEditReferenciaDireccion] = useState("");
  const [editFechaPreferida, setEditFechaPreferida] = useState("");
  const [editPresupuesto, setEditPresupuesto] = useState("");
  const [editPosicionMapa, setEditPosicionMapa] = useState<Coordenadas | null>(null);
  const [editUbicacionConfirmada, setEditUbicacionConfirmada] = useState(false);
  const [modalMapaEditarAbierto, setModalMapaEditarAbierto] = useState(false);
  const [ubicandoEdicion, setUbicandoEdicion] = useState(false);


  const solicitudesActuales = useMemo(() => {
    return tabActiva === "mis" ? misSolicitudes : solicitudesDisponibles;
  }, [tabActiva, misSolicitudes, solicitudesDisponibles]);

  const nombreProvincia =
    provincias.find((item) => String(item.id) === editProvinciaId)?.nombre || "";

  const nombreCanton =
    cantones.find((item) => String(item.id) === editCantonId)?.nombre || "";

  const nombreParroquia =
    parroquias.find((item) => String(item.id) === editParroquiaId)?.nombre || "";

  const nombreBarrio =
    barrios.find((item) => String(item.id) === editBarrioId)?.nombre ||
    editBarrioManual ||
    "";

  const nombreSector =
    sectores.find((item) => String(item.id) === editSectorId)?.nombre ||
    editSectorManual ||
    "";


  const mapearSolicitudes = (data: SolicitudRespuesta[]): Solicitud[] => {
    return data.map((item) => ({
      id: item.id,
      cliente_id: item.cliente_id,
      categoria_id: item.categoria_id,
      categoria: obtenerNombreCategoria(item.categorias),
      titulo: item.titulo || "Solicitud sin título",
      descripcion: item.descripcion || "Sin descripción",
      zona: item.zona || "Zona no definida",
      referencia_direccion: item.referencia_direccion,
      direccion_mapa: item.direccion_mapa,
      fecha_preferida: item.fecha_preferida,
      presupuesto: item.presupuesto,
      estado: item.estado || "solicitado",
      created_at: item.created_at,
      provincia_id: item.provincia_id,
      canton_id: item.canton_id,
      parroquia_id: item.parroquia_id,
      barrio_id: item.barrio_id,
      sector_id: item.sector_id,
      barrio_manual: item.barrio_manual,
      sector_manual: item.sector_manual,
      latitud: item.latitud,
      longitud: item.longitud,
      referencia_mapa: item.referencia_mapa,
      ubicacion_confirmada: item.ubicacion_confirmada,
    }));
  };

  const cargarAdjuntos = async (solicitudes: Solicitud[]) => {
    const ids = solicitudes.map((item) => item.id);

    if (ids.length === 0) return {};

    const { data, error } = await supabase
      .from("solicitud_adjuntos")
      .select("id, solicitud_id, url, nombre, tipo")
      .in("solicitud_id", ids);

    if (error) {
      console.warn(
        "No se cargaron adjuntos. Si aún no existe la tabla solicitud_adjuntos, puedes ignorar este aviso por ahora.",
        error
      );
      return {};
    }

    const agrupados: Record<string, SolicitudAdjunto[]> = {};

    ((data || []) as SolicitudAdjunto[]).forEach((adjunto) => {
      if (!agrupados[adjunto.solicitud_id]) {
        agrupados[adjunto.solicitud_id] = [];
      }

      agrupados[adjunto.solicitud_id].push(adjunto);
    });

    return agrupados;
  };

  const cargarPropuestasEnviadas = async (trabajadorId: string) => {
    const { data, error } = await supabase
      .from("propuestas_servicio")
      .select("solicitud_id")
      .eq("trabajador_id", trabajadorId);

    if (error) {
      console.warn("No se pudieron cargar propuestas enviadas:", error);
      return new Set<string>();
    }

    return new Set<string>(
      (data || [])
        .map((item) => item.solicitud_id as string | null)
        .filter((id): id is string => Boolean(id))
    );
  };

  const cargarSolicitudes = async () => {
    try {
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

      const consultaBase = `
        id,
        cliente_id,
        categoria_id,
        titulo,
        descripcion,
        zona,
        referencia_direccion,
        direccion_mapa,
        fecha_preferida,
        presupuesto,
        estado,
        created_at,
        provincia_id,
        canton_id,
        parroquia_id,
        barrio_id,
        sector_id,
        barrio_manual,
        sector_manual,
        latitud,
        longitud,
        referencia_mapa,
        ubicacion_confirmada,
        categorias (
          id,
          nombre
        )
      `;

      const [misRespuesta, disponiblesRespuesta] = await Promise.all([
        supabase
          .from("solicitudes_servicio")
          .select(consultaBase)
          .eq("cliente_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("solicitudes_servicio")
          .select(consultaBase)
          .neq("cliente_id", user.id)
          .eq("estado", "solicitado")
          .order("created_at", { ascending: false }),
      ]);

      let misMapeadas: Solicitud[] = [];
      let disponiblesMapeadas: Solicitud[] = [];

      if (misRespuesta.error) {
        console.error("Error al cargar mis solicitudes:", misRespuesta.error);
        setError("No se pudieron cargar tus solicitudes.");
      } else {
        misMapeadas = mapearSolicitudes(
          (misRespuesta.data || []) as unknown as SolicitudRespuesta[]
        );
      }

      if (disponiblesRespuesta.error) {
        console.error(
          "Error al cargar solicitudes disponibles:",
          disponiblesRespuesta.error
        );
        setError("No se pudieron cargar las solicitudes disponibles.");
      } else {
        disponiblesMapeadas = mapearSolicitudes(
          (disponiblesRespuesta.data || []) as unknown as SolicitudRespuesta[]
        );
      }

      const [adjuntos, propuestasIds] = await Promise.all([
        cargarAdjuntos([...misMapeadas, ...disponiblesMapeadas]),
        cargarPropuestasEnviadas(user.id),
      ]);

      setUsuarioId(user.id);
      setMisSolicitudes(misMapeadas);
      setSolicitudesDisponibles(disponiblesMapeadas);
      setAdjuntosPorSolicitud(adjuntos);
      setPropuestasEnviadas(propuestasIds);

      guardarCache({
        usuarioId: user.id,
        misSolicitudes: misMapeadas,
        solicitudesDisponibles: disponiblesMapeadas,
        adjuntosPorSolicitud: adjuntos,
        propuestasEnviadas: Array.from(propuestasIds),
      });
    } catch (error) {
      console.error("Error inesperado al cargar solicitudes:", error);
      setError("Ocurrió un error inesperado.");
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      cargarSolicitudes();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let activo = true;

    const cargarDatosEdicion = async () => {
      const [categoriasRespuesta, provinciasRespuesta] = await Promise.all([
        supabase
          .from("categorias")
          .select("id, nombre")
          .eq("activa", true)
          .order("nombre", { ascending: true }),

        supabase
          .from("provincias")
          .select("id, nombre")
          .order("nombre", { ascending: true }),
      ]);

      if (!activo) return;

      if (!categoriasRespuesta.error) {
        setCategorias((categoriasRespuesta.data || []) as Categoria[]);
      }

      if (!provinciasRespuesta.error) {
        setProvincias((provinciasRespuesta.data || []) as UbicacionItem[]);
      }
    };

    cargarDatosEdicion();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;

    const cargarCantones = async () => {
      if (!editProvinciaId) {
        setCantones([]);
        return;
      }

      const { data, error } = await supabase
        .from("cantones")
        .select("id, nombre")
        .eq("provincia_id", Number(editProvinciaId))
        .order("nombre", { ascending: true });

      if (!activo) return;
      if (!error) setCantones(data || []);
    };

    cargarCantones();

    return () => {
      activo = false;
    };
  }, [editProvinciaId]);

  useEffect(() => {
    let activo = true;

    const cargarParroquias = async () => {
      if (!editCantonId) {
        setParroquias([]);
        return;
      }

      const { data, error } = await supabase
        .from("parroquias")
        .select("id, nombre")
        .eq("canton_id", Number(editCantonId))
        .order("nombre", { ascending: true });

      if (!activo) return;
      if (!error) setParroquias(data || []);
    };

    cargarParroquias();

    return () => {
      activo = false;
    };
  }, [editCantonId]);

  useEffect(() => {
    let activo = true;

    const cargarBarrios = async () => {
      if (!editParroquiaId) {
        setBarrios([]);
        return;
      }

      const { data, error } = await supabase
        .from("barrios")
        .select("id, nombre")
        .eq("parroquia_id", Number(editParroquiaId))
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (!activo) return;
      if (!error) setBarrios(data || []);
    };

    cargarBarrios();

    return () => {
      activo = false;
    };
  }, [editParroquiaId]);

  useEffect(() => {
    let activo = true;

    const cargarSectores = async () => {
      if (!editBarrioId) {
        setSectores([]);
        return;
      }

      const { data, error } = await supabase
        .from("sectores")
        .select("id, nombre")
        .eq("barrio_id", Number(editBarrioId))
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (!activo) return;
      if (!error) setSectores(data || []);
    };

    cargarSectores();

    return () => {
      activo = false;
    };
  }, [editBarrioId]);

  useEffect(() => {
    const partes = [
      nombreSector,
      nombreBarrio,
      nombreParroquia,
      nombreCanton,
      nombreProvincia,
    ].filter(Boolean);

    if (modalEditarAbierto && partes.length > 0) {
      setEditZona(partes.join(", "));
    }
  }, [
    modalEditarAbierto,
    nombreSector,
    nombreBarrio,
    nombreParroquia,
    nombreCanton,
    nombreProvincia,
  ]);

  const abrirModalEditar = (solicitud: Solicitud) => {
    setError("");
    setMensaje("");
    setSolicitudEditando(solicitud);
    setEditCategoriaId(solicitud.categoria_id || "");
    setEditTitulo(solicitud.titulo || "");
    setEditDescripcion(solicitud.descripcion || "");
    setEditProvinciaId(solicitud.provincia_id ? String(solicitud.provincia_id) : "");
    setEditCantonId(solicitud.canton_id ? String(solicitud.canton_id) : "");
    setEditParroquiaId(solicitud.parroquia_id ? String(solicitud.parroquia_id) : "");
    setEditBarrioId(solicitud.barrio_id ? String(solicitud.barrio_id) : "");
    setEditSectorId(solicitud.sector_id ? String(solicitud.sector_id) : "");
    setEditBarrioManual(solicitud.barrio_manual || "");
    setEditSectorManual(solicitud.sector_manual || "");
    setEditZona(solicitud.zona || "");
    setEditReferenciaDireccion(solicitud.referencia_direccion || "");
    setEditFechaPreferida(solicitud.fecha_preferida || "");
    setEditPresupuesto(solicitud.presupuesto !== null ? String(solicitud.presupuesto) : "");
    setEditPosicionMapa(
      solicitud.latitud !== null && solicitud.longitud !== null
        ? { lat: solicitud.latitud, lng: solicitud.longitud }
        : null
    );
    setEditUbicacionConfirmada(Boolean(solicitud.ubicacion_confirmada && solicitud.latitud !== null && solicitud.longitud !== null));
    setModalEditarAbierto(true);
  };

  const abrirModalEliminar = (solicitud: Solicitud) => {
    setError("");
    setMensaje("");
    setSolicitudSeleccionada(solicitud);
    setModalEliminarAbierto(true);
  };

  const guardarEdicionSolicitud = async () => {
    setError("");
    setMensaje("");

    if (!solicitudEditando) {
      setError("No se encontró la solicitud seleccionada.");
      return;
    }

    if (!editCategoriaId) {
      setError("Selecciona una categoría.");
      return;
    }

    if (!editTitulo.trim()) {
      setError("Ingresa un título para la solicitud.");
      return;
    }

    if (!editDescripcion.trim()) {
      setError("Describe el servicio que necesitas.");
      return;
    }

    if (!editProvinciaId || !editCantonId || !editParroquiaId) {
      setError("Completa provincia, cantón y parroquia.");
      return;
    }

    if (!editBarrioId && !editBarrioManual.trim()) {
      setError("Selecciona o escribe un barrio.");
      return;
    }

    if (!editZona.trim()) {
      setError("Ingresa la zona, barrio o sector.");
      return;
    }

    const presupuestoNumero = editPresupuesto.trim()
      ? Number(editPresupuesto.trim())
      : null;

    if (presupuestoNumero !== null && Number.isNaN(presupuestoNumero)) {
      setError("El presupuesto debe ser un número válido.");
      return;
    }

    if (presupuestoNumero !== null && presupuestoNumero < 0) {
      setError("El presupuesto no puede ser negativo.");
      return;
    }

    if (!editPosicionMapa || !editUbicacionConfirmada) {
      setError("Marca y confirma la ubicación exacta en el mapa.");
      return;
    }

    const latitudNumero = editPosicionMapa.lat;
    const longitudNumero = editPosicionMapa.lng;

    try {
      setGuardandoEdicion(true);

      const { error } = await supabase
        .from("solicitudes_servicio")
        .update({
          categoria_id: editCategoriaId,
          titulo: editTitulo.trim(),
          descripcion: editDescripcion.trim(),
          provincia_id: Number(editProvinciaId),
          canton_id: Number(editCantonId),
          parroquia_id: Number(editParroquiaId),
          barrio_id: editBarrioId ? Number(editBarrioId) : null,
          sector_id: editSectorId ? Number(editSectorId) : null,
          barrio_manual: editBarrioId ? null : editBarrioManual.trim(),
          sector_manual: editSectorId ? null : editSectorManual.trim() || null,
          zona: editZona.trim(),
          referencia_direccion: editReferenciaDireccion.trim() || null,
          fecha_preferida: editFechaPreferida || null,
          presupuesto: presupuestoNumero,
          latitud: latitudNumero,
          longitud: longitudNumero,
          direccion_mapa: `${latitudNumero.toFixed(7)}, ${longitudNumero.toFixed(7)}`,
          referencia_mapa: editReferenciaDireccion.trim() || null,
          ubicacion_confirmada: true,
        })
        .eq("id", solicitudEditando.id)
        .eq("cliente_id", usuarioId);

      if (error) {
        console.error("Error al editar solicitud:", error);
        setError(`No se pudo editar la solicitud: ${error.message}`);
        return;
      }

      setMensaje("Solicitud actualizada correctamente.");
      setModalEditarAbierto(false);
      setSolicitudEditando(null);
      await cargarSolicitudes();
    } catch (error) {
      console.error("Error inesperado al editar solicitud:", error);
      setError("Ocurrió un error inesperado al editar la solicitud.");
    } finally {
      setGuardandoEdicion(false);
    }
  };


const eliminarSolicitud = async () => {
  setError("");
  setMensaje("");

  if (!solicitudSeleccionada) {
    setError("No se encontró la solicitud seleccionada.");
    return;
  }

  try {
    setEliminandoSolicitud(true);

    const solicitudId = solicitudSeleccionada.id;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error de autenticación al eliminar solicitud:", authError);
      setError("No se encontró el usuario autenticado para eliminar la solicitud.");
      return;
    }

    const { data: solicitudAntesDeEliminar, error: errorBuscar } = await supabase
      .from("solicitudes_servicio")
      .select("id, cliente_id")
      .eq("id", solicitudId)
      .eq("cliente_id", user.id)
      .maybeSingle();

    if (errorBuscar) {
      console.error("Error al buscar la solicitud antes de eliminar:", errorBuscar);
      setError(`No se pudo verificar la solicitud: ${errorBuscar.message}`);
      return;
    }

    if (!solicitudAntesDeEliminar) {
      setError(
        "No se pudo eliminar porque esta solicitud no existe o no pertenece a tu usuario. Actualiza la lista."
      );
      await cargarSolicitudes();
      return;
    }

    const { error: errorPropuestas } = await supabase
      .from("propuestas_servicio")
      .delete()
      .eq("solicitud_id", solicitudId);

    if (errorPropuestas) {
      console.warn("No se pudieron eliminar propuestas relacionadas:", errorPropuestas);
    }

    const { error: errorAdjuntos } = await supabase
      .from("solicitud_adjuntos")
      .delete()
      .eq("solicitud_id", solicitudId);

    if (errorAdjuntos) {
      console.warn("No se pudieron eliminar adjuntos relacionados:", errorAdjuntos);
    }

    const { data: solicitudEliminada, error: errorEliminar } = await supabase
      .from("solicitudes_servicio")
      .delete()
      .eq("id", solicitudId)
      .eq("cliente_id", user.id)
      .select("id");

    if (errorEliminar) {
      console.error("Error al eliminar solicitud:", errorEliminar);
      setError(`No se pudo eliminar la solicitud: ${errorEliminar.message}`);
      return;
    }

    if (!solicitudEliminada || solicitudEliminada.length === 0) {
      console.error("Supabase no devolvió filas eliminadas para:", solicitudId);
      setError(
        "La solicitud no se eliminó en la base de datos. Revisa las políticas RLS de eliminación o el cliente_id."
      );
      await cargarSolicitudes();
      return;
    }

    const nuevasMisSolicitudes = misSolicitudes.filter(
      (item) => item.id !== solicitudId
    );

    const nuevasDisponibles = solicitudesDisponibles.filter(
      (item) => item.id !== solicitudId
    );

    const nuevosAdjuntos = { ...adjuntosPorSolicitud };
    delete nuevosAdjuntos[solicitudId];

    const nuevasPropuestas = new Set(propuestasEnviadas);
    nuevasPropuestas.delete(solicitudId);

    setUsuarioId(user.id);
    setMisSolicitudes(nuevasMisSolicitudes);
    setSolicitudesDisponibles(nuevasDisponibles);
    setAdjuntosPorSolicitud(nuevosAdjuntos);
    setPropuestasEnviadas(nuevasPropuestas);

    guardarCache({
      usuarioId: user.id,
      misSolicitudes: nuevasMisSolicitudes,
      solicitudesDisponibles: nuevasDisponibles,
      adjuntosPorSolicitud: nuevosAdjuntos,
      propuestasEnviadas: Array.from(nuevasPropuestas),
    });

    setMensaje("Solicitud eliminada correctamente.");
    setModalEliminarAbierto(false);
    setSolicitudSeleccionada(null);

    if (solicitudDetalle?.id === solicitudId) {
      setSolicitudDetalle(null);
    }

    await cargarSolicitudes();
  } catch (error) {
    console.error("Error inesperado al eliminar solicitud:", error);
    setError("Ocurrió un error inesperado al eliminar la solicitud.");
  } finally {
    setEliminandoSolicitud(false);
  }
};

  const usarMiUbicacionEdicion = () => {
    setError("");

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Tu navegador no permite obtener la ubicación.");
      return;
    }

    setUbicandoEdicion(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEditPosicionMapa({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setEditUbicacionConfirmada(false);
        setUbicandoEdicion(false);
      },
      (error) => {
        console.error("Error al obtener ubicación:", error);
        setError("No se pudo obtener tu ubicación. Puedes marcarla manualmente en el mapa.");
        setUbicandoEdicion(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const abrirModalPropuesta = (solicitud: Solicitud) => {
    setError("");
    setMensaje("");
    setSolicitudSeleccionada(solicitud);
    setMensajePropuesta("");
    setValorEstimado("");
    setModalPropuestaAbierto(true);
  };

  const enviarPropuesta = async () => {
    setError("");
    setMensaje("");

    if (!solicitudSeleccionada) {
      setError("No se encontró la solicitud seleccionada.");
      return;
    }

    if (!usuarioId) {
      setError("No se encontró el usuario autenticado.");
      return;
    }


    if (propuestasEnviadas.has(solicitudSeleccionada.id)) {
      setError("Ya enviaste una propuesta para esta solicitud.");
      return;
    }

    if (!mensajePropuesta.trim()) {
      setError("Escribe un mensaje corto para tu propuesta.");
      return;
    }

    const valorNumero = valorEstimado.trim()
      ? Number(valorEstimado.trim())
      : null;

    if (valorNumero !== null && Number.isNaN(valorNumero)) {
      setError("El valor estimado debe ser un número válido.");
      return;
    }

    if (valorNumero !== null && valorNumero < 0) {
      setError("El valor estimado no puede ser negativo.");
      return;
    }

    try {
      setEnviandoPropuesta(true);

      const nuevoSet = new Set<string>(propuestasEnviadas);
      nuevoSet.add(solicitudSeleccionada.id);
      setPropuestasEnviadas(nuevoSet);

      const { error } = await supabase.from("propuestas_servicio").insert({
        solicitud_id: solicitudSeleccionada.id,
        trabajador_id: usuarioId,
        mensaje: mensajePropuesta.trim(),
        valor_estimado: valorNumero,
        estado: "enviada",
      });

      if (error) {
        console.error("Error al enviar propuesta:", error);

        if (error.code === "23505") {
          setError("Ya enviaste una propuesta para esta solicitud.");
        } else {
          setError(`No se pudo enviar la propuesta: ${error.message}`);
        }

        cargarSolicitudes();
        return;
      }

      guardarCache({
        usuarioId,
        misSolicitudes,
        solicitudesDisponibles,
        adjuntosPorSolicitud,
        propuestasEnviadas: Array.from(nuevoSet),
      });

      setMensaje("Propuesta enviada correctamente.");
      setModalPropuestaAbierto(false);
      setSolicitudSeleccionada(null);
      setMensajePropuesta("");
      setValorEstimado("");
      cargarSolicitudes();
    } catch (error) {
      console.error("Error inesperado al enviar propuesta:", error);
      setError("Ocurrió un error inesperado al enviar la propuesta.");
      cargarSolicitudes();
    } finally {
      setEnviandoPropuesta(false);
    }
  };

  const renderAdjuntosMini = (solicitudId: string) => {
    const adjuntos = adjuntosPorSolicitud[solicitudId] || [];

    if (adjuntos.length === 0) return null;

    return (
      <div className="flex items-center gap-2 mt-4">
        {adjuntos.slice(0, 4).map((adjunto) => (
          <div
            key={adjunto.id}
            className={`w-14 h-14 rounded-2xl overflow-hidden border ${
              modoOscuro
                ? "border-[#334155] bg-[#0f172a]"
                : "border-gray-100 bg-gray-50"
            }`}
          >
            <img
              src={adjunto.url}
              alt={adjunto.nombre || "Adjunto"}
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        {adjuntos.length > 4 && (
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-xs font-bold ${
              modoOscuro
                ? "border-[#334155] bg-[#0f172a] text-slate-300"
                : "border-gray-100 bg-gray-50 text-gray-500"
            }`}
          >
            +{adjuntos.length - 4}
          </div>
        )}
      </div>
    );
  };

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
              <ClipboardList className="w-4 h-4" />
              Gestión de solicitudes
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
            >
              Solicitudes
            </h1>

            <p className={`mt-2 max-w-3xl ${estilos.textoSecundario}`}>
              Revisa tus solicitudes publicadas o encuentra trabajos disponibles
              para enviar una propuesta.
            </p>
          </div>

          <button
            type="button"
            onClick={cargarSolicitudes}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold transition ${
              modoOscuro
                ? "bg-[#111827] text-slate-300 border border-[#334155] hover:bg-[#1e293b]"
                : "bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]"
            }`}
          >
            <RefreshCw className="w-5 h-5" />
            Actualizar
          </button>
        </div>
      </section>

      <section className={`rounded-[18px] border p-3 sm:p-4 ${estilos.tarjeta}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTabActiva("disponibles")}
            className={`rounded-2xl px-4 py-4 font-extrabold transition flex items-center justify-center gap-2 ${
              tabActiva === "disponibles"
                ? "bg-[#0B3C7F] text-white shadow-[0_10px_22px_rgba(11,60,127,0.18)]"
                : modoOscuro
                ? "bg-[#111827] text-slate-300 hover:bg-[#1e293b]"
                : "bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]"
            }`}
          >
            <Briefcase className="w-5 h-5" />
            Disponibles para trabajar
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                tabActiva === "disponibles"
                  ? "bg-white/20 text-white"
                  : modoOscuro
                  ? "bg-[#0f172a] text-slate-300"
                  : "bg-white text-[#0B3C7F]"
              }`}
            >
              {solicitudesDisponibles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("mis")}
            className={`rounded-2xl px-4 py-4 font-extrabold transition flex items-center justify-center gap-2 ${
              tabActiva === "mis"
                ? "bg-[#0B3C7F] text-white shadow-[0_10px_22px_rgba(11,60,127,0.18)]"
                : modoOscuro
                ? "bg-[#111827] text-slate-300 hover:bg-[#1e293b]"
                : "bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]"
            }`}
          >
            <UserRound className="w-5 h-5" />
            Mis solicitudes
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                tabActiva === "mis"
                  ? "bg-white/20 text-white"
                  : modoOscuro
                  ? "bg-[#0f172a] text-slate-300"
                  : "bg-white text-[#0B3C7F]"
              }`}
            >
              {misSolicitudes.length}
            </span>
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {mensaje && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 font-medium">{mensaje}</p>
        </div>
      )}

      <section
        className={`rounded-[18px] border overflow-hidden ${estilos.tarjeta}`}
      >
        <div className={`px-5 sm:px-6 py-5 border-b ${estilos.borde}`}>
          <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
            {tabActiva === "mis"
              ? "Mis solicitudes publicadas"
              : "Solicitudes disponibles"}
          </h2>

          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            {`${solicitudesActuales.length} resultado(s) disponibles`}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          {solicitudesActuales.length === 0 ? (
            <div
              className={`rounded-2xl border p-8 text-center ${
                modoOscuro
                  ? "border-[#334155] bg-[#111827]"
                  : "border-gray-100 bg-[#f8fafc]"
              }`}
            >
              <ClipboardList className="w-12 h-12 mx-auto text-gray-400" />

              <p className={`mt-4 font-extrabold ${estilos.textoPrincipal}`}>
                {tabActiva === "mis"
                  ? "Aún no has publicado solicitudes"
                  : "No hay solicitudes disponibles por ahora"}
              </p>

              <p className={`mt-1 text-sm ${estilos.textoSecundario}`}>
                {tabActiva === "mis"
                  ? "Cuando publiques una solicitud, aparecerá en esta sección."
                  : "Cuando otros usuarios publiquen solicitudes, aparecerán aquí."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {solicitudesActuales.map((solicitud) => {
                const yaEnvioPropuesta = propuestasEnviadas.has(solicitud.id);

                return (
                  <article
                    key={solicitud.id}
                    className={`rounded-[24px] border p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(11,60,127,0.10)] ${
                      modoOscuro
                        ? "bg-[#111827] border-[#334155]"
                        : "bg-white border-[#dbeafe]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                              modoOscuro
                                ? "bg-[#0f172a] text-slate-300"
                                : "bg-[#eef4ff] text-[#0B3C7F]"
                            }`}
                          >
                            <Tag className="w-3.5 h-3.5" />
                            {solicitud.categoria}
                          </span>

                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${obtenerClaseEstado(
                              solicitud.estado,
                              modoOscuro
                            )}`}
                          >
                            {solicitud.estado}
                          </span>

                          {yaEnvioPropuesta && tabActiva === "disponibles" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 text-green-700 px-3 py-1 text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Propuesta enviada
                            </span>
                          )}
                        </div>

                        <h3
                          className={`text-lg font-extrabold ${estilos.textoPrincipal}`}
                        >
                          {solicitud.titulo}
                        </h3>
                      </div>
                    </div>

                    <p
                      className={`mt-3 text-sm line-clamp-3 ${estilos.textoSecundario}`}
                    >
                      {solicitud.descripcion}
                    </p>

                    {renderAdjuntosMini(solicitud.id)}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                      <div
                        className={`rounded-2xl border px-3 py-3 ${
                          modoOscuro
                            ? "border-[#334155] bg-[#0f172a]"
                            : "border-blue-50 bg-[#f8fbff]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <p
                            className={`text-xs font-bold ${estilos.textoSecundario}`}
                          >
                            Zona
                          </p>
                        </div>
                        <p
                          className={`mt-1 text-sm font-bold line-clamp-1 ${estilos.textoPrincipal}`}
                        >
                          {solicitud.zona}
                        </p>
                      </div>

                      <div
                        className={`rounded-2xl border px-3 py-3 ${
                          modoOscuro
                            ? "border-[#334155] bg-[#0f172a]"
                            : "border-blue-50 bg-[#f8fbff]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-gray-400" />
                          <p
                            className={`text-xs font-bold ${estilos.textoSecundario}`}
                          >
                            Fecha
                          </p>
                        </div>
                        <p
                          className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}
                        >
                          {formatearFecha(solicitud.fecha_preferida)}
                        </p>
                      </div>

                      <div
                        className={`rounded-2xl border px-3 py-3 ${
                          modoOscuro
                            ? "border-[#334155] bg-[#0f172a]"
                            : "border-blue-50 bg-[#f8fbff]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <p
                            className={`text-xs font-bold ${estilos.textoSecundario}`}
                          >
                            Presupuesto
                          </p>
                        </div>
                        <p
                          className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}
                        >
                          {formatearPresupuesto(solicitud.presupuesto)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-5">
                      <button
                        type="button"
                        onClick={() => setSolicitudDetalle(solicitud)}
                        className={`rounded-2xl border px-4 py-3 font-bold transition flex items-center justify-center gap-2 ${
                          modoOscuro
                            ? "border-[#334155] text-white hover:bg-[#1e293b]"
                            : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                        }`}
                      >
                        <Eye className="w-5 h-5" />
                        Ver detalles
                      </button>

                      {tabActiva === "mis" && (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(solicitud)}
                            disabled={solicitud.estado !== "solicitado"}
                            className="rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Pencil className="w-5 h-5" />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => abrirModalEliminar(solicitud)}
                            disabled={solicitud.estado !== "solicitado"}
                            className="rounded-2xl bg-red-600 text-white px-4 py-3 font-bold hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-5 h-5" />
                            Eliminar
                          </button>
                        </>
                      )}

                      {tabActiva === "disponibles" && (
                        <button
                          type="button"
                          onClick={() => abrirModalPropuesta(solicitud)}
                          disabled={yaEnvioPropuesta}
                          className="rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {yaEnvioPropuesta ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                          {yaEnvioPropuesta
                            ? "Propuesta enviada"
                            : "Enviar propuesta"}
                        </button>
                      )}
                      
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {modalEditarAbierto && solicitudEditando && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!guardandoEdicion) setModalEditarAbierto(false);
            }}
          />

          <div
            className={`relative w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-[26px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
              modoOscuro
                ? "bg-[#111827] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[#0B3C7F] mb-3 ${
                    modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  Editar solicitud
                </div>
                <h3 className={`text-2xl font-extrabold ${estilos.textoPrincipal}`}>
                  Actualizar información
                </h3>
                <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                  Modifica los datos de tu solicitud publicada.
                </p>
              </div>

              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={() => setModalEditarAbierto(false)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-60 ${
                  modoOscuro
                    ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                    : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Categoría
                </label>
                <select
                  value={editCategoriaId}
                  onChange={(e) => setEditCategoriaId(e.target.value)}
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                >
                  <option value="">Selecciona una categoría</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Fecha preferida
                </label>
                <input
                  type="date"
                  value={editFechaPreferida}
                  onChange={(e) => setEditFechaPreferida(e.target.value)}
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Título
                </label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  placeholder="Ejemplo: Necesito reparar una fuga de agua"
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Descripción
                </label>
                <textarea
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                  rows={4}
                  placeholder="Describe el servicio que necesitas"
                  className={`mt-1 w-full resize-none rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Provincia
                </label>
                <select
                  value={editProvinciaId}
                  onChange={(e) => {
                    setEditProvinciaId(e.target.value);
                    setEditCantonId("");
                    setEditParroquiaId("");
                    setEditBarrioId("");
                    setEditSectorId("");
                  }}
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                >
                  <option value="">Selecciona provincia</option>
                  {provincias.map((provincia) => (
                    <option key={provincia.id} value={provincia.id}>
                      {provincia.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Cantón
                </label>
                <select
                  value={editCantonId}
                  onChange={(e) => {
                    setEditCantonId(e.target.value);
                    setEditParroquiaId("");
                    setEditBarrioId("");
                    setEditSectorId("");
                  }}
                  disabled={!editProvinciaId}
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition disabled:opacity-60 ${estilos.inputBase}`}
                >
                  <option value="">Selecciona cantón</option>
                  {cantones.map((canton) => (
                    <option key={canton.id} value={canton.id}>
                      {canton.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Parroquia
                </label>
                <select
                  value={editParroquiaId}
                  onChange={(e) => {
                    setEditParroquiaId(e.target.value);
                    setEditBarrioId("");
                    setEditSectorId("");
                  }}
                  disabled={!editCantonId}
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition disabled:opacity-60 ${estilos.inputBase}`}
                >
                  <option value="">Selecciona parroquia</option>
                  {parroquias.map((parroquia) => (
                    <option key={parroquia.id} value={parroquia.id}>
                      {parroquia.nombre}
                    </option>
                  ))}
                </select>
              </div>

              

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Barrio 
                </label>
                <input
                  type="text"
                  value={editBarrioManual}
                  onChange={(e) => {
                    setEditBarrioManual(e.target.value);
                    if (e.target.value.trim()) {
                      setEditBarrioId("");
                      setEditSectorId("");
                    }
                  }}
                  placeholder="Escribe el barrio si no aparece"
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Sector opcional
                </label>
                <input
                  type="text"
                  value={editSectorManual}
                  onChange={(e) => {
                    setEditSectorManual(e.target.value);
                    if (e.target.value.trim()) setEditSectorId("");
                  }}
                  placeholder="Escribe el sector si aplica"
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Zona generada
                </label>
                <input
                  type="text"
                  value={editZona}
                  onChange={(e) => setEditZona(e.target.value)}
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Presupuesto opcional
                </label>
                <input
                  type="number"
                  min="0"
                  value={editPresupuesto}
                  onChange={(e) => setEditPresupuesto(e.target.value)}
                  placeholder="Ejemplo: 25"
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Referencia de dirección
                </label>
                <input
                  type="text"
                  value={editReferenciaDireccion}
                  onChange={(e) => setEditReferenciaDireccion(e.target.value)}
                  placeholder="Ejemplo: Casa azul junto a la tienda"
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Ubicación en el mapa
                </label>

                <div
                  className={`mt-1 rounded-[24px] border overflow-hidden ${
                    modoOscuro
                      ? "border-[#334155] bg-[#0f172a]"
                      : "border-blue-50 bg-[#f8fbff]"
                  }`}
                >
                  <div className="h-[320px] relative">
                    <MapContainer
                      center={[
                        editPosicionMapa?.lat || CENTRO_INICIAL.lat,
                        editPosicionMapa?.lng || CENTRO_INICIAL.lng,
                      ]}
                      zoom={editPosicionMapa ? 16 : 13}
                      className="h-full w-full z-0"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <SelectorMapa
                        posicion={editPosicionMapa}
                        setPosicion={(posicion) => {
                          setEditPosicionMapa(posicion);
                          setEditUbicacionConfirmada(false);
                        }}
                      />
                      <RecentrarMapa posicion={editPosicionMapa} />
                    </MapContainer>
                  </div>

                  <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={usarMiUbicacionEdicion}
                      disabled={ubicandoEdicion}
                      className={`rounded-2xl px-4 py-3 font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                        modoOscuro
                          ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                          : "bg-[#eef4ff] text-[#0B3C7F] hover:bg-[#e0ebff]"
                      }`}
                    >
                      {ubicandoEdicion ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <LocateFixed className="w-5 h-5" />
                      )}
                      Mi ubicación
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalMapaEditarAbierto(true)}
                      className={`rounded-2xl px-4 py-3 font-bold transition flex items-center justify-center gap-2 ${
                        modoOscuro
                          ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                          : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                      }`}
                    >
                      <Navigation className="w-5 h-5" />
                      Ampliar mapa
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!editPosicionMapa) {
                          setError("Marca una ubicación en el mapa antes de confirmar.");
                          return;
                        }
                        setEditUbicacionConfirmada(true);
                        setError("");
                      }}
                      disabled={!editPosicionMapa}
                      className="rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Confirmar ubicación
                    </button>
                  </div>

                  <div className={`px-4 pb-4 text-sm font-semibold ${estilos.textoSecundario}`}>
                    {editPosicionMapa ? (
                      <span>
                        Coordenadas: {editPosicionMapa.lat.toFixed(7)}, {" "}
                        {editPosicionMapa.lng.toFixed(7)}
                        {editUbicacionConfirmada ? " · Ubicación confirmada" : " · Falta confirmar"}
                      </span>
                    ) : (
                      <span>Haz clic en el mapa o usa tu ubicación actual.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={guardarEdicionSolicitud}
                disabled={guardandoEdicion}
                className="w-full rounded-2xl bg-[#0B3C7F] text-white px-5 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {guardandoEdicion ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </button>

              <button
                type="button"
                onClick={() => setModalEditarAbierto(false)}
                disabled={guardandoEdicion}
                className={`w-full rounded-2xl border px-5 py-3 font-bold transition disabled:opacity-60 ${
                  modoOscuro
                    ? "border-[#334155] text-white hover:bg-[#1e293b]"
                    : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMapaEditarAbierto && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalMapaEditarAbierto(false)}
          />

          <div
            className={`relative w-full max-w-5xl max-h-[92dvh] overflow-hidden rounded-[26px] border shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
              modoOscuro
                ? "bg-[#111827] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${estilos.borde}`}>
              <div>
                <h3 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
                  Seleccionar ubicación
                </h3>
                <p className={`text-sm ${estilos.textoSecundario}`}>
                  Haz clic en el mapa para actualizar el punto exacto.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalMapaEditarAbierto(false)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                  modoOscuro
                    ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                    : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-[62dvh] min-h-[380px]">
              <MapContainer
                center={[
                  editPosicionMapa?.lat || CENTRO_INICIAL.lat,
                  editPosicionMapa?.lng || CENTRO_INICIAL.lng,
                ]}
                zoom={editPosicionMapa ? 16 : 13}
                className="h-full w-full z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <SelectorMapa
                  posicion={editPosicionMapa}
                  setPosicion={(posicion) => {
                    setEditPosicionMapa(posicion);
                    setEditUbicacionConfirmada(false);
                  }}
                />
                <RecentrarMapa posicion={editPosicionMapa} />
              </MapContainer>
            </div>

            <div className="p-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={usarMiUbicacionEdicion}
                disabled={ubicandoEdicion}
                className={`w-full rounded-2xl px-5 py-3 font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                  modoOscuro
                    ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                    : "bg-[#eef4ff] text-[#0B3C7F] hover:bg-[#e0ebff]"
                }`}
              >
                {ubicandoEdicion ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LocateFixed className="w-5 h-5" />
                )}
                Usar mi ubicación
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!editPosicionMapa) {
                    setError("Marca una ubicación en el mapa antes de confirmar.");
                    return;
                  }
                  setEditUbicacionConfirmada(true);
                  setModalMapaEditarAbierto(false);
                  setError("");
                }}
                disabled={!editPosicionMapa}
                className="w-full rounded-2xl bg-[#0B3C7F] text-white px-5 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Confirmar ubicación
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEliminarAbierto && solicitudSeleccionada && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!eliminandoSolicitud) setModalEliminarAbierto(false);
            }}
          />

          <div
            className={`relative w-full max-w-lg rounded-[26px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
              modoOscuro
                ? "bg-[#111827] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className={`text-2xl font-extrabold mt-4 ${estilos.textoPrincipal}`}>
              Eliminar solicitud
            </h3>

            <p className={`mt-2 text-sm ${estilos.textoSecundario}`}>
              Esta acción eliminará la solicitud “{solicitudSeleccionada.titulo}”.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={eliminarSolicitud}
                disabled={eliminandoSolicitud}
                className="w-full rounded-2xl bg-red-600 text-white px-5 py-3 font-bold hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {eliminandoSolicitud ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                {eliminandoSolicitud ? "Eliminando..." : "Sí, eliminar"}
              </button>

              <button
                type="button"
                onClick={() => setModalEliminarAbierto(false)}
                disabled={eliminandoSolicitud}
                className={`w-full rounded-2xl border px-5 py-3 font-bold transition disabled:opacity-60 ${
                  modoOscuro
                    ? "border-[#334155] text-white hover:bg-[#1e293b]"
                    : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPropuestaAbierto && solicitudSeleccionada && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!enviandoPropuesta) setModalPropuestaAbierto(false);
            }}
          />

          <div
            className={`relative w-full max-w-xl rounded-[26px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
              modoOscuro
                ? "bg-[#111827] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[#0B3C7F] mb-3 ${
                    modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Nueva propuesta
                </div>

                <h3
                  className={`text-xl font-extrabold ${estilos.textoPrincipal}`}
                >
                  Enviar propuesta
                </h3>

                <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                  {solicitudSeleccionada.titulo}
                </p>
              </div>

              <button
                type="button"
                disabled={enviandoPropuesta}
                onClick={() => setModalPropuestaAbierto(false)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-60 ${
                  modoOscuro
                    ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                    : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`mt-5 rounded-2xl border p-4 ${
                modoOscuro
                  ? "bg-[#0f172a] border-[#334155]"
                  : "bg-[#f8fafc] border-gray-100"
              }`}
            >
              <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                Solicitud
              </p>
              <p className={`mt-1 font-extrabold ${estilos.textoPrincipal}`}>
                {solicitudSeleccionada.categoria}
              </p>
              <p className={`mt-2 text-sm ${estilos.textoSecundario}`}>
                {solicitudSeleccionada.descripcion}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  className={`text-sm font-bold ${estilos.textoPrincipal}`}
                >
                  Mensaje para el cliente
                </label>

                <textarea
                  value={mensajePropuesta}
                  onChange={(e) => setMensajePropuesta(e.target.value)}
                  placeholder="Ejemplo: Hola, puedo ayudarte con este trabajo. Tengo experiencia y disponibilidad para coordinar."
                  rows={4}
                  className={`mt-1 w-full resize-none rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div>
                <label
                  className={`text-sm font-bold ${estilos.textoPrincipal}`}
                >
                  Valor estimado opcional
                </label>

                <div className="relative mt-1">
                  <DollarSign className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    type="number"
                    min="0"
                    value={valorEstimado}
                    onChange={(e) => setValorEstimado(e.target.value)}
                    placeholder="Ejemplo: 25"
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={enviarPropuesta}
                disabled={enviandoPropuesta}
                className="w-full rounded-2xl bg-[#0B3C7F] text-white px-5 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {enviandoPropuesta ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {enviandoPropuesta ? "Enviando..." : "Enviar propuesta"}
              </button>

              <button
                type="button"
                onClick={() => setModalPropuestaAbierto(false)}
                disabled={enviandoPropuesta}
                className={`w-full rounded-2xl border px-5 py-3 font-bold transition disabled:opacity-60 ${
                  modoOscuro
                    ? "border-[#334155] text-white hover:bg-[#1e293b]"
                    : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {solicitudDetalle && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSolicitudDetalle(null)}
          />

          <div
            className={`relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-[26px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
              modoOscuro
                ? "bg-[#111827] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[#0B3C7F] mb-3 ${
                    modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Detalles de solicitud
                </div>

                <h3
                  className={`text-2xl font-extrabold ${estilos.textoPrincipal}`}
                >
                  {solicitudDetalle.titulo}
                </h3>

                <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                  Información completa disponible respetando la privacidad del
                  cliente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSolicitudDetalle(null)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                  modoOscuro
                    ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                    : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Cliente
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                      Cliente OficiosYA
                    </p>
                    <p className={`text-xs ${estilos.textoSecundario}`}>
                      Contacto oculto hasta confirmar servicio
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Privacidad
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#eaf8ef] text-green-700 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                      Datos protegidos
                    </p>
                    <p className={`text-xs ${estilos.textoSecundario}`}>
                      Sin teléfono, correo ni dirección privada
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 mt-4 ${
                modoOscuro
                  ? "bg-[#0f172a] border-[#334155]"
                  : "bg-[#f8fafc] border-gray-100"
              }`}
            >
              <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                Descripción
              </p>
              <p className={`mt-2 text-sm leading-6 ${estilos.textoPrincipal}`}>
                {solicitudDetalle.descripcion}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <MapPin className="w-5 h-5 text-[#0B3C7F]" />
                <p
                  className={`text-xs font-bold mt-2 ${estilos.textoSecundario}`}
                >
                  Zona completa
                </p>
                <p className={`mt-1 font-bold ${estilos.textoPrincipal}`}>
                  {solicitudDetalle.zona}
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <CalendarDays className="w-5 h-5 text-[#0B3C7F]" />
                <p
                  className={`text-xs font-bold mt-2 ${estilos.textoSecundario}`}
                >
                  Fecha preferida
                </p>
                <p className={`mt-1 font-bold ${estilos.textoPrincipal}`}>
                  {formatearFecha(solicitudDetalle.fecha_preferida)}
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <DollarSign className="w-5 h-5 text-[#0B3C7F]" />
                <p
                  className={`text-xs font-bold mt-2 ${estilos.textoSecundario}`}
                >
                  Presupuesto
                </p>
                <p className={`mt-1 font-bold ${estilos.textoPrincipal}`}>
                  {formatearPresupuesto(solicitudDetalle.presupuesto)}
                </p>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 mt-4 ${
                modoOscuro
                  ? "bg-[#0f172a] border-[#334155]"
                  : "bg-[#f8fafc] border-gray-100"
              }`}
            >
              <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                Referencias de ubicación
              </p>

              <p className={`mt-2 text-sm ${estilos.textoPrincipal}`}>
                <span className="font-bold">Referencia:</span>{" "}
                {solicitudDetalle.referencia_direccion ||
                  "Sin referencia adicional"}
              </p>

              <p className={`mt-2 text-sm ${estilos.textoPrincipal}`}>
                <span className="font-bold">Punto en mapa:</span>{" "}
                {solicitudDetalle.direccion_mapa ||
                  "Sin coordenadas visibles"}
              </p>
            </div>

            <div
              className={`rounded-2xl border p-4 mt-4 ${
                modoOscuro
                  ? "bg-[#0f172a] border-[#334155]"
                  : "bg-[#f8fafc] border-gray-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-[#0B3C7F]" />
                <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                  Fotos o adjuntos
                </p>
              </div>

              {(adjuntosPorSolicitud[solicitudDetalle.id] || []).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {(adjuntosPorSolicitud[solicitudDetalle.id] || []).map(
                    (adjunto) => (
                      <div
                        key={adjunto.id}
                        className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
                      >
                        <img
                          src={adjunto.url}
                          alt={adjunto.nombre || "Adjunto"}
                          className="w-full h-32 object-cover"
                        />
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className={`mt-3 text-sm ${estilos.textoSecundario}`}>
                  Esta solicitud todavía no tiene fotos o adjuntos.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {tabActiva === "disponibles" && (
                <button
                  type="button"
                  onClick={() => {
                    setSolicitudDetalle(null);
                    abrirModalPropuesta(solicitudDetalle);
                  }}
                  disabled={propuestasEnviadas.has(solicitudDetalle.id)}
                  className="w-full rounded-2xl bg-[#0B3C7F] text-white px-5 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {propuestasEnviadas.has(solicitudDetalle.id) ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {propuestasEnviadas.has(solicitudDetalle.id)
                    ? "Propuesta enviada"
                    : "Enviar propuesta"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSolicitudDetalle(null)}
                className={`w-full rounded-2xl border px-5 py-3 font-bold transition ${
                  modoOscuro
                    ? "border-[#334155] text-white hover:bg-[#1e293b]"
                    : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                }`}
              >
                Cerrar detalles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}