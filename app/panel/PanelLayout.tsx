"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  User,
  Star,
  ShieldCheck,
  ClipboardList,
  Clock3,
  MapPinned,
  LogOut,
  Bell,
  Briefcase,
  ChevronRight,
  BadgeCheck,
  Menu,
  X,
  Home,
  PlusCircle,
  Settings,
  Moon,
  Sun,
  Flag,
  MessageSquare,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export type PerfilPanel = {
  nombre_completo: string | null;
  es_cliente: boolean;
  es_trabajador: boolean;
  es_admin: boolean;
  activo: boolean;
  verificado: boolean;
  zona: string | null;
  telefono: string | null;
  foto_url: string | null;
};

type Notificacion = {
  id: string;
  usuario_id: string;
  actor_id: string | null;
  tipo: string;
  titulo: string;
  mensaje: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  url_destino: string;
  metadata: Record<string, unknown>;
  leida: boolean;
  leida_en: string | null;
  creada_en: string;
};

type PanelLayoutContext = {
  perfil: PerfilPanel;
  correo: string;
  nombreMostrar: string;
  busqueda: string;
  setBusqueda: (valor: string) => void;
  modoOscuro: boolean;
  estilos: {
    fondoPagina: string;
    tarjeta: string;
    tarjetaSuave: string;
    textoPrincipal: string;
    textoSecundario: string;
    borde: string;
    inputBase: string;
  };
};

const PERFIL_VACIO: PerfilPanel = {
  nombre_completo: null,
  es_cliente: true,
  es_trabajador: false,
  es_admin: false,
  activo: true,
  verificado: false,
  zona: null,
  telefono: null,
  foto_url: null,
};

const CACHE_KEY = "oficiosya-panel-cache";

const PanelContext = createContext<PanelLayoutContext | null>(null);

export function usePanelContext() {
  const contexto = useContext(PanelContext);

  if (!contexto) {
    throw new Error("usePanelContext debe usarse dentro de PanelLayout.");
  }

  return contexto;
}

type PanelLayoutProps = {
  children: ReactNode;
};

