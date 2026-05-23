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
  ChevronDown,
  X,
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

type HorarioDia = {
  dia: string;
  activo: boolean;
  horaInicio: string;
  horaFin: string;
};

type DisponibilidadConfig = {
  tipo: "predefinido" | "personalizado";
  seleccion: string[];
  horariosPersonalizados: HorarioDia[];
  textoPersonalizado: string;
};

type CacheTrabajador = {
  usuarioId: string;
  perfilTrabajadorId: string;
  categorias: Categoria[];
  categoriasSeleccionadas: string[];
  descripcion: string;
  experienciaAnios: string;
  disponibilidadConfig: DisponibilidadConfig;
  zonaAtencion: string;
  disponible: boolean;
  calificacionPromedio: number;
  serviciosCompletados: number;
};

const CACHE_KEY = "oficiosya-trabajador-cache-v2";

const OPCIONES_DISPONIBILIDAD_PREDEFINIDAS = [
  { id: "lunes_a_viernes", label: "Lunes a Viernes", horario: "08:00 - 17:00" },
  { id: "lunes_a_viernes_tarde", label: "Lunes a Viernes (tarde)", horario: "14:00 - 20:00" },
  { id: "lunes_a_viernes_noche", label: "Lunes a Viernes (noche)", horario: "18:00 - 22:00" },
  { id: "sabado_domingo", label: "Sábado y Domingo", horario: "09:00 - 18:00" },
  { id: "fines_semana", label: "Fines de semana", horario: "08:00 - 20:00" },
  { id: "todos_los_dias", label: "Todos los días", horario: "08:00 - 20:00" },
  { id: "solo_mananas", label: "Solo mañanas", horario: "08:00 - 12:00" },
  { id: "solo_tardes", label: "Solo tardes", horario: "14:00 - 18:00" },
  { id: "disponible_24h", label: "Disponible 24 horas", horario: "24 horas" },
];

const DIAS_SEMANA = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
];

function formatearDisponibilidadParaBD(config: DisponibilidadConfig): string {
  if (config.tipo === "predefinido") {
    const opcionesSeleccionadas = OPCIONES_DISPONIBILIDAD_PREDEFINIDAS.filter(
      (op) => config.seleccion.includes(op.id)
    );
    if (opcionesSeleccionadas.length === 0) return "";
    return opcionesSeleccionadas.map((op) => `${op.label} (${op.horario})`).join(" | ");
  } else if (config.tipo === "personalizado") {
    if (config.textoPersonalizado.trim()) {
      return config.textoPersonalizado.trim();
    }
    const horariosActivos = config.horariosPersonalizados.filter((h) => h.activo);
    if (horariosActivos.length === 0) return "";
    return horariosActivos
      .map((h) => `${h.dia}: ${h.horaInicio} - ${h.horaFin}`)
      .join(" | ");
  }
  return "";
}

function parsearDisponibilidadDesdeBD(disponibilidadStr: string | null): DisponibilidadConfig {
  const horariosPersonalizadosDefault = DIAS_SEMANA.map((dia) => ({
    dia,
    activo: false,
    horaInicio: "09:00",
    horaFin: "18:00",
  }));

  if (!disponibilidadStr) {
    return {
      tipo: "predefinido",
      seleccion: [],
      horariosPersonalizados: horariosPersonalizadosDefault,
      textoPersonalizado: "",
    };
  }

  const tieneHorariosPorDia = DIAS_SEMANA.some((dia) => disponibilidadStr.includes(dia));
  
  if (tieneHorariosPorDia) {
    const horariosPersonalizados = DIAS_SEMANA.map((dia) => {
      const regex = new RegExp(`${dia}:\\s*(\\d{2}:\\d{2})\\s*-\\s*(\\d{2}:\\d{2})`);
      const match = disponibilidadStr.match(regex);
      return {
        dia,
        activo: !!match,
        horaInicio: match ? match[1] : "09:00",
        horaFin: match ? match[2] : "18:00",
      };
    });
    return {
      tipo: "personalizado",
      seleccion: [],
      horariosPersonalizados,
      textoPersonalizado: "",
    };
  }

  const opcionEncontrada = OPCIONES_DISPONIBILIDAD_PREDEFINIDAS.find((op) =>
    disponibilidadStr.includes(op.label)
  );

  if (opcionEncontrada) {
    return {
      tipo: "predefinido",
      seleccion: [opcionEncontrada.id],
      horariosPersonalizados: horariosPersonalizadosDefault,
      textoPersonalizado: "",
    };
  }

  return {
    tipo: "personalizado",
    seleccion: [],
    horariosPersonalizados: horariosPersonalizadosDefault,
    textoPersonalizado: disponibilidadStr,
  };
}

