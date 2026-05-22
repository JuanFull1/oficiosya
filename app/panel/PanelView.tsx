"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Star,
  Briefcase,
  Wrench,
  Hammer,
  Paintbrush,
  Zap,
  Home,
  PlusCircle,
  ClipboardList,
  MapPinned,
  BadgeCheck,
  Send,
  Eye,
  X,
  DollarSign,
  CalendarDays,
  MapPin,
  UserRound,
  ShieldCheck,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Tag,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "./PanelLayout";

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

type CachePanel = {
  usuarioId: string;
  solicitudesDisponibles: Solicitud[];
  misSolicitudesCantidad: number;
  propuestasEnviadas: string[];
  serviciosActivosCantidad: number;
  categorias: Categoria[];
  adjuntosPorSolicitud: Record<string, SolicitudAdjunto[]>;
};

const CACHE_KEY = "oficiosya-panel-cache";

const cacheVacio: CachePanel = {
  usuarioId: "",
  solicitudesDisponibles: [],
  misSolicitudesCantidad: 0,
  propuestasEnviadas: [],
  serviciosActivosCantidad: 0,
  categorias: [],
  adjuntosPorSolicitud: {},
};

const leerCacheInicial = (): CachePanel => {
  if (typeof window === "undefined") return cacheVacio;

  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return cacheVacio;

    const data = JSON.parse(cache) as Partial<CachePanel>;

    return {
      usuarioId: data.usuarioId || "",
      solicitudesDisponibles: data.solicitudesDisponibles || [],
      misSolicitudesCantidad: data.misSolicitudesCantidad || 0,
      propuestasEnviadas: data.propuestasEnviadas || [],
      serviciosActivosCantidad: data.serviciosActivosCantidad || 0,
      categorias: data.categorias || [],
      adjuntosPorSolicitud: data.adjuntosPorSolicitud || {},
    };
  } catch {
    return cacheVacio;
  }
};

const guardarCache = (data: CachePanel) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    console.warn("No se pudo guardar el caché del panel.");
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

function IconoCategoria({
  nombre,
  modoOscuro,
}: {
  nombre: string;
  modoOscuro: boolean;
}) {
  const texto = nombre.toLowerCase();
  const color = modoOscuro ? "text-[#7fb3ff]" : "text-[#0B3C7F]";

  if (texto.includes("electric")) return <Zap className={`w-6 h-6 ${color}`} />;
  if (texto.includes("plomer") || texto.includes("tuber")) return <Wrench className={`w-6 h-6 ${color}`} />;
  if (texto.includes("pint")) return <Paintbrush className={`w-6 h-6 ${color}`} />;
  if (texto.includes("carpinter") || texto.includes("madera")) return <Hammer className={`w-6 h-6 ${color}`} />;

  return <Briefcase className={`w-6 h-6 ${color}`} />;
}

