"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  Star,
  BadgeCheck,
  Briefcase,
  Clock3,
  Filter,
  UserRound,
  Send,
  AlertCircle,
  X,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";

type Categoria = {
  id: string;
  nombre: string;
  activa: boolean;
};

type PerfilUsuario = {
  id: string;
  nombre_completo: string;
  verificado: boolean;
  activo: boolean;
  es_trabajador: boolean;
};

type PerfilTrabajador = {
  id: string;
  usuario_id: string;
  descripcion: string | null;
  experiencia_anios: number;
  disponibilidad: string | null;
  zona_atencion: string | null;
  calificacion_promedio: number;
  servicios_completados: number;
  disponible: boolean;
};

type TrabajadorCategoria = {
  perfil_trabajador_id: string;
  categoria_id: string;
};

type Trabajador = {
  id: string;
  usuario_id: string;
  nombre: string;
  descripcion: string;
  experiencia: number;
  zona: string;
  disponibilidad: string;
  verificado: boolean;
  reputacion: number;
  serviciosCompletados: number;
  disponible: boolean;
  categorias: string[];
};

type SolicitudCliente = {
  id: string;
  titulo: string;
  descripcion: string;
  zona: string | null;
  estado: string;
  fecha_preferida: string | null;
};

type CacheBuscar = {
  usuarioId: string;
  categorias: Categoria[];
  trabajadores: Trabajador[];
  solicitudesCliente: SolicitudCliente[];
};

const CACHE_KEY = "oficiosya-buscar-cache";

const cacheVacio: CacheBuscar = {
  usuarioId: "",
  categorias: [],
  trabajadores: [],
  solicitudesCliente: [],
};

const leerCacheInicial = (): CacheBuscar => {
  if (typeof window === "undefined") return cacheVacio;

  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return cacheVacio;

    const data = JSON.parse(cache) as Partial<CacheBuscar>;

    return {
      usuarioId: data.usuarioId || "",
      categorias: data.categorias || [],
      trabajadores: data.trabajadores || [],
      solicitudesCliente: data.solicitudesCliente || [],
    };
  } catch {
    return cacheVacio;
  }
};

const guardarCache = (data: CacheBuscar) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    console.warn("No se pudo guardar el caché de búsqueda.");
  }
};