function obtenerCacheTrabajador(zonaPerfil: string | null): CacheTrabajador {
  const horariosPersonalizadosDefault = DIAS_SEMANA.map((dia) => ({
    dia,
    activo: false,
    horaInicio: "09:00",
    horaFin: "18:00",
  }));

  const base: CacheTrabajador = {
    usuarioId: "",
    perfilTrabajadorId: "",
    categorias: [],
    categoriasSeleccionadas: [],
    descripcion: "",
    experienciaAnios: "0",
    disponibilidadConfig: {
      tipo: "predefinido",
      seleccion: [],
      horariosPersonalizados: horariosPersonalizadosDefault,
      textoPersonalizado: "",
    },
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
      disponibilidadConfig: data.disponibilidadConfig || base.disponibilidadConfig,
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

  const cacheInicial = obtenerCacheTrabajador(perfil.zona);

  const [hydrated, setHydrated] = useState(false);
  const [usuarioId, setUsuarioId] = useState(cacheInicial.usuarioId);
  const [perfilTrabajadorId, setPerfilTrabajadorId] = useState(
    cacheInicial.perfilTrabajadorId
  );

  const [categorias, setCategorias] = useState<Categoria[]>(
    cacheInicial.categorias
  );

  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>(
    cacheInicial.categoriasSeleccionadas
  );

  const [descripcion, setDescripcion] = useState(cacheInicial.descripcion);
  const [experienciaAnios, setExperienciaAnios] = useState(cacheInicial.experienciaAnios);
  const [disponibilidadConfig, setDisponibilidadConfig] = useState<DisponibilidadConfig>(
    cacheInicial.disponibilidadConfig
  );
  const [zonaAtencion, setZonaAtencion] = useState(cacheInicial.zonaAtencion);
  const [disponible, setDisponible] = useState(cacheInicial.disponible);

  const [calificacionPromedio, setCalificacionPromedio] = useState(
    cacheInicial.calificacionPromedio
  );
  const [serviciosCompletados, setServiciosCompletados] = useState(
    cacheInicial.serviciosCompletados
  );

  const [modalHorariosAbierto, setModalHorariosAbierto] = useState(false);
  const [categoriasCargando, setCategoriasCargando] = useState(
    cacheInicial.categorias.length === 0
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const textoDisponibilidadMostrar = formatearDisponibilidadParaBD(disponibilidadConfig);

  // Marcar como hidratado después del montaje inicial
  useEffect(() => {
    setHydrated(true);
  }, []);

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
        const experienciaActualizada = String(perfilTrabajador.experiencia_anios ?? 0);
        const disponibilidadParseada = parsearDisponibilidadDesdeBD(perfilTrabajador.disponibilidad);
        const zonaActualizada = perfilTrabajador.zona_atencion || perfil.zona || "";
        const disponibleActualizado = perfilTrabajador.disponible ?? true;
        const calificacionActualizada = Number(perfilTrabajador.calificacion_promedio || 0);
        const serviciosActualizados = Number(perfilTrabajador.servicios_completados || 0);

        setDescripcion(descripcionActualizada);
        setExperienciaAnios(experienciaActualizada);
        setDisponibilidadConfig(disponibilidadParseada);
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
            disponibilidadConfig: disponibilidadParseada,
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

  const alternarOpcionPredefinida = (opcionId: string) => {
    setDisponibilidadConfig((prev) => {
      const nuevaSeleccion = prev.seleccion.includes(opcionId)
        ? prev.seleccion.filter((id) => id !== opcionId)
        : [...prev.seleccion, opcionId];
      
      return {
        ...prev,
        tipo: "predefinido",
        seleccion: nuevaSeleccion,
      };
    });
  };

  const actualizarHorarioPersonalizado = (
    dia: string,
    campo: "activo" | "horaInicio" | "horaFin",
    valor: boolean | string
  ) => {
    setDisponibilidadConfig((prev) => {
      const nuevosHorarios = prev.horariosPersonalizados.map((h) => {
        if (h.dia === dia) {
          if (campo === "activo") return { ...h, activo: valor as boolean };
          if (campo === "horaInicio") return { ...h, horaInicio: valor as string };
          if (campo === "horaFin") return { ...h, horaFin: valor as string };
        }
        return h;
      });
      
      return {
        ...prev,
        tipo: "personalizado",
        horariosPersonalizados: nuevosHorarios,
        textoPersonalizado: "",
      };
    });
  };

  const setTextoPersonalizado = (texto: string) => {
    setDisponibilidadConfig((prev) => ({
      ...prev,
      tipo: "personalizado",
      seleccion: [],
      textoPersonalizado: texto,
    }));
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

    const disponibilidadTexto = formatearDisponibilidadParaBD(disponibilidadConfig);
    if (!disponibilidadTexto) {
      setError("Selecciona o escribe tu disponibilidad horaria.");
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
            disponibilidad: disponibilidadTexto,
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
        setError(`No se pudieron actualizar los oficios: ${eliminarError.message}`);
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
          disponibilidadConfig,
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

  // Si no está hidratado, mostrar skeletons para evitar errores
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-[18px] border p-5 sm:p-6 animate-pulse bg-gray-100 h-32" />
        <div className="rounded-[18px] border p-5 sm:p-6 animate-pulse bg-gray-100 h-96" />
      </div>
    );
  }

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
              {/* Oficios */}
              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Oficios o habilidades
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                  {categorias.length === 0 && categoriasCargando ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className={`h-[50px] rounded-2xl border animate-pulse ${
                          modoOscuro
                            ? "bg-[#111827] border-[#334155]"
                            : "bg-[#f8fafc] border-gray-200"
                        }`}
                      />
                    ))
                  ) : (
                    categorias.map((categoria) => {
                      const activo = categoriasSeleccionadas.includes(categoria.id);
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
                    })
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Descripción profesional
                </label>
                <div className="relative mt-1">
                  <FileText className="w-5 h-5 text-gray-400 absolute left-4 top-4" />
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ejemplo: Técnico con experiencia en instalaciones eléctricas domiciliarias..."
                    rows={5}
                    className={`w-full resize-none rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>
              </div>

              {/* Años experiencia y Zona */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Disponibilidad */}
              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Disponibilidad horaria
                </label>
                <button
                  type="button"
                  onClick={() => setModalHorariosAbierto(true)}
                  className={`mt-1 w-full rounded-2xl border px-4 py-3 text-left outline-none transition flex items-center justify-between ${
                    modoOscuro
                      ? "bg-[#111827] border-[#334155] text-slate-200"
                      : "bg-[#f8fafc] border-gray-200 text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-gray-400" />
                    {textoDisponibilidadMostrar || "Selecciona tu disponibilidad"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Estado disponible */}
              <div className={`rounded-2xl border p-4 ${modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-[#f8fafc] border-gray-100"}`}>
                <button
                  type="button"
                  onClick={() => setDisponible(!disponible)}
                  className="flex items-center gap-3 w-full text-left"
                >
                  {disponible ? (
                    <ToggleRight className="w-8 h-8 text-[#166534] shrink-0" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400 shrink-0" />
                  )}
                  <div>
                    <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                      {disponible ? "Estoy disponible para recibir trabajos" : "No estoy disponible temporalmente"}
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
                  <p className="text-sm text-green-700 font-medium">{mensaje}</p>
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

            {/* Resumen profesional */}
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
                <div className={`rounded-2xl border p-4 ${modoOscuro ? "bg-[#0f172a] border-[#334155]" : "bg-white border-gray-100"}`}>
                  <div className="flex items-center gap-2 text-[#a36a00]">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-extrabold">{calificacionPromedio.toFixed(1)}</span>
                  </div>
                  <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>Calificación</p>
                </div>

                <div className={`rounded-2xl border p-4 ${modoOscuro ? "bg-[#0f172a] border-[#334155]" : "bg-white border-gray-100"}`}>
                  <p className={`font-extrabold ${estilos.textoPrincipal}`}>{serviciosCompletados}</p>
                  <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>Servicios</p>
                </div>
              </div>

              <div className={`mt-4 rounded-2xl border p-4 ${modoOscuro ? "bg-[#0f172a] border-[#334155]" : "bg-white border-gray-100"}`}>
                <p className={`text-sm font-bold ${estilos.textoPrincipal}`}>Estado actual</p>
                <p className={`text-sm mt-1 font-semibold ${disponible ? "text-[#166534]" : estilos.textoSecundario}`}>
                  {disponible ? "Disponible para recibir solicitudes." : "No disponible temporalmente."}
                </p>
              </div>

              {/* Disponibilidad en resumen */}
              <div className={`mt-4 rounded-2xl border p-4 ${modoOscuro ? "bg-[#0f172a] border-[#334155]" : "bg-white border-gray-100"}`}>
                <p className={`text-sm font-bold ${estilos.textoPrincipal}`}>Disponibilidad</p>
                <p className={`text-sm mt-1 ${estilos.textoSecundario} break-words`}>
                  {textoDisponibilidadMostrar || "No especificada"}
                </p>
              </div>

              <div className={`mt-4 rounded-2xl border p-4 ${modoOscuro ? "bg-[#0f172a] border-[#334155]" : "bg-white border-gray-100"}`}>
                <p className={`text-sm font-bold ${estilos.textoPrincipal}`}>Insignia de verificado</p>
                <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                  La insignia la otorga el administrador luego de revisar la validación de identidad.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Modal de selección de disponibilidad */}
      {modalHorariosAbierto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalHorariosAbierto(false)}
          />

          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:p-5">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  Tu disponibilidad horaria
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Selecciona una opción predefinida o personaliza tus horarios
                </p>
              </div>
              <button
                onClick={() => setModalHorariosAbierto(false)}
                className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5">
              {/* Opciones predefinidas */}
              <div className="mb-6">
                <p className="text-sm font-bold text-slate-900 mb-3">Opciones rápidas</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OPCIONES_DISPONIBILIDAD_PREDEFINIDAS.map((opcion) => (
                    <button
                      key={opcion.id}
                      type="button"
                      onClick={() => alternarOpcionPredefinida(opcion.id)}
                      className={`rounded-2xl border p-3 text-left transition flex items-center justify-between ${
                        disponibilidadConfig.tipo === "predefinido" &&
                        disponibilidadConfig.seleccion.includes(opcion.id)
                          ? "bg-[#0B3C7F] border-[#0B3C7F] text-white"
                          : modoOscuro
                          ? "bg-[#111827] border-[#334155] text-slate-200"
                          : "bg-white border-gray-200 text-gray-700"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-sm">{opcion.label}</p>
                        <p className="text-xs opacity-80">{opcion.horario}</p>
                      </div>
                      {disponibilidadConfig.tipo === "predefinido" &&
                        disponibilidadConfig.seleccion.includes(opcion.id) && (
                          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                        )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">O</span>
                </div>
              </div>

              {/* Horarios personalizados */}
              <div className="mb-6">
                <p className="text-sm font-bold text-slate-900 mb-3">Horarios personalizados por día</p>
                <div className="space-y-3">
                  {DIAS_SEMANA.map((dia) => {
                    const horarioDia = disponibilidadConfig.horariosPersonalizados.find(
                      (h) => h.dia === dia
                    );
                    if (!horarioDia) return null;
                    
                    return (
                      <div key={dia} className={`rounded-2xl border p-3 ${modoOscuro ? "border-[#334155] bg-[#0f172a]" : "border-gray-200 bg-gray-50"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={horarioDia.activo}
                              onChange={(e) =>
                                actualizarHorarioPersonalizado(dia, "activo", e.target.checked)
                              }
                              className="w-4 h-4 rounded border-gray-300 text-[#0B3C7F] focus:ring-[#0B3C7F]"
                            />
                            <span className="font-semibold text-sm text-slate-700">{dia}</span>
                          </label>
                        </div>
                        {horarioDia.activo && (
                          <div className="flex items-center gap-2 ml-6">
                            <input
                              type="time"
                              value={horarioDia.horaInicio}
                              onChange={(e) =>
                                actualizarHorarioPersonalizado(dia, "horaInicio", e.target.value)
                              }
                              className={`rounded-xl border px-3 py-2 text-sm outline-none ${
                                modoOscuro
                                  ? "bg-[#111827] border-[#334155] text-white"
                                  : "bg-white border-gray-200 text-gray-700"
                              }`}
                            />
                            <span className="text-slate-400">a</span>
                            <input
                              type="time"
                              value={horarioDia.horaFin}
                              onChange={(e) =>
                                actualizarHorarioPersonalizado(dia, "horaFin", e.target.value)
                              }
                              className={`rounded-xl border px-3 py-2 text-sm outline-none ${
                                modoOscuro
                                  ? "bg-[#111827] border-[#334155] text-white"
                                  : "bg-white border-gray-200 text-gray-700"
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">O</span>
                </div>
              </div>

              {/* Texto personalizado */}
              <div>
                <p className="text-sm font-bold text-slate-900 mb-2">Escribe tu disponibilidad a medida</p>
                <textarea
                  value={disponibilidadConfig.textoPersonalizado}
                  onChange={(e) => setTextoPersonalizado(e.target.value)}
                  placeholder="Ejemplo: Solo los fines de semana por las mañanas..."
                  rows={3}
                  className={`w-full rounded-2xl border p-3 text-sm outline-none resize-none ${
                    modoOscuro
                      ? "bg-[#111827] border-[#334155] text-white placeholder:text-gray-500"
                      : "bg-white border-gray-200 text-gray-700 placeholder:text-gray-400"
                  }`}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Describe tu disponibilidad con tus propias palabras
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 sm:p-5">
              <button
                onClick={() => setModalHorariosAbierto(false)}
                className="w-full rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-semibold hover:bg-[#092f63] transition"
              >
                Aplicar disponibilidad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}