export default function PanelView() {
  const router = useRouter();

  const { nombreMostrar, busqueda, setBusqueda, modoOscuro, estilos } =
    usePanelContext();

  const [cacheInicial] = useState<CachePanel>(() => leerCacheInicial());

  const [usuarioId, setUsuarioId] = useState(cacheInicial.usuarioId);
  const [solicitudesDisponibles, setSolicitudesDisponibles] = useState<
    Solicitud[]
  >(cacheInicial.solicitudesDisponibles);
  const [misSolicitudesCantidad, setMisSolicitudesCantidad] = useState(
    cacheInicial.misSolicitudesCantidad
  );
  const [serviciosActivosCantidad, setServiciosActivosCantidad] = useState(
    cacheInicial.serviciosActivosCantidad
  );
  const [categorias, setCategorias] = useState<Categoria[]>(
    cacheInicial.categorias
  );
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [adjuntosPorSolicitud, setAdjuntosPorSolicitud] = useState<
    Record<string, SolicitudAdjunto[]>
  >(cacheInicial.adjuntosPorSolicitud);
  const [propuestasEnviadas, setPropuestasEnviadas] = useState<Set<string>>(
    () => new Set(cacheInicial.propuestasEnviadas)
  );

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [actualizando, setActualizando] = useState(false);

  const [solicitudDetalle, setSolicitudDetalle] = useState<Solicitud | null>(
    null
  );
  const [solicitudSeleccionada, setSolicitudSeleccionada] =
    useState<Solicitud | null>(null);

  const [modalPropuestaAbierto, setModalPropuestaAbierto] = useState(false);
  const [mensajePropuesta, setMensajePropuesta] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [enviandoPropuesta, setEnviandoPropuesta] = useState(false);

  const accionesSuperiores = [
    {
      title: "Inicio",
      icon: Home,
      path: "/panel",
    },
    {
      title: "Buscar",
      icon: Search,
      path: "/panel/buscar",
    },
    {
      title: "Publicar",
      icon: PlusCircle,
      path: "/panel/publicar",
    },
    {
      title: "Solicitudes",
      icon: ClipboardList,
      path: "/panel/solicitudes",
    },
    {
      title: "Propuestas",
      icon: BadgeCheck,
      path: "/panel/propuestas",
    },
    {
      title: "Seguimiento",
      icon: MapPinned,
      path: "/panel/seguimiento",
    },
    {
      title: "Reseñas",
      icon: Star,
      path: "/panel/resenas",
    },
  ];

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
        "No se pudieron cargar adjuntos del panel. Si aún no existe solicitud_adjuntos, puedes ignorarlo.",
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

  const cargarPanel = async () => {
    try {
      setError("");
      setMensaje("");
      setActualizando(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("No se encontró el usuario autenticado.");
        return;
      }

      const consultaSolicitudes = `
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
        latitud,
        longitud,
        referencia_mapa,
        ubicacion_confirmada,
        categorias (
          id,
          nombre
        )
      `;

      const [
        categoriasRespuesta,
        disponiblesRespuesta,
        misSolicitudesRespuesta,
        propuestasIds,
        serviciosRespuesta,
      ] = await Promise.all([
        supabase
          .from("categorias")
          .select("id, nombre")
          .eq("activa", true)
          .order("nombre", { ascending: true }),

        supabase
          .from("solicitudes_servicio")
          .select(consultaSolicitudes)
          .neq("cliente_id", user.id)
          .eq("estado", "solicitado")
          .order("created_at", { ascending: false })
          .limit(12),

        supabase
          .from("solicitudes_servicio")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", user.id),

        cargarPropuestasEnviadas(user.id),

        supabase
          .from("servicios")
          .select("id", { count: "exact", head: true })
          .or(`cliente_id.eq.${user.id},trabajador_id.eq.${user.id}`)
          .in("estado", ["confirmado", "en_camino", "en_curso"]),
      ]);

      let disponiblesMapeadas: Solicitud[] = [];
      let categoriasCargadas: Categoria[] = categorias;

      if (categoriasRespuesta.error) {
        console.warn("No se pudieron cargar categorías:", categoriasRespuesta.error);
      } else {
        categoriasCargadas = (categoriasRespuesta.data || []) as Categoria[];
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

      const adjuntos = await cargarAdjuntos(disponiblesMapeadas);

      const cantidadMisSolicitudes = misSolicitudesRespuesta.count || 0;
      const cantidadServiciosActivos = serviciosRespuesta.count || 0;

      setUsuarioId(user.id);
      setCategorias(categoriasCargadas);
      setSolicitudesDisponibles(disponiblesMapeadas);
      setMisSolicitudesCantidad(cantidadMisSolicitudes);
      setServiciosActivosCantidad(cantidadServiciosActivos);
      setPropuestasEnviadas(propuestasIds);
      setAdjuntosPorSolicitud(adjuntos);

      guardarCache({
        usuarioId: user.id,
        solicitudesDisponibles: disponiblesMapeadas,
        misSolicitudesCantidad: cantidadMisSolicitudes,
        propuestasEnviadas: Array.from(propuestasIds),
        serviciosActivosCantidad: cantidadServiciosActivos,
        categorias: categoriasCargadas,
        adjuntosPorSolicitud: adjuntos,
      });
    } catch (error) {
      console.error("Error inesperado al cargar panel:", error);
      setError("Ocurrió un error inesperado al cargar el inicio.");
    } finally {
      setActualizando(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      cargarPanel();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const categoriasVisibles = useMemo(() => {
    const desdeSolicitudes = solicitudesDisponibles
      .map((item) => ({
        id: item.categoria_id || item.categoria,
        nombre: item.categoria,
      }))
      .filter((item) => item.nombre && item.nombre !== "Sin categoría");

    const mezcladas = [...categorias, ...desdeSolicitudes];

    const unicas = new Map<string, Categoria>();

    mezcladas.forEach((item) => {
      if (!unicas.has(item.nombre)) {
        unicas.set(item.nombre, {
          id: item.id,
          nombre: item.nombre,
        });
      }
    });

    return Array.from(unicas.values()).slice(0, 8);
  }, [categorias, solicitudesDisponibles]);

  const solicitudesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return solicitudesDisponibles.filter((item) => {
      const coincideBusqueda =
        !texto ||
        item.titulo.toLowerCase().includes(texto) ||
        item.categoria.toLowerCase().includes(texto) ||
        item.zona.toLowerCase().includes(texto) ||
        item.descripcion.toLowerCase().includes(texto);

      const coincideCategoria =
        categoriaActiva === "Todas" || item.categoria === categoriaActiva;

      return coincideBusqueda && coincideCategoria;
    });
  }, [busqueda, categoriaActiva, solicitudesDisponibles]);

  const solicitudesDestacadas = solicitudesFiltradas.slice(0, 6);

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

        await cargarPanel();
        return;
      }

      guardarCache({
        usuarioId,
        solicitudesDisponibles,
        misSolicitudesCantidad,
        propuestasEnviadas: Array.from(nuevoSet),
        serviciosActivosCantidad,
        categorias,
        adjuntosPorSolicitud,
      });

      setMensaje("Propuesta enviada correctamente.");
      setModalPropuestaAbierto(false);
      setSolicitudSeleccionada(null);
      setMensajePropuesta("");
      setValorEstimado("");
      await cargarPanel();
    } catch (error) {
      console.error("Error inesperado al enviar propuesta:", error);
      setError("Ocurrió un error inesperado al enviar la propuesta.");
      await cargarPanel();
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

  const estadisticas = [
    {
      titulo: "Disponibles",
      valor: solicitudesDisponibles.length,
      descripcion: "Trabajos para postular",
      icono: Briefcase,
      path: "/panel/solicitudes",
    },
    {
      titulo: "Mis solicitudes",
      valor: misSolicitudesCantidad,
      descripcion: "Publicaciones creadas",
      icono: ClipboardList,
      path: "/panel/solicitudes",
    },
    {
      titulo: "Propuestas",
      valor: propuestasEnviadas.size,
      descripcion: "Enviadas por ti",
      icono: BadgeCheck,
      path: "/panel/propuestas",
    },
    {
      titulo: "Seguimiento",
      valor: serviciosActivosCantidad,
      descripcion: "Servicios activos",
      icono: MapPinned,
      path: "/panel/seguimiento",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section
        className={`rounded-[18px] border p-4 sm:p-5 ${estilos.tarjeta}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[#0B3C7F] font-bold text-sm mb-1">
              Panel principal
            </p>

            <h2
              className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
            >
              ¡Hola, {nombreMostrar}!
            </h2>

            <p className={`mt-2 max-w-3xl ${estilos.textoSecundario}`}>
              Explora solicitudes reales, publica servicios, revisa propuestas y
              gestiona tus trabajos desde un solo lugar.
            </p>
          </div>

          <div className="md:hidden relative w-full">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar oficios"
              className={`w-full rounded-full border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {accionesSuperiores.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                onClick={() => router.push(item.path)}
                className={`min-w-[84px] sm:min-w-[96px] rounded-2xl border px-3 py-3 transition ${
                  modoOscuro
                    ? "bg-[#111827] border-[#334155] hover:bg-[#1e293b] text-slate-200"
                    : "bg-[#f0f2f5] border-gray-200 hover:bg-[#e4e6eb] text-gray-700"
                }`}
              >
                <div
                  className={`mx-auto mb-2 w-10 h-10 rounded-full flex items-center justify-center ${
                    modoOscuro
                      ? "bg-[#1e293b] text-[#7fb3ff]"
                      : "bg-white text-[#0B3C7F]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <p className="text-xs font-bold">{item.title}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {estadisticas.map((item) => {
          const Icon = item.icono;

          return (
            <button
              key={item.titulo}
              type="button"
              onClick={() => router.push(item.path)}
              className={`rounded-[20px] border p-5 text-left transition hover:-translate-y-0.5 ${
                modoOscuro
                  ? "bg-[#111827] border-[#334155] hover:bg-[#162033]"
                  : "bg-white border-gray-100 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    modoOscuro
                      ? "bg-[#1e293b] text-[#7fb3ff]"
                      : "bg-[#eef5ff] text-[#0B3C7F]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <ArrowRight className={`w-5 h-5 ${estilos.textoSecundario}`} />
              </div>

              <p className={`mt-4 text-3xl font-extrabold ${estilos.textoPrincipal}`}>
                {item.valor}
              </p>

              <p className={`mt-1 font-bold ${estilos.textoPrincipal}`}>
                {item.titulo}
              </p>

              <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                {item.descripcion}
              </p>
            </button>
          );
        })}
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
        <div
          className={`px-4 sm:px-6 lg:px-7 pt-6 pb-5 border-b ${estilos.borde}`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[#0B3C7F] mb-3 ${
                  modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
                }`}
              >
                <Briefcase className="w-4 h-4" />
                OficiosYA
              </div>

              <h2
                className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
              >
                Marketplace de solicitudes
              </h2>

              <p className={`${estilos.textoSecundario} mt-1 max-w-2xl`}>
                Encuentra trabajos publicados por otros usuarios y envía una
                propuesta directamente desde el inicio.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={cargarPanel}
                disabled={actualizando}
                className={`rounded-2xl px-4 py-3 font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                  modoOscuro
                    ? "bg-[#111827] text-slate-300 border border-[#334155] hover:bg-[#1e293b]"
                    : "bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]"
                }`}
              >
                {actualizando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                Actualizar
              </button>

              <button
                type="button"
                onClick={() => router.push("/panel/solicitudes")}
                className="rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold hover:bg-[#092f63] transition flex items-center justify-center gap-2"
              >
                Ver todas
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="hidden md:block relative w-full mt-5">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por oficio, zona o categoría"
              className={`w-full rounded-full border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
            />
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoriaActiva("Todas")}
              className={`min-w-[130px] rounded-2xl border p-3 text-left transition ${
                categoriaActiva === "Todas"
                  ? "bg-[#0B3C7F] text-white border-[#0B3C7F]"
                  : modoOscuro
                  ? "bg-[#111827] border-[#334155] text-slate-200"
                  : "bg-[#f8fafc] border-gray-100 text-gray-700"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 ${
                  categoriaActiva === "Todas"
                    ? "bg-white/15 text-white"
                    : modoOscuro
                    ? "bg-[#1e293b] text-[#7fb3ff]"
                    : "bg-white text-[#0B3C7F]"
                }`}
              >
                <Briefcase className="w-5 h-5" />
              </div>

              <p className="text-sm font-bold">Todas</p>
            </button>

            {categoriasVisibles.map((item) => (
              <button
                type="button"
                key={item.nombre}
                onClick={() => setCategoriaActiva(item.nombre)}
                className={`min-w-[150px] rounded-2xl border p-3 text-left transition ${
                  categoriaActiva === item.nombre
                    ? "bg-[#0B3C7F] text-white border-[#0B3C7F]"
                    : modoOscuro
                    ? "bg-[#111827] border-[#334155] text-slate-200"
                    : "bg-[#f8fafc] border-gray-100 text-gray-700"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 ${
                    categoriaActiva === item.nombre
                      ? "bg-white/15"
                      : modoOscuro
                      ? "bg-[#1e293b]"
                      : "bg-white"
                  }`}
                >
                  <IconoCategoria
                    nombre={item.nombre}
                    modoOscuro={
                      categoriaActiva === item.nombre ? true : modoOscuro
                    }
                  />
                </div>

                <p className="text-sm font-bold line-clamp-1">{item.nombre}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-7">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h3 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
                Solicitudes disponibles
              </h3>
              <p className={`text-sm ${estilos.textoSecundario}`}>
                {solicitudesFiltradas.length} resultado(s) encontrados
              </p>
            </div>
          </div>

          {solicitudesDestacadas.length === 0 ? (
            <div
              className={`rounded-[24px] border border-dashed p-10 text-center ${
                modoOscuro
                  ? "border-[#334155] bg-[#111827]"
                  : "border-gray-300 bg-[#f8fafc]"
              }`}
            >
              <Briefcase className="w-12 h-12 mx-auto text-gray-400" />

              <p className={`mt-4 font-extrabold ${estilos.textoPrincipal}`}>
                No hay solicitudes disponibles
              </p>

              <p className={`${estilos.textoSecundario} text-sm mt-1`}>
                Cuando otros usuarios publiquen solicitudes, aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
              {solicitudesDestacadas.map((item) => {
                const yaEnvioPropuesta = propuestasEnviadas.has(item.id);

                return (
                  <article
                    key={item.id}
                    className={`rounded-[22px] border p-5 transition hover:-translate-y-1 ${
                      modoOscuro
                        ? "bg-[#111827] border-[#334155] hover:bg-[#162033]"
                        : "bg-white border-gray-100 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                          modoOscuro ? "bg-[#1e293b]" : "bg-[#eef5ff]"
                        }`}
                      >
                        <IconoCategoria
                          nombre={item.categoria}
                          modoOscuro={modoOscuro}
                        />
                      </div>

                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          modoOscuro
                            ? "bg-[#0f172a] text-slate-300"
                            : "bg-[#eef4ff] text-[#0B3C7F]"
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        {item.categoria}
                      </div>
                    </div>

                    <h3
                      className={`font-extrabold text-lg leading-snug mb-1 ${estilos.textoPrincipal}`}
                    >
                      {item.titulo}
                    </h3>

                    <p className="text-sm text-[#1E5DB8] font-semibold mb-2">
                      {item.categoria} · {item.zona}
                    </p>

                    <p
                      className={`${estilos.textoSecundario} text-sm leading-6 mb-4 line-clamp-3`}
                    >
                      {item.descripcion}
                    </p>

                    {renderAdjuntosMini(item.id)}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                      <div
                        className={`rounded-2xl border px-3 py-3 ${
                          modoOscuro
                            ? "border-[#334155] bg-[#0f172a]"
                            : "border-blue-50 bg-[#f8fbff]"
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <p
                          className={`mt-1 text-xs font-bold ${estilos.textoSecundario}`}
                        >
                          Zona
                        </p>
                        <p
                          className={`mt-1 text-sm font-bold line-clamp-1 ${estilos.textoPrincipal}`}
                        >
                          {item.zona}
                        </p>
                      </div>

                      <div
                        className={`rounded-2xl border px-3 py-3 ${
                          modoOscuro
                            ? "border-[#334155] bg-[#0f172a]"
                            : "border-blue-50 bg-[#f8fbff]"
                        }`}
                      >
                        <CalendarDays className="w-4 h-4 text-gray-400" />
                        <p
                          className={`mt-1 text-xs font-bold ${estilos.textoSecundario}`}
                        >
                          Fecha
                        </p>
                        <p
                          className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}
                        >
                          {formatearFecha(item.fecha_preferida)}
                        </p>
                      </div>

                      <div
                        className={`rounded-2xl border px-3 py-3 ${
                          modoOscuro
                            ? "border-[#334155] bg-[#0f172a]"
                            : "border-blue-50 bg-[#f8fbff]"
                        }`}
                      >
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <p
                          className={`mt-1 text-xs font-bold ${estilos.textoSecundario}`}
                        >
                          Presupuesto
                        </p>
                        <p
                          className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}
                        >
                          {formatearPresupuesto(item.presupuesto)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-5">
                      <button
                        type="button"
                        onClick={() => setSolicitudDetalle(item)}
                        className="rounded-2xl bg-[#0B3C7F] text-white px-4 py-2.5 font-semibold shadow-[0_10px_22px_rgba(11,60,127,0.18)] hover:bg-[#092f63] transition flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Ver detalle
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirModalPropuesta(item)}
                        disabled={yaEnvioPropuesta}
                        className={`rounded-2xl border px-4 py-2.5 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 ${
                          modoOscuro
                            ? "border-[#334155] bg-[#1e293b] text-white hover:bg-[#263449]"
                            : "border-gray-200 bg-white text-[#0B3C7F] hover:bg-[#f5f9ff]"
                        }`}
                      >
                        {yaEnvioPropuesta ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {yaEnvioPropuesta ? "Enviada" : "Enviar propuesta"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {solicitudesFiltradas.length > 6 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => router.push("/panel/solicitudes")}
                className={`w-full rounded-2xl border px-5 py-4 font-bold transition flex items-center justify-center gap-2 ${
                  modoOscuro
                    ? "border-[#334155] text-white hover:bg-[#1e293b]"
                    : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                }`}
              >
                Ver todas las solicitudes
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </section>

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
                {solicitudDetalle.direccion_mapa || "Sin coordenadas visibles"}
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
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

              <button
                type="button"
                onClick={() => router.push("/panel/solicitudes")}
                className={`w-full rounded-2xl border px-5 py-3 font-bold transition ${
                  modoOscuro
                    ? "border-[#334155] text-white hover:bg-[#1e293b]"
                    : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                }`}
              >
                Ver en solicitudes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}