export default function BuscarView() {
  const { estilos, modoOscuro } = usePanelContext();

  const [cacheInicial] = useState<CacheBuscar>(() => leerCacheInicial());

  const [usuarioId, setUsuarioId] = useState(cacheInicial.usuarioId);
  const [categorias, setCategorias] = useState<Categoria[]>(
    cacheInicial.categorias
  );
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>(
    cacheInicial.trabajadores
  );
  const [solicitudesCliente, setSolicitudesCliente] = useState<
    SolicitudCliente[]
  >(cacheInicial.solicitudesCliente);

  const [trabajadorSeleccionado, setTrabajadorSeleccionado] =
    useState<Trabajador | null>(null);
  const [modalInvitar, setModalInvitar] = useState<Trabajador | null>(null);

  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] = useState("");
  const [mensajeInvitacion, setMensajeInvitacion] = useState("");
  const [enviandoInvitacion, setEnviandoInvitacion] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [errorInvitacion, setErrorInvitacion] = useState("");

  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [zona, setZona] = useState("");
  const [soloVerificados, setSoloVerificados] = useState(false);
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [reputacionMinima, setReputacionMinima] = useState("");

  const cargarDatos = async () => {
    try {
      setError("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setError("Debes iniciar sesión para buscar trabajadores.");
        return;
      }

      const { data: categoriasData, error: categoriasError } = await supabase
        .from("categorias")
        .select("id, nombre, activa")
        .eq("activa", true)
        .order("nombre", { ascending: true });

      if (categoriasError) {
        console.error("Error al cargar categorías:", categoriasError);
        setError("No se pudieron cargar las categorías.");
        return;
      }

      const categoriasLista = (categoriasData || []) as Categoria[];

      const { data: perfilesTrabajadorData, error: perfilesTrabajadorError } =
        await supabase
          .from("perfiles_trabajador")
          .select(
            `
            id,
            usuario_id,
            descripcion,
            experiencia_anios,
            disponibilidad,
            zona_atencion,
            calificacion_promedio,
            servicios_completados,
            disponible
          `
          )
          .neq("usuario_id", user.id);

      if (perfilesTrabajadorError) {
        console.error(
          "Error al cargar perfiles trabajador:",
          perfilesTrabajadorError
        );
        setError("No se pudieron cargar los trabajadores.");
        return;
      }

      const perfilesTrabajador =
        (perfilesTrabajadorData || []) as PerfilTrabajador[];

      const usuariosIds = perfilesTrabajador.map((item) => item.usuario_id);
      const perfilesTrabajadorIds = perfilesTrabajador.map((item) => item.id);

      let perfilesUsuarios: PerfilUsuario[] = [];

      if (usuariosIds.length > 0) {
        const { data: perfilesUsuariosData, error: perfilesUsuariosError } =
          await supabase
            .from("perfiles")
            .select("id, nombre_completo, verificado, activo, es_trabajador")
            .in("id", usuariosIds)
            .eq("activo", true)
            .eq("es_trabajador", true);

        if (perfilesUsuariosError) {
          console.error("Error al cargar perfiles:", perfilesUsuariosError);
          setError("No se pudieron cargar los datos de los trabajadores.");
          return;
        }

        perfilesUsuarios = (perfilesUsuariosData || []) as PerfilUsuario[];
      }

      let trabajadorCategorias: TrabajadorCategoria[] = [];

      if (perfilesTrabajadorIds.length > 0) {
        const {
          data: trabajadorCategoriasData,
          error: trabajadorCategoriasError,
        } = await supabase
          .from("trabajador_categorias")
          .select("perfil_trabajador_id, categoria_id")
          .in("perfil_trabajador_id", perfilesTrabajadorIds);

        if (trabajadorCategoriasError) {
          console.error(
            "Error al cargar categorías del trabajador:",
            trabajadorCategoriasError
          );
        } else {
          trabajadorCategorias =
            (trabajadorCategoriasData || []) as TrabajadorCategoria[];
        }
      }

      const trabajadoresMapeados: Trabajador[] = perfilesTrabajador
        .map((perfilTrabajador) => {
          const perfilUsuario = perfilesUsuarios.find(
            (perfil) => perfil.id === perfilTrabajador.usuario_id
          );

          if (!perfilUsuario) return null;

          const categoriasTrabajador = trabajadorCategorias
            .filter(
              (item) => item.perfil_trabajador_id === perfilTrabajador.id
            )
            .map((item) => {
              const categoria = categoriasLista.find(
                (cat) => cat.id === item.categoria_id
              );

              return categoria?.nombre;
            })
            .filter((nombre): nombre is string => Boolean(nombre));

          return {
            id: perfilTrabajador.id,
            usuario_id: perfilTrabajador.usuario_id,
            nombre: perfilUsuario.nombre_completo || "Trabajador",
            descripcion:
              perfilTrabajador.descripcion ||
              "Este trabajador aún no agregó una descripción pública.",
            experiencia: perfilTrabajador.experiencia_anios || 0,
            zona:
              perfilTrabajador.zona_atencion ||
              "Zona de atención no definida",
            disponibilidad:
              perfilTrabajador.disponibilidad || "Sin disponibilidad",
            verificado: perfilUsuario.verificado || false,
            reputacion: Number(perfilTrabajador.calificacion_promedio || 0),
            serviciosCompletados:
              perfilTrabajador.servicios_completados || 0,
            disponible: perfilTrabajador.disponible,
            categorias: categoriasTrabajador,
          };
        })
        .filter((trabajador): trabajador is Trabajador => Boolean(trabajador));

      const { data: solicitudesData, error: solicitudesError } = await supabase
        .from("solicitudes_servicio")
        .select("id, titulo, descripcion, zona, estado, fecha_preferida")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });

      let solicitudesLista: SolicitudCliente[] = [];

      if (solicitudesError) {
        console.error("Error al cargar solicitudes:", solicitudesError);
      } else {
        solicitudesLista = (solicitudesData || []) as SolicitudCliente[];
      }

      setUsuarioId(user.id);
      setCategorias(categoriasLista);
      setTrabajadores(trabajadoresMapeados);
      setSolicitudesCliente(solicitudesLista);

      guardarCache({
        usuarioId: user.id,
        categorias: categoriasLista,
        trabajadores: trabajadoresMapeados,
        solicitudesCliente: solicitudesLista,
      });
    } catch (errorGeneral) {
      console.error("Error inesperado al cargar búsqueda:", errorGeneral);
      setError("Ocurrió un error inesperado.");
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      cargarDatos();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const trabajadoresFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const zonaFiltro = zona.trim().toLowerCase();
    const reputacion = reputacionMinima ? Number(reputacionMinima) : null;

    return trabajadores.filter((trabajador) => {
      const textoGeneral = [
        trabajador.nombre,
        trabajador.descripcion,
        trabajador.zona,
        trabajador.disponibilidad,
        ...trabajador.categorias,
      ]
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = !texto || textoGeneral.includes(texto);
      const coincideZona =
        !zonaFiltro || trabajador.zona.toLowerCase().includes(zonaFiltro);

      const categoriaSeleccionada = categorias.find(
        (categoria) => categoria.id === categoriaId
      );

      const coincideCategoria =
        !categoriaId ||
        trabajador.categorias.some(
          (categoria) =>
            categoriaSeleccionada &&
            categoria.toLowerCase() ===
              categoriaSeleccionada.nombre.toLowerCase()
        );

      const coincideVerificado = !soloVerificados || trabajador.verificado;
      const coincideDisponible = !soloDisponibles || trabajador.disponible;
      const coincideReputacion =
        reputacion === null || trabajador.reputacion >= reputacion;

      return (
        coincideBusqueda &&
        coincideZona &&
        coincideCategoria &&
        coincideVerificado &&
        coincideDisponible &&
        coincideReputacion
      );
    });
  }, [
    trabajadores,
    busqueda,
    zona,
    categoriaId,
    soloVerificados,
    soloDisponibles,
    reputacionMinima,
    categorias,
  ]);

  const abrirInvitacion = (trabajador: Trabajador) => {
    setModalInvitar(trabajador);
    setSolicitudSeleccionadaId("");
    setMensajeInvitacion("");
    setMensajeExito("");
    setErrorInvitacion("");
  };

  const cerrarInvitacion = () => {
    setModalInvitar(null);
    setSolicitudSeleccionadaId("");
    setMensajeInvitacion("");
    setMensajeExito("");
    setErrorInvitacion("");
  };

  const enviarInvitacion = async () => {
    if (!modalInvitar || !usuarioId || !solicitudSeleccionadaId) {
      setErrorInvitacion("Selecciona una solicitud para enviar la invitación.");
      return;
    }

    if (modalInvitar.usuario_id === usuarioId) {
      setErrorInvitacion("No puedes enviarte una invitación a ti mismo.");
      return;
    }

    try {
      setEnviandoInvitacion(true);
      setErrorInvitacion("");
      setMensajeExito("");

      const { error: insertarError } = await supabase
        .from("propuestas_servicio")
        .insert({
          solicitud_id: solicitudSeleccionadaId,
          trabajador_id: modalInvitar.usuario_id,
          mensaje:
            mensajeInvitacion.trim() ||
            "Hola, me gustaría invitarte a revisar esta solicitud.",
          estado: "enviada",
        });

      if (insertarError) {
        console.error("Error al enviar invitación:", insertarError);

        if (insertarError.code === "23505") {
          setErrorInvitacion(
            "Ya existe una invitación o propuesta para esta solicitud."
          );
          return;
        }

        setErrorInvitacion("No se pudo enviar la invitación.");
        return;
      }

      await supabase
        .from("solicitudes_servicio")
        .update({
          trabajador_invitado_id: modalInvitar.usuario_id,
        })
        .eq("id", solicitudSeleccionadaId);

      setMensajeExito("Invitación enviada correctamente.");

      window.setTimeout(() => {
        cerrarInvitacion();
      }, 900);
    } catch (errorGeneral) {
      console.error("Error inesperado al enviar invitación:", errorGeneral);
      setErrorInvitacion("Ocurrió un error al enviar la invitación.");
    } finally {
      setEnviandoInvitacion(false);
    }
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
              <Search className="w-4 h-4" />
              Búsqueda local
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
            >
              Buscar trabajadores
            </h1>

            <p className={`mt-2 max-w-3xl ${estilos.textoSecundario}`}>
              Encuentra trabajadores por oficio, zona, reputación y
              disponibilidad. El contacto directo se mostrará cuando el servicio
              sea confirmado.
            </p>
          </div>

          <button
            type="button"
            onClick={cargarDatos}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-bold transition ${
              modoOscuro
                ? "bg-[#111827] text-slate-300 border border-[#334155] hover:bg-[#1e293b]"
                : "bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]"
            }`}
          >
            <Briefcase className="w-5 h-5" />
            Actualizar búsqueda
          </button>
        </div>
      </section>

      <section className={`rounded-[18px] border p-5 sm:p-6 ${estilos.tarjeta}`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-[#0B3C7F]" />
          <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
            Filtros
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar oficio o nombre"
              className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
            />
          </div>

          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className={`rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
          >
            <option value="">Todos los oficios</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>

          <div className="relative">
            <MapPin className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              placeholder="Zona, barrio o sector"
              className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
            />
          </div>

          <select
            value={reputacionMinima}
            onChange={(e) => setReputacionMinima(e.target.value)}
            className={`rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
          >
            <option value="">Cualquier reputación</option>
            <option value="3">Desde 3 estrellas</option>
            <option value="4">Desde 4 estrellas</option>
            <option value="4.5">Desde 4.5 estrellas</option>
          </select>

          <div className="flex flex-col gap-2">
            <label
              className={`flex items-center gap-2 text-sm font-bold ${estilos.textoPrincipal}`}
            >
              <input
                type="checkbox"
                checked={soloVerificados}
                onChange={(e) => setSoloVerificados(e.target.checked)}
              />
              Verificados
            </label>

            <label
              className={`flex items-center gap-2 text-sm font-bold ${estilos.textoPrincipal}`}
            >
              <input
                type="checkbox"
                checked={soloDisponibles}
                onChange={(e) => setSoloDisponibles(e.target.checked)}
              />
              Disponibles
            </label>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      <section
        className={`rounded-[18px] border overflow-hidden ${estilos.tarjeta}`}
      >
        <div className={`px-5 sm:px-6 py-5 border-b ${estilos.borde}`}>
          <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
            Trabajadores encontrados
          </h2>
          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            {`${trabajadoresFiltrados.length} resultado(s) disponibles`}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          {trabajadoresFiltrados.length === 0 ? (
            <div
              className={`rounded-2xl border p-6 text-center ${
                modoOscuro
                  ? "border-[#334155] bg-[#111827]"
                  : "border-gray-100 bg-[#f8fafc]"
              }`}
            >
              <UserRound className="w-10 h-10 mx-auto text-gray-400" />
              <p className={`mt-3 font-extrabold ${estilos.textoPrincipal}`}>
                No se encontraron trabajadores
              </p>
              <p className={`mt-1 text-sm ${estilos.textoSecundario}`}>
                Intenta cambiar los filtros o buscar otro oficio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {trabajadoresFiltrados.map((trabajador) => (
                <article
                  key={trabajador.id}
                  className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
                    modoOscuro
                      ? "bg-[#111827] border-[#334155]"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        modoOscuro ? "bg-[#0f172a]" : "bg-[#e7f0ff]"
                      }`}
                    >
                      <UserRound className="w-6 h-6 text-[#0B3C7F]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3
                            className={`font-extrabold text-lg ${estilos.textoPrincipal}`}
                          >
                            {trabajador.nombre}
                          </h3>

                          <div className="flex flex-wrap gap-2 mt-2">
                            {trabajador.categorias.length > 0 ? (
                              trabajador.categorias.slice(0, 3).map((cat) => (
                                <span
                                  key={cat}
                                  className={`text-xs font-bold rounded-full px-3 py-1 ${
                                    modoOscuro
                                      ? "bg-[#0f172a] text-slate-300"
                                      : "bg-[#eef4ff] text-[#0B3C7F]"
                                  }`}
                                >
                                  {cat}
                                </span>
                              ))
                            ) : (
                              <span
                                className={`text-xs font-bold rounded-full px-3 py-1 ${
                                  modoOscuro
                                    ? "bg-[#0f172a] text-slate-300"
                                    : "bg-[#f1f5f9] text-gray-500"
                                }`}
                              >
                                Sin oficio registrado
                              </span>
                            )}
                          </div>
                        </div>

                        {trabajador.verificado && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                            <BadgeCheck className="w-4 h-4" />
                            Verificado
                          </span>
                        )}
                      </div>

                      <p
                        className={`mt-3 text-sm line-clamp-2 ${estilos.textoSecundario}`}
                      >
                        {trabajador.descripcion}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className={estilos.textoSecundario}>
                            {trabajador.zona}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock3 className="w-4 h-4 text-gray-400" />
                          <span className={estilos.textoSecundario}>
                            {trabajador.disponibilidad}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className={estilos.textoSecundario}>
                            {trabajador.reputacion > 0
                              ? trabajador.reputacion.toFixed(1)
                              : "Sin reseñas"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 mt-5">
                        <button
                          type="button"
                          onClick={() =>
                            setTrabajadorSeleccionado(trabajador)
                          }
                          className={`rounded-2xl border px-4 py-3 font-bold transition ${
                            modoOscuro
                              ? "border-[#334155] text-white hover:bg-[#1e293b]"
                              : "border-gray-200 text-[#0B3C7F] hover:bg-[#f5f9ff]"
                          }`}
                        >
                          Ver perfil público
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirInvitacion(trabajador)}
                          className="rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold hover:bg-[#092f63] transition flex items-center justify-center gap-2"
                        >
                          <Send className="w-5 h-5" />
                          Invitar
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {trabajadorSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl rounded-3xl border p-6 ${
              modoOscuro
                ? "bg-[#0f172a] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  className={`text-2xl font-extrabold ${estilos.textoPrincipal}`}
                >
                  {trabajadorSeleccionado.nombre}
                </h3>
                <p className={`mt-1 text-sm ${estilos.textoSecundario}`}>
                  Perfil público del trabajador
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTrabajadorSeleccionado(null)}
                className={`rounded-full p-2 transition ${
                  modoOscuro
                    ? "hover:bg-[#1e293b] text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <p className={estilos.textoSecundario}>
                {trabajadorSeleccionado.descripcion}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div
                  className={`rounded-2xl p-4 ${
                    modoOscuro ? "bg-[#111827]" : "bg-[#f8fafc]"
                  }`}
                >
                  <strong className={estilos.textoPrincipal}>Zona:</strong>
                  <p className={estilos.textoSecundario}>
                    {trabajadorSeleccionado.zona}
                  </p>
                </div>

                <div
                  className={`rounded-2xl p-4 ${
                    modoOscuro ? "bg-[#111827]" : "bg-[#f8fafc]"
                  }`}
                >
                  <strong className={estilos.textoPrincipal}>
                    Disponibilidad:
                  </strong>
                  <p className={estilos.textoSecundario}>
                    {trabajadorSeleccionado.disponibilidad}
                  </p>
                </div>

                <div
                  className={`rounded-2xl p-4 ${
                    modoOscuro ? "bg-[#111827]" : "bg-[#f8fafc]"
                  }`}
                >
                  <strong className={estilos.textoPrincipal}>
                    Reputación:
                  </strong>
                  <p className={estilos.textoSecundario}>
                    {trabajadorSeleccionado.reputacion > 0
                      ? `${trabajadorSeleccionado.reputacion.toFixed(
                          1
                        )} estrellas`
                      : "Sin reseñas todavía"}
                  </p>
                </div>

                <div
                  className={`rounded-2xl p-4 ${
                    modoOscuro ? "bg-[#111827]" : "bg-[#f8fafc]"
                  }`}
                >
                  <strong className={estilos.textoPrincipal}>
                    Servicios completados:
                  </strong>
                  <p className={estilos.textoSecundario}>
                    {trabajadorSeleccionado.serviciosCompletados}
                  </p>
                </div>
              </div>

              <div>
                <strong className={estilos.textoPrincipal}>Oficios:</strong>
                <div className="flex flex-wrap gap-2 mt-2">
                  {trabajadorSeleccionado.categorias.length > 0 ? (
                    trabajadorSeleccionado.categorias.map((categoria) => (
                      <span
                        key={categoria}
                        className="text-xs font-bold rounded-full px-3 py-1 bg-[#eef4ff] text-[#0B3C7F]"
                      >
                        {categoria}
                      </span>
                    ))
                  ) : (
                    <span className={estilos.textoSecundario}>
                      Sin oficio registrado.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                Los datos de contacto estarán disponibles cuando el servicio sea
                confirmado.
              </div>
            </div>
          </div>
        </div>
      )}

      {modalInvitar && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl rounded-3xl border p-6 ${
              modoOscuro
                ? "bg-[#0f172a] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  className={`text-2xl font-extrabold ${estilos.textoPrincipal}`}
                >
                  Invitar trabajador
                </h3>
                <p className={`mt-1 text-sm ${estilos.textoSecundario}`}>
                  {modalInvitar.nombre}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarInvitacion}
                className={`rounded-full p-2 transition ${
                  modoOscuro
                    ? "hover:bg-[#1e293b] text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {solicitudesCliente.length === 0 ? (
                <div
                  className={`rounded-2xl border p-5 text-center ${
                    modoOscuro
                      ? "border-[#334155] bg-[#111827]"
                      : "border-gray-100 bg-[#f8fafc]"
                  }`}
                >
                  <FileText className="w-10 h-10 mx-auto text-gray-400" />
                  <p
                    className={`mt-3 font-extrabold ${estilos.textoPrincipal}`}
                  >
                    Primero publica una solicitud
                  </p>
                  <p className={`mt-1 text-sm ${estilos.textoSecundario}`}>
                    Para invitar a un trabajador, necesitas tener una solicitud
                    creada.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label
                      className={`block text-sm font-bold mb-2 ${estilos.textoPrincipal}`}
                    >
                      Selecciona una solicitud
                    </label>

                    <select
                      value={solicitudSeleccionadaId}
                      onChange={(e) =>
                        setSolicitudSeleccionadaId(e.target.value)
                      }
                      className={`w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                    >
                      <option value="">Elige una solicitud</option>
                      {solicitudesCliente.map((solicitud) => (
                        <option key={solicitud.id} value={solicitud.id}>
                          {solicitud.titulo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-bold mb-2 ${estilos.textoPrincipal}`}
                    >
                      Mensaje
                    </label>

                    <textarea
                      value={mensajeInvitacion}
                      onChange={(e) => setMensajeInvitacion(e.target.value)}
                      rows={4}
                      placeholder="Escribe un mensaje breve para el trabajador."
                      className={`w-full rounded-2xl border px-4 py-3 outline-none transition resize-none ${estilos.inputBase}`}
                    />
                  </div>

                  {errorInvitacion && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 font-medium">
                        {errorInvitacion}
                      </p>
                    </div>
                  )}

                  {mensajeExito && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-green-700 font-medium">
                        {mensajeExito}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={enviandoInvitacion || Boolean(mensajeExito)}
                    onClick={enviarInvitacion}
                    className="w-full rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    {mensajeExito
                      ? "Invitación enviada"
                      : enviandoInvitacion
                      ? "Enviando invitación..."
                      : "Enviar invitación"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}