const formatearFechaNotificacion = (fecha: string | null) => {
  if (!fecha) return "Ahora";

  const fechaNotificacion = new Date(fecha);

  if (Number.isNaN(fechaNotificacion.getTime())) return "Ahora";

  return fechaNotificacion.toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const obtenerTextoVacioNotificaciones = () => {
  return {
    titulo: "Sin notificaciones",
    descripcion: "Cuando ocurra algo importante, aparecerá aquí.",
  };
};

export default function PanelLayout({ children }: PanelLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const obtenerCacheInicial = () => {
    if (typeof window === "undefined") {
      return {
        perfil: PERFIL_VACIO,
        correo: "",
        modoOscuro: false,
      };
    }

    let perfilInicial = PERFIL_VACIO;
    let correoInicial = "";

    const temaGuardado = localStorage.getItem("oficiosya-tema");
    const cache = localStorage.getItem(CACHE_KEY);

    if (cache) {
      try {
        const data = JSON.parse(cache) as {
          perfil?: PerfilPanel;
          correo?: string;
        };

        if (data.perfil) {
          perfilInicial = data.perfil;
        }

        if (data.correo) {
          correoInicial = data.correo;
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }

    return {
      perfil: perfilInicial,
      correo: correoInicial,
      modoOscuro: temaGuardado === "oscuro",
    };
  };

  const [datosIniciales] = useState(obtenerCacheInicial);

  const [usuarioId, setUsuarioId] = useState("");
  const [perfil, setPerfil] = useState<PerfilPanel>(datosIniciales.perfil);
  const [correo, setCorreo] = useState(datosIniciales.correo);
  const [busqueda, setBusqueda] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [modoOscuro, setModoOscuro] = useState(datosIniciales.modoOscuro);

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);

  const modoRender = montado ? modoOscuro : false;
  const perfilRender = montado ? perfil : PERFIL_VACIO;
  const correoRender = montado ? correo : "";

  const notificacionesNoLeidas = useMemo(() => {
    return notificaciones.filter((item) => !item.leida).length;
  }, [notificaciones]);

  const advertenciaAdminActiva = useMemo(() => {
    return (
      notificaciones.find(
        (item) => item.tipo === "advertencia_admin" && !item.leida
      ) || null
    );
  }, [notificaciones]);

  const cambiarTema = () => {
    const nuevoModo = !modoOscuro;
    setModoOscuro(nuevoModo);
    localStorage.setItem("oficiosya-tema", nuevoModo ? "oscuro" : "claro");
  };

  const cargarNotificaciones = async (idUsuario: string) => {
    if (!idUsuario) return;

    const { data, error } = await supabase
      .from("notificaciones")
      .select(
        "id, usuario_id, actor_id, tipo, titulo, mensaje, entidad_tipo, entidad_id, url_destino, metadata, leida, leida_en, creada_en"
      )
      .eq("usuario_id", idUsuario)
      .order("creada_en", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Error al cargar notificaciones:", error);
      return;
    }

    setNotificaciones((data || []) as Notificacion[]);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMontado(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let activo = true;
    let canalNotificaciones: ReturnType<typeof supabase.channel> | null = null;

    const sincronizarPanel = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!activo) return;

      if (authError || !user) {
        localStorage.removeItem(CACHE_KEY);
        router.replace("/login");
        return;
      }

      setUsuarioId(user.id);
      setCorreo(user.email || "");

      const { data: perfilData, error: perfilError } = await supabase
        .from("perfiles")
        .select(
          "nombre_completo, es_cliente, es_trabajador, es_admin, activo, verificado, zona, telefono, foto_url"
        )
        .eq("id", user.id)
        .single();

      if (!activo) return;

      if (perfilError || !perfilData) {
        console.error("No se encontró perfil:", perfilError);
        return;
      }

      if (!perfilData.activo) {
        localStorage.removeItem(CACHE_KEY);
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (perfilData.es_admin) {
        router.replace("/admin");
        return;
      }

      const perfilActualizado = perfilData as PerfilPanel;

      setPerfil(perfilActualizado);

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          perfil: perfilActualizado,
          correo: user.email || "",
        })
      );

      await cargarNotificaciones(user.id);

      canalNotificaciones = supabase
        .channel(`notificaciones-panel-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notificaciones",
            filter: `usuario_id=eq.${user.id}`,
          },
          () => {
            cargarNotificaciones(user.id);
          }
        )
        .subscribe();
    };

    const timeout = window.setTimeout(() => {
      sincronizarPanel();
    }, 0);

    return () => {
      activo = false;
      window.clearTimeout(timeout);

      if (canalNotificaciones) {
        supabase.removeChannel(canalNotificaciones);
      }
    };
  }, [router]);

  const cerrarSesion = async () => {
    // Limpiar todos los cachés de la aplicación
    const cacheKeys = [
      'oficiosya-panel-cache',
      'oficiosya-propuestas-cache', 
      'oficiosya-resenas-cache',
      'oficiosya-trabajador-cache-v2'
    ];
    cacheKeys.forEach(key => localStorage.removeItem(key));
    
    // Limpiar TODAS las claves de sesión de Supabase (empiezan con 'sb-')
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Limpiar sessionStorage por completo
    sessionStorage.clear();
    
    // Cerrar sesión en Supabase
    await supabase.auth.signOut();
    
    // Redirigir al login (replace evita que la flecha atrás vuelva al panel)
    router.replace('/login');
  };

  const nombreMostrar = montado
    ? perfil.nombre_completo || "Usuario"
    : "Usuario";

  const menuPrincipal = [
    { label: "Mi perfil", icon: User, path: "/panel/perfil" },
    { label: "Perfil trabajador", icon: Briefcase, path: "/panel/trabajador" },
    { label: "Buscar trabajadores", icon: Search, path: "/panel/buscar" },
    { label: "Publicar solicitud", icon: PlusCircle, path: "/panel/publicar" },
    { label: "Solicitudes", icon: ClipboardList, path: "/panel/solicitudes" },
    { label: "Propuestas", icon: BadgeCheck, path: "/panel/propuestas" },
    { label: "Seguimiento", icon: MapPinned, path: "/panel/seguimiento" },
    { label: "Reseñas", icon: Star, path: "/panel/resenas" },
    {
      label: "Validación identidad",
      icon: ShieldCheck,
      path: "/panel/validacion-identidad",
    },
    { label: "Reportes", icon: Flag, path: "/panel/reportes" },
    { label: "Historial", icon: Clock3, path: "/panel/historial" },
  ];

  const estilos = useMemo(
    () => ({
      fondoPagina: modoRender ? "bg-[#0f172a]" : "bg-[#f0f2f5]",

      tarjeta: modoRender
        ? "bg-[#1e293b] border-[#334155] text-white"
        : "bg-white border-gray-200 text-gray-900",

      tarjetaSuave: modoRender
        ? "bg-[#111827] border-[#334155]"
        : "bg-[#f8fafc] border-gray-100",

      textoPrincipal: modoRender ? "text-white" : "text-gray-900",

      textoSecundario: modoRender ? "text-slate-300" : "text-gray-500",

      borde: modoRender ? "border-[#334155]" : "border-gray-200",

      inputBase: modoRender
        ? "bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#60a5fa] focus:shadow-[0_0_0_4px_rgba(96,165,250,0.16)]"
        : "bg-[#f0f2f5] border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-[#0B3C7F] focus:bg-white focus:shadow-[0_0_0_4px_rgba(11,60,127,0.12)]",
    }),
    [modoRender]
  );

  const esRutaActiva = (ruta: string) => {
    if (ruta === "/panel") return pathname === "/panel";
    return pathname === ruta || pathname.startsWith(`${ruta}/`);
  };

  const marcarNotificacionLeida = async (notificacion: Notificacion) => {
    if (notificacion.leida) return;

    const ahora = new Date().toISOString();

    setNotificaciones((actuales) =>
      actuales.map((item) =>
        item.id === notificacion.id
          ? {
              ...item,
              leida: true,
              leida_en: ahora,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("notificaciones")
      .update({
        leida: true,
        leida_en: ahora,
      })
      .eq("id", notificacion.id)
      .eq("usuario_id", notificacion.usuario_id);

    if (error) {
      console.error("No se pudo marcar la notificación como leída:", error);
    }
  };

  const abrirNotificacion = async (notificacion: Notificacion) => {
    setNotificacionesAbiertas(false);

    await marcarNotificacionLeida(notificacion);

    router.push(notificacion.url_destino || "/panel");
  };

  const cerrarAdvertenciaBanner = async () => {
    if (!advertenciaAdminActiva) return;
    await marcarNotificacionLeida(advertenciaAdminActiva);
  };

  const marcarTodasComoLeidas = async () => {
    const noLeidas = notificaciones.filter((item) => !item.leida);

    if (noLeidas.length === 0) return;

    const ahora = new Date().toISOString();

    setNotificaciones((actuales) =>
      actuales.map((item) => ({
        ...item,
        leida: true,
        leida_en: item.leida_en || ahora,
      }))
    );

    let consulta = supabase
      .from("notificaciones")
      .update({
        leida: true,
        leida_en: ahora,
      })
      .in(
        "id",
        noLeidas.map((item) => item.id)
      );

    if (usuarioId) {
      consulta = consulta.eq("usuario_id", usuarioId);
    }

    const { error } = await consulta;

    if (error) {
      console.error("No se pudieron marcar todas como leídas:", error);
    }
  };

  const contexto: PanelLayoutContext = {
    perfil: perfilRender,
    correo: correoRender,
    nombreMostrar,
    busqueda,
    setBusqueda,
    modoOscuro: modoRender,
    estilos,
  };

  return (
    <PanelContext.Provider value={contexto}>
      <div
        className={`min-h-dvh w-full overflow-x-hidden ${estilos.fondoPagina}`}
      >
        {menuAbierto && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <div
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => setMenuAbierto(false)}
            />

            <aside
              className={`relative h-full w-[320px] max-w-[86vw] border-r shadow-[0_30px_70px_rgba(0,0,0,0.25)] ${
                modoRender
                  ? "bg-[#111827] border-[#334155] text-white"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              <div className="h-full p-5 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        router.push("/panel");
                        setMenuAbierto(false);
                      }}
                      className="w-11 h-11 rounded-2xl bg-[#0B3C7F] text-white flex items-center justify-center font-black shadow-lg"
                    >
                      OY
                    </button>

                    <div>
                      <h2 className="text-xl leading-none font-extrabold">
                        OficiosYA
                      </h2>
                      <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                        Panel principal
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setMenuAbierto(false)}
                    className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
                      modoRender
                        ? "bg-[#1e293b] border-[#334155]"
                        : "bg-[#f0f2f5] border-gray-200"
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <UserCard
                  perfil={perfilRender}
                  correo={correoRender}
                  nombreMostrar={nombreMostrar}
                  estilos={estilos}
                  modoOscuro={modoRender}
                />

                <nav className="space-y-2 flex-1 overflow-y-auto pr-1">
                  {menuPrincipal.map((item) => {
                    const Icon = item.icon;
                    const activo = esRutaActiva(item.path);

                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          router.push(item.path);
                          setMenuAbierto(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 font-semibold transition ${
                          activo
                            ? "bg-[#e7f0ff] text-[#0B3C7F]"
                            : modoRender
                            ? "bg-transparent text-slate-200 hover:bg-[#1e293b]"
                            : "bg-transparent text-gray-700 hover:bg-[#f0f2f5]"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </span>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    );
                  })}
                </nav>

                <ConfigCard
                  modoOscuro={modoRender}
                  estilos={estilos}
                  cambiarTema={cambiarTema}
                />

                <button
                  onClick={cerrarSesion}
                  className="w-full mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#0B3C7F] px-4 py-3 font-bold text-white hover:bg-[#092f63] transition"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        )}

        <header
          className={`sticky top-0 z-30 w-full border-b ${
            modoRender
              ? "bg-[#111827]/95 border-[#334155]"
              : "bg-white/95 border-gray-200"
          } backdrop-blur-xl`}
        >
          <div className="w-full px-3 sm:px-4 lg:px-5">
            <div className="h-[68px] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMenuAbierto(true)}
                  className={`xl:hidden w-11 h-11 rounded-full flex items-center justify-center transition ${
                    modoRender
                      ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                      : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                  }`}
                >
                  <Menu className="w-6 h-6" />
                </button>

                <button
                  onClick={() => router.push("/panel")}
                  className="w-11 h-11 rounded-full bg-[#0B3C7F] text-white flex items-center justify-center font-black shadow-sm"
                >
                  OY
                </button>

                <div className="hidden sm:block min-w-0">
                  <h1
                    className={`font-extrabold leading-none ${estilos.textoPrincipal}`}
                  >
                    OficiosYA
                  </h1>
                  <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                    Empleos y servicios locales
                  </p>
                </div>
              </div>

              <div className="hidden md:flex flex-1 max-w-[520px] relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por oficio, zona o categoría"
                  className={`w-full rounded-full border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                />
              </div>

              <div className="flex items-center gap-2">
                <IconButton
                  modoOscuro={modoRender}
                  onClick={() => router.push("/panel")}
                >
                  <Home className="w-5 h-5" />
                </IconButton>

                <IconButton modoOscuro={modoRender} onClick={cambiarTema}>
                  {modoRender ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </IconButton>

                <div className="relative">
                  <IconButton
                    modoOscuro={modoRender}
                    onClick={() => setNotificacionesAbiertas((prev) => !prev)}
                  >
                    <div className="relative">
                      <Bell className="w-5 h-5" />
                      {notificacionesNoLeidas > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                          {notificacionesNoLeidas > 9
                            ? "9+"
                            : notificacionesNoLeidas}
                        </span>
                      )}
                    </div>
                  </IconButton>

                  {notificacionesAbiertas && (
                    <div
                      className={`absolute right-0 mt-3 w-[360px] max-w-[calc(100vw-24px)] rounded-[22px] border shadow-[0_24px_70px_rgba(0,0,0,0.25)] overflow-hidden ${
                        modoRender
                          ? "bg-[#111827] border-[#334155]"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className={`px-4 py-3 border-b ${estilos.borde}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className={`font-extrabold ${estilos.textoPrincipal}`}
                            >
                              Notificaciones
                            </p>
                            <p className={`text-xs ${estilos.textoSecundario}`}>
                              Actividad reciente de tu cuenta
                            </p>
                          </div>

                          {notificacionesNoLeidas > 0 && (
                            <button
                              type="button"
                              onClick={marcarTodasComoLeidas}
                              className="text-xs font-bold text-[#0B3C7F] hover:underline"
                            >
                              Marcar leídas
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-[390px] overflow-y-auto p-2">
                        {notificaciones.length === 0 ? (
                          <NotificacionesVacias
                            estilos={estilos}
                            modoOscuro={modoRender}
                          />
                        ) : (
                          notificaciones.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => abrirNotificacion(item)}
                              className={`w-full text-left rounded-2xl p-3 transition ${
                                !item.leida
                                  ? modoRender
                                    ? item.tipo === "advertencia_admin"
                                      ? "bg-[#3f2d05]/70 hover:bg-[#4a3508]"
                                      : "bg-[#172554]/40 hover:bg-[#1e293b]"
                                    : item.tipo === "advertencia_admin"
                                    ? "bg-[#fff7ed] hover:bg-[#ffedd5]"
                                    : "bg-[#eef5ff] hover:bg-[#e7f0ff]"
                                  : modoRender
                                  ? "hover:bg-[#1e293b]"
                                  : "hover:bg-[#f0f2f5]"
                              }`}
                            >
                              <div className="flex gap-3">
                                <div
                                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                    item.tipo === "advertencia_admin" &&
                                    !item.leida
                                      ? "bg-[#ffedd5] text-[#c2410c]"
                                      : item.leida
                                      ? modoRender
                                        ? "bg-[#1e293b] text-slate-300"
                                        : "bg-[#f0f2f5] text-gray-500"
                                      : "bg-[#e7f0ff] text-[#0B3C7F]"
                                  }`}
                                >
                                  {item.tipo === "advertencia_admin" &&
                                  !item.leida ? (
                                    <ShieldAlert className="w-5 h-5" />
                                  ) : item.leida ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                  ) : (
                                    <MessageSquare className="w-5 h-5" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p
                                      className={`text-sm font-extrabold line-clamp-1 ${estilos.textoPrincipal}`}
                                    >
                                      {item.titulo}
                                    </p>

                                    {!item.leida && (
                                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0 mt-1.5" />
                                    )}
                                  </div>

                                  <p
                                    className={`text-xs mt-0.5 line-clamp-2 ${estilos.textoSecundario}`}
                                  >
                                    {item.mensaje}
                                  </p>

                                  <p
                                    className={`text-[11px] mt-2 font-semibold ${estilos.textoSecundario}`}
                                  >
                                    {formatearFechaNotificacion(item.creada_en)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      <div className={`p-2 border-t ${estilos.borde}`}>
                        <button
                          onClick={() => {
                            setNotificacionesAbiertas(false);
                            router.push("/panel/historial");
                          }}
                          className="w-full rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold hover:bg-[#092f63] transition"
                        >
                          Ver historial
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => router.push("/panel/perfil")}
                  className={`w-11 h-11 rounded-full flex items-center justify-center overflow-hidden transition ${
                    modoRender
                      ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                      : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                  }`}
                >
                  {perfilRender.foto_url ? (
                    <img
                      src={perfilRender.foto_url}
                      alt="Foto perfil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="relative z-10 w-full px-3 sm:px-4 lg:px-5 py-4 pb-24 md:pb-4">
          <div className="grid min-h-[calc(100dvh-100px)] w-full grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
            <aside
              className={`hidden xl:block xl:sticky xl:top-[84px] xl:h-[calc(100dvh-100px)] rounded-[18px] border overflow-hidden ${estilos.tarjeta}`}
            >
              <div className="h-full p-4 flex flex-col">
                <UserCard
                  perfil={perfilRender}
                  correo={correoRender}
                  nombreMostrar={nombreMostrar}
                  estilos={estilos}
                  modoOscuro={modoRender}
                />

                <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {menuPrincipal.map((item) => {
                    const Icon = item.icon;
                    const activo = esRutaActiva(item.path);

                    return (
                      <button
                        key={item.label}
                        onClick={() => router.push(item.path)}
                        className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 font-semibold transition ${
                          activo
                            ? "bg-[#e7f0ff] text-[#0B3C7F]"
                            : modoRender
                            ? "text-slate-200 hover:bg-[#1e293b]"
                            : "text-gray-700 hover:bg-[#f0f2f5]"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </span>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    );
                  })}
                </nav>

                <ConfigCard
                  modoOscuro={modoRender}
                  estilos={estilos}
                  cambiarTema={cambiarTema}
                />

                <button
                  onClick={cerrarSesion}
                  className={`w-full mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold transition ${
                    modoRender
                      ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                      : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                  }`}
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar sesión
                </button>
              </div>
            </aside>

            <main className="min-w-0">
              {advertenciaAdminActiva && (
                <div
                  className={`mb-4 overflow-hidden rounded-[22px] border shadow-sm ${
                    modoRender
                      ? "border-[#713f12] bg-[#422006] text-amber-50"
                      : "border-orange-200 bg-orange-50 text-orange-950"
                  }`}
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                          modoRender
                            ? "bg-[#78350f] text-amber-200"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        <ShieldAlert className="h-6 w-6" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-extrabold">
                            {advertenciaAdminActiva.titulo ||
                              "Advertencia administrativa"}
                          </p>

                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-black ${
                              modoRender
                                ? "bg-amber-900/60 text-amber-100"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            Importante
                          </span>
                        </div>

                        <p
                          className={`mt-1 text-sm leading-relaxed ${
                            modoRender ? "text-amber-100" : "text-orange-800"
                          }`}
                        >
                          {advertenciaAdminActiva.mensaje}
                        </p>

                        <p
                          className={`mt-2 text-xs font-semibold ${
                            modoRender ? "text-amber-200" : "text-orange-600"
                          }`}
                        >
                          {formatearFechaNotificacion(
                            advertenciaAdminActiva.creada_en
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          abrirNotificacion(advertenciaAdminActiva)
                        }
                        className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                          modoRender
                            ? "bg-amber-100 text-[#422006] hover:bg-white"
                            : "bg-orange-600 text-white hover:bg-orange-700"
                        }`}
                      >
                        Ver detalles
                      </button>

                      <button
                        type="button"
                        onClick={cerrarAdvertenciaBanner}
                        className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                          modoRender
                            ? "border-amber-700 text-amber-100 hover:bg-amber-900/50"
                            : "border-orange-200 bg-white text-orange-700 hover:bg-orange-100"
                        }`}
                      >
                        Entendido
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {children}
            </main>
          </div>
        </div>

        <nav
          className={`fixed bottom-0 left-0 right-0 z-30 md:hidden border-t px-2 py-2 shadow-[0_-12px_30px_rgba(0,0,0,0.10)] ${
            modoRender
              ? "bg-[#111827]/95 border-[#334155]"
              : "bg-white/95 border-gray-200"
          } backdrop-blur-xl`}
        >
          <div className="grid grid-cols-5 gap-1">
            {[
              { title: "Inicio", icon: Home, path: "/panel" },
              { title: "Buscar", icon: Search, path: "/panel/buscar" },
              { title: "Publicar", icon: PlusCircle, path: "/panel/publicar" },
              {
                title: "Servicios",
                icon: ClipboardList,
                path: "/panel/solicitudes",
              },
              { title: "Perfil", icon: User, path: "/panel/perfil" },
            ].map((item) => {
              const Icon = item.icon;
              const activo = esRutaActiva(item.path);

              return (
                <button
                  key={item.title}
                  onClick={() => router.push(item.path)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition ${
                    activo
                      ? "bg-[#eef5ff] text-[#0B3C7F]"
                      : modoRender
                      ? "text-slate-300 hover:bg-[#1e293b] hover:text-[#7fb3ff]"
                      : "text-gray-500 hover:bg-[#eef5ff] hover:text-[#0B3C7F]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-bold">{item.title}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </PanelContext.Provider>
  );
}

function IconButton({
  children,
  modoOscuro,
  onClick,
}: {
  children: ReactNode;
  modoOscuro: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
        modoOscuro
          ? "bg-[#1e293b] text-white hover:bg-[#263449]"
          : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
      }`}
    >
      {children}
    </button>
  );
}

function UserCard({
  perfil,
  correo,
  nombreMostrar,
  estilos,
  modoOscuro,
}: {
  perfil: PerfilPanel;
  correo: string;
  nombreMostrar: string;
  estilos: PanelLayoutContext["estilos"];
  modoOscuro: boolean;
}) {
  return (
    <div className={`rounded-[18px] border p-4 mb-4 ${estilos.tarjetaSuave}`}>
      <div className="flex items-center gap-3">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border ${
            modoOscuro
              ? "bg-[#0f172a] border-[#334155]"
              : "bg-white border-gray-100"
          }`}
        >
          {perfil.foto_url ? (
            <img
              src={perfil.foto_url}
              alt="Foto perfil"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-7 h-7 text-[#0B3C7F]" />
          )}
        </div>

        <div className="min-w-0">
          <p className={`font-bold text-base truncate ${estilos.textoPrincipal}`}>
            {nombreMostrar}
          </p>
          <p className={`text-xs truncate ${estilos.textoSecundario}`}>
            {correo || "Cuenta OficiosYA"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {perfil.es_cliente && (
          <span className="px-3 py-1 rounded-full bg-[#e7f0ff] text-[#0B3C7F] text-xs font-bold">
            Cliente
          </span>
        )}

        {perfil.es_trabajador && (
          <span className="px-3 py-1 rounded-full bg-[#eaf8ef] text-[#166534] text-xs font-bold">
            Trabajador
          </span>
        )}

        {perfil.verificado && (
          <span className="px-3 py-1 rounded-full bg-[#f3e8ff] text-[#7e22ce] text-xs font-bold flex items-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5" />
            Verificado
          </span>
        )}
      </div>
    </div>
  );
}

function ConfigCard({
  modoOscuro,
  estilos,
  cambiarTema,
}: {
  modoOscuro: boolean;
  estilos: PanelLayoutContext["estilos"];
  cambiarTema: () => void;
}) {
  return (
    <div className={`rounded-2xl border p-4 mt-4 ${estilos.tarjetaSuave}`}>
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-5 h-5 text-[#0B3C7F]" />
        <p className={`font-extrabold ${estilos.textoPrincipal}`}>
          Configuración
        </p>
      </div>

      <button
        onClick={cambiarTema}
        className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 font-bold transition ${
          modoOscuro
            ? "bg-[#0f172a] text-white hover:bg-[#162033]"
            : "bg-white text-[#0B3C7F] hover:bg-[#eef5ff]"
        }`}
      >
        <span className="flex items-center gap-2">
          {modoOscuro ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {modoOscuro ? "Modo claro" : "Modo oscuro"}
        </span>
      </button>
    </div>
  );
}

function NotificacionesVacias({
  estilos,
  modoOscuro,
}: {
  estilos: PanelLayoutContext["estilos"];
  modoOscuro: boolean;
}) {
  const texto = obtenerTextoVacioNotificaciones();

  return (
    <div className="p-5 text-center">
      <div
        className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
          modoOscuro ? "bg-[#1e293b]" : "bg-[#f0f2f5]"
        }`}
      >
        <Bell className="w-6 h-6 text-gray-400" />
      </div>

      <p className={`mt-3 text-sm font-bold ${estilos.textoPrincipal}`}>
        {texto.titulo}
      </p>

      <p className={`mt-1 text-xs ${estilos.textoSecundario}`}>
        {texto.descripcion}
      </p>
    </div>
  );
}