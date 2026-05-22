"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  MapPin,
  Clock3,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Star,
  BadgeCheck,
  ToggleLeft,
  ToggleRight,
  FileText,
  Hammer,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";

type Categoria = {
  id: string;
  nombre: string;
};

type PerfilTrabajador = {
  id: string;
  usuario_id: string;
  descripcion: string | null;
  experiencia_anios: number | null;
  disponibilidad: string | null;
  zona_atencion: string | null;
  calificacion_promedio: number | null;
  servicios_completados: number | null;
  disponible: boolean;
};

type CacheTrabajador = {
  usuarioId: string;
  perfilTrabajadorId: string;
  categorias: Categoria[];
  categoriasSeleccionadas: string[];
  descripcion: string;
  experienciaAnios: string;
  disponibilidad: string;
  zonaAtencion: string;
  disponible: boolean;
  calificacionPromedio: number;
  serviciosCompletados: number;
};

const CACHE_KEY = "oficiosya-trabajador-cache";

function obtenerCacheTrabajador(zonaPerfil: string | null): CacheTrabajador {
  const base: CacheTrabajador = {
    usuarioId: "",
    perfilTrabajadorId: "",
    categorias: [],
    categoriasSeleccionadas: [],
    descripcion: "",
    experienciaAnios: "0",
    disponibilidad: "",
    zonaAtencion: zonaPerfil || "",
    disponible: true,
    calificacionPromedio: 0,
    serviciosCompletados: 0,
  };

  if (typeof window === "undefined") return base;

  const cache = localStorage.getItem(CACHE_KEY);
  if (!cache) return base;

  try {
    const data = JSON.parse(cache) as Partial<CacheTrabajador>;

    return {
      usuarioId: data.usuarioId || "",
      perfilTrabajadorId: data.perfilTrabajadorId || "",
      categorias: data.categorias || [],
      categoriasSeleccionadas: data.categoriasSeleccionadas || [],
      descripcion: data.descripcion || "",
      experienciaAnios: data.experienciaAnios || "0",
      disponibilidad: data.disponibilidad || "",
      zonaAtencion: data.zonaAtencion || zonaPerfil || "",
      disponible: data.disponible ?? true,
      calificacionPromedio: Number(data.calificacionPromedio || 0),
      serviciosCompletados: Number(data.serviciosCompletados || 0),
    };
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return base;
  }
}

export default function TrabajadorView() {
  const { estilos, modoOscuro, perfil } = usePanelContext();

  const [cacheInicial] = useState(() => obtenerCacheTrabajador(perfil.zona));

  const [usuarioId, setUsuarioId] = useState(cacheInicial.usuarioId);
  const [perfilTrabajadorId, setPerfilTrabajadorId] = useState(
    cacheInicial.perfilTrabajadorId
  );

  const [categorias, setCategorias] = useState<Categoria[]>(
    cacheInicial.categorias
  );

  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<
    string[]
  >(cacheInicial.categoriasSeleccionadas);

  const [descripcion, setDescripcion] = useState(cacheInicial.descripcion);
  const [experienciaAnios, setExperienciaAnios] = useState(
    cacheInicial.experienciaAnios
  );
  const [disponibilidad, setDisponibilidad] = useState(
    cacheInicial.disponibilidad
  );
  const [zonaAtencion, setZonaAtencion] = useState(cacheInicial.zonaAtencion);
  const [disponible, setDisponible] = useState(cacheInicial.disponible);

  const [calificacionPromedio, setCalificacionPromedio] = useState(
    cacheInicial.calificacionPromedio
  );
  const [serviciosCompletados, setServiciosCompletados] = useState(
    cacheInicial.serviciosCompletados
  );

  const [categoriasCargando, setCategoriasCargando] = useState(
    cacheInicial.categorias.length === 0
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let activo = true;

    const cargarDatos = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!activo) return;

        if (authError || !user) {
          setError("No se encontró el usuario autenticado.");
          setCategoriasCargando(false);
          return;
        }

        setUsuarioId(user.id);

        const { data: categoriasData, error: categoriasError } = await supabase
          .from("categorias")
          .select("id, nombre")
          .eq("activa", true)
          .order("nombre", { ascending: true });

        if (!activo) return;

        if (categoriasError) {
          console.error("Error al cargar categorías:", categoriasError);
          setError("No se pudieron cargar los oficios disponibles.");
          setCategoriasCargando(false);
          return;
        }

        const categoriasActualizadas = categoriasData || [];
        setCategorias(categoriasActualizadas);
        setCategoriasCargando(false);

        const {
          data: trabajadorDataInicial,
          error: trabajadorError,
        } = await supabase
          .from("perfiles_trabajador")
          .select(
            "id, usuario_id, descripcion, experiencia_anios, disponibilidad, zona_atencion, calificacion_promedio, servicios_completados, disponible"
          )
          .eq("usuario_id", user.id)
          .maybeSingle();

        if (!activo) return;

        if (trabajadorError) {
          console.error("Error al cargar perfil trabajador:", trabajadorError);
          setError("No se pudo cargar el perfil de trabajador.");
          return;
        }

        let trabajadorData = trabajadorDataInicial;

        if (!trabajadorData) {
          const { data: nuevoPerfil, error: crearError } = await supabase
            .from("perfiles_trabajador")
            .insert({
              usuario_id: user.id,
              descripcion: null,
              experiencia_anios: 0,
              disponibilidad: null,
              zona_atencion: perfil.zona || null,
              calificacion_promedio: 0,
              servicios_completados: 0,
              disponible: true,
            })
            .select(
              "id, usuario_id, descripcion, experiencia_anios, disponibilidad, zona_atencion, calificacion_promedio, servicios_completados, disponible"
            )
            .single();

          if (!activo) return;

          if (crearError || !nuevoPerfil) {
            console.error("Error al crear perfil trabajador:", crearError);
            setError("No se pudo preparar el perfil de trabajador.");
            return;
          }

          trabajadorData = nuevoPerfil;
        }

        const perfilTrabajador = trabajadorData as PerfilTrabajador;
        const perfilTrabajadorIdActualizado = perfilTrabajador.id;

        setPerfilTrabajadorId(perfilTrabajadorIdActualizado);

        const descripcionActualizada = perfilTrabajador.descripcion || "";
        const experienciaActualizada = String(
          perfilTrabajador.experiencia_anios ?? 0
        );
        const disponibilidadActualizada =
          perfilTrabajador.disponibilidad || "";
        const zonaActualizada =
          perfilTrabajador.zona_atencion || perfil.zona || "";
        const disponibleActualizado = perfilTrabajador.disponible ?? true;
        const calificacionActualizada = Number(
          perfilTrabajador.calificacion_promedio || 0
        );
        const serviciosActualizados = Number(
          perfilTrabajador.servicios_completados || 0
        );

        setDescripcion(descripcionActualizada);
        setExperienciaAnios(experienciaActualizada);
        setDisponibilidad(disponibilidadActualizada);
        setZonaAtencion(zonaActualizada);
        setDisponible(disponibleActualizado);
        setCalificacionPromedio(calificacionActualizada);
        setServiciosCompletados(serviciosActualizados);

        const {
          data: categoriasTrabajadorData,
          error: categoriasTrabajadorError,
        } = await supabase
          .from("trabajador_categorias")
          .select("categoria_id")
          .eq("perfil_trabajador_id", perfilTrabajadorIdActualizado);

        if (!activo) return;

        let categoriasSeleccionadasActualizadas = categoriasSeleccionadas;

        if (!categoriasTrabajadorError && categoriasTrabajadorData) {
          categoriasSeleccionadasActualizadas = categoriasTrabajadorData.map(
            (item) => String(item.categoria_id)
          );

          setCategoriasSeleccionadas(categoriasSeleccionadasActualizadas);
        }

        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            usuarioId: user.id,
            perfilTrabajadorId: perfilTrabajadorIdActualizado,
            categorias: categoriasActualizadas,
            categoriasSeleccionadas: categoriasSeleccionadasActualizadas,
            descripcion: descripcionActualizada,
            experienciaAnios: experienciaActualizada,
            disponibilidad: disponibilidadActualizada,
            zonaAtencion: zonaActualizada,
            disponible: disponibleActualizado,
            calificacionPromedio: calificacionActualizada,
            serviciosCompletados: serviciosActualizados,
          })
        );
      } catch (error) {
        console.error("Error inesperado al cargar trabajador:", error);

        if (activo) {
          setError("Ocurrió un error inesperado al cargar el perfil trabajador.");
          setCategoriasCargando(false);
        }
      }
    };

    cargarDatos();

    return () => {
      activo = false;
    };
  }, []);

  const alternarCategoria = (categoriaId: string) => {
    setCategoriasSeleccionadas((prev) => {
      if (prev.includes(categoriaId)) {
        return prev.filter((id) => id !== categoriaId);
      }

      return [...prev, categoriaId];
    });
  };

  const guardarPerfilTrabajador = async () => {
    setError("");
    setMensaje("");

    if (!usuarioId) {
      setError("No se encontró el usuario autenticado.");
      return;
    }

    if (!descripcion.trim()) {
      setError("Ingresa una descripción de tu perfil profesional.");
      return;
    }

    if (!zonaAtencion.trim()) {
      setError("Ingresa tu zona de atención.");
      return;
    }

    if (!disponibilidad.trim()) {
      setError("Ingresa tu disponibilidad.");
      return;
    }

    if (categoriasSeleccionadas.length === 0) {
      setError("Selecciona al menos un oficio o habilidad.");
      return;
    }

    const experienciaNumero = Number(experienciaAnios);

    if (Number.isNaN(experienciaNumero) || experienciaNumero < 0) {
      setError("Los años de experiencia deben ser un número válido.");
      return;
    }

    try {
      setGuardando(true);

      const { data: perfilGuardado, error: trabajadorError } = await supabase
        .from("perfiles_trabajador")
        .upsert(
          {
            usuario_id: usuarioId,
            descripcion: descripcion.trim(),
            experiencia_anios: experienciaNumero,
            disponibilidad: disponibilidad.trim(),
            zona_atencion: zonaAtencion.trim(),
            disponible,
            calificacion_promedio: calificacionPromedio || 0,
            servicios_completados: serviciosCompletados || 0,
          },
          {
            onConflict: "usuario_id",
          }
        )
        .select("id")
        .single();

      if (trabajadorError || !perfilGuardado) {
        console.error("Error al guardar perfil trabajador:", trabajadorError);
        setError(
          `No se pudo guardar el perfil trabajador: ${
            trabajadorError?.message || "intenta nuevamente"
          }`
        );
        return;
      }

      const perfilTrabajadorIdActualizado = perfilGuardado.id;
      setPerfilTrabajadorId(perfilTrabajadorIdActualizado);

      const { error: eliminarError } = await supabase
        .from("trabajador_categorias")
        .delete()
        .eq("perfil_trabajador_id", perfilTrabajadorIdActualizado);

      if (eliminarError) {
        console.error("Error al limpiar oficios:", eliminarError);
        setError(
          `No se pudieron actualizar los oficios: ${eliminarError.message}`
        );
        return;
      }

      const nuevasCategorias = categoriasSeleccionadas.map((categoriaId) => ({
        perfil_trabajador_id: perfilTrabajadorIdActualizado,
        categoria_id: categoriaId,
      }));

      const { error: insertarError } = await supabase
        .from("trabajador_categorias")
        .insert(nuevasCategorias);

      if (insertarError) {
        console.error("Error al guardar oficios:", insertarError);
        setError(`No se pudieron guardar los oficios: ${insertarError.message}`);
        return;
      }

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          usuarioId,
          perfilTrabajadorId: perfilTrabajadorIdActualizado,
          categorias,
          categoriasSeleccionadas,
          descripcion: descripcion.trim(),
          experienciaAnios,
          disponibilidad: disponibilidad.trim(),
          zonaAtencion: zonaAtencion.trim(),
          disponible,
          calificacionPromedio,
          serviciosCompletados,
        })
      );

      setMensaje("Perfil de trabajador actualizado correctamente.");
    } catch (error) {
      console.error("Error inesperado al guardar trabajador:", error);
      setError("Ocurrió un error inesperado al guardar el perfil trabajador.");
    } finally {
      setGuardando(false);
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
              <Briefcase className="w-4 h-4" />
              Perfil profesional
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
            >
              Perfil de trabajador
            </h1>

            <p className={`mt-2 max-w-3xl ${estilos.textoSecundario}`}>
              Completa tus oficios, habilidades, zona de atención,
              disponibilidad y descripción profesional.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {perfil.verificado && (
              <span className="inline-flex items-center gap-2 rounded-2xl bg-[#fff6da] text-[#a36a00] px-4 py-3 font-bold">
                <BadgeCheck className="w-5 h-5" />
                Verificado
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={`rounded-[18px] border overflow-hidden ${estilos.tarjeta}`}>
        <div className={`px-5 sm:px-6 py-5 border-b ${estilos.borde}`}>
          <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
            Información del oficio
          </h2>

          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            Esta información será visible para los clientes cuando busquen
            trabajadores por zona u oficio.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
            <div className="space-y-5">
              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Oficios o habilidades
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                  {categorias.length === 0 &&
                    Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className={`h-[50px] rounded-2xl border animate-pulse ${
                          modoOscuro
                            ? "bg-[#111827] border-[#334155]"
                            : "bg-[#f8fafc] border-gray-200"
                        }`}
                      />
                    ))}

                  {categorias.map((categoria) => {
                    const activo = categoriasSeleccionadas.includes(
                      categoria.id
                    );

                    return (
                      <button
                        type="button"
                        key={categoria.id}
                        disabled={categoriasCargando}
                        onClick={() => alternarCategoria(categoria.id)}
                        className={`rounded-2xl border px-4 py-3 text-left font-bold transition disabled:opacity-60 disabled:cursor-not-allowed ${
                          activo
                            ? "bg-[#0B3C7F] border-[#0B3C7F] text-white"
                            : modoOscuro
                            ? "bg-[#111827] border-[#334155] text-slate-200 hover:bg-[#1e293b]"
                            : "bg-[#f8fafc] border-gray-200 text-gray-700 hover:bg-[#eef5ff]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Hammer className="w-4 h-4" />
                          {categoria.nombre}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Descripción profesional
                </label>

                <div className="relative mt-1">
                  <FileText className="w-5 h-5 text-gray-400 absolute left-4 top-4" />

                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ejemplo: Técnico con experiencia en instalaciones eléctricas domiciliarias, mantenimiento y reparaciones urgentes..."
                    rows={5}
                    className={`w-full resize-none rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                    Años de experiencia
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={experienciaAnios}
                    onChange={(e) => setExperienciaAnios(e.target.value)}
                    className={`mt-1 w-full rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>

                <div>
                  <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                    Zona de atención
                  </label>

                  <div className="relative mt-1">
                    <MapPin className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                    <input
                      type="text"
                      value={zonaAtencion}
                      onChange={(e) => setZonaAtencion(e.target.value)}
                      placeholder="Ambato centro"
                      className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                    Disponibilidad
                  </label>

                  <div className="relative mt-1">
                    <Clock3 className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                    <input
                      type="text"
                      value={disponibilidad}
                      onChange={(e) => setDisponibilidad(e.target.value)}
                      placeholder="Lunes a viernes"
                      className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#111827] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setDisponible(!disponible)}
                  className="flex items-center gap-3"
                >
                  {disponible ? (
                    <ToggleRight className="w-8 h-8 text-[#166534]" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}

                  <div className="text-left">
                    <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                      {disponible
                        ? "Estoy disponible para recibir trabajos"
                        : "No estoy disponible temporalmente"}
                    </p>

                    <p className={`text-sm ${estilos.textoSecundario}`}>
                      Este estado se guardará en tu perfil profesional.
                    </p>
                  </div>
                </button>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {mensaje && (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 font-medium">
                    {mensaje}
                  </p>
                </div>
              )}

              <button
                onClick={guardarPerfilTrabajador}
                disabled={guardando}
                className="w-full sm:w-auto rounded-2xl bg-[#0B3C7F] text-white px-6 py-3 font-bold shadow-[0_10px_22px_rgba(11,60,127,0.18)] hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {guardando ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar perfil trabajador
                  </>
                )}
              </button>
            </div>

            <aside className={`rounded-[22px] border p-5 ${estilos.tarjetaSuave}`}>
              <div className="w-16 h-16 rounded-3xl bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8" />
              </div>

              <h3 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
                Resumen profesional
              </h3>

              <p className={`text-sm leading-6 mt-2 ${estilos.textoSecundario}`}>
                Mantén tu perfil actualizado para que los clientes puedan
                encontrarte según tu oficio, zona de atención y disponibilidad.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div
                  className={`rounded-2xl border p-4 ${
                    modoOscuro
                      ? "bg-[#0f172a] border-[#334155]"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[#a36a00]">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-extrabold">
                      {calificacionPromedio.toFixed(1)}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                    Calificación
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    modoOscuro
                      ? "bg-[#0f172a] border-[#334155]"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                    {serviciosCompletados}
                  </p>
                  <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                    Servicios
                  </p>
                </div>
              </div>

              <div
                className={`mt-5 rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-white border-gray-100"
                }`}
              >
                <p className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Estado actual
                </p>

                <p
                  className={`text-sm mt-1 font-semibold ${
                    disponible ? "text-[#166534]" : estilos.textoSecundario
                  }`}
                >
                  {disponible
                    ? "Disponible para recibir solicitudes."
                    : "No disponible temporalmente."}
                </p>
              </div>

              <div
                className={`mt-4 rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-white border-gray-100"
                }`}
              >
                <p className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Insignia de verificado
                </p>

                <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                  La insignia la otorga el administrador luego de revisar la
                  validación de identidad.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}