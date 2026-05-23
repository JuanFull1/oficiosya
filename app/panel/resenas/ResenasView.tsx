"use client";

import { useEffect, useMemo, useState, type ReactNode, useCallback } from "react";
import {
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle2,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Star,
  UserRound,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";
import Image from "next/image";

type TabResenas = "pendientes" | "recibidas" | "realizadas";

type PerfilInfo = {
  id: string;
  nombre_completo: string | null;
  foto_url: string | null;
  zona: string | null;
  verificado: boolean | null;
};

type SolicitudInfo = {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  zona: string | null;
  presupuesto: number | null;
  fecha_preferida: string | null;
};

type ServicioInfo = {
  id: string;
  solicitud_id: string;
  cliente_id: string;
  trabajador_id: string;
  estado: string;
  finalizado_en: string | null;
  creado_en: string;
  solicitud: SolicitudInfo | null;
  cliente: PerfilInfo | null;
  trabajador: PerfilInfo | null;
};

type ResenaInfo = {
  id: string;
  servicio_id: string;
  autor_id: string;
  usuario_calificado_id: string;
  puntuacion: number;
  comentario: string | null;
  creado_en: string;
  autor?: PerfilInfo | null;
  usuario_calificado?: PerfilInfo | null;
  servicio?: ServicioInfo | null;
};

type FormularioResena = {
  puntuacion: number;
  comentario: string;
};

export default function ResenasView() {
  const { estilos, modoOscuro } = usePanelContext();

  const [usuarioId, setUsuarioId] = useState("");
  const [tab, setTab] = useState<TabResenas>("pendientes");
  const [servicios, setServicios] = useState<ServicioInfo[]>([]);
  const [resenasRecibidas, setResenasRecibidas] = useState<ResenaInfo[]>([]);
  const [resenasRealizadas, setResenasRealizadas] = useState<ResenaInfo[]>([]);
  const [formularios, setFormularios] = useState<Record<string, FormularioResena>>({});
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const actualizarPromedioTrabajador = async (trabajadorId: string) => {
    try {
      const { data: resenas, error: fetchError } = await supabase
        .from("resenas")
        .select("puntuacion")
        .eq("usuario_calificado_id", trabajadorId);

      if (fetchError) return;

      let nuevoPromedio = 0;
      const cantidadResenas = resenas?.length || 0;
      
      if (resenas && cantidadResenas > 0) {
        const suma = resenas.reduce((acc, r) => acc + (r.puntuacion || 0), 0);
        nuevoPromedio = Number((suma / cantidadResenas).toFixed(2));
      }

      await supabase
        .from("perfiles_trabajador")
        .update({
          calificacion_promedio: nuevoPromedio,
          servicios_completados: cantidadResenas,
          actualizado_en: new Date().toISOString(),
        })
        .eq("usuario_id", trabajadorId);
    } catch (error) {
      console.error("Error actualizando promedio:", error);
    }
  };

  const cargarResenas = useCallback(async () => {
    try {
      setActualizando(true);
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

      setUsuarioId(user.id);

      const { data: serviciosData, error: serviciosError } = await supabase
        .from("servicios")
        .select("id, solicitud_id, cliente_id, trabajador_id, estado, finalizado_en, creado_en")
        .eq("estado", "finalizado")
        .or(`cliente_id.eq.${user.id},trabajador_id.eq.${user.id}`)
        .order("finalizado_en", { ascending: false });

      if (serviciosError) {
        setError(`Error al cargar servicios: ${serviciosError.message}`);
        return;
      }

      if (!serviciosData || serviciosData.length === 0) {
        setServicios([]);
        setResenasRecibidas([]);
        setResenasRealizadas([]);
        setMensaje("No tienes servicios finalizados.");
        return;
      }

      const solicitudIds = serviciosData.map(s => s.solicitud_id).filter((id): id is string => Boolean(id));
      const solicitudesMap = new Map();
      
      if (solicitudIds.length > 0) {
        const { data: solicitudesData } = await supabase
          .from("solicitudes_servicio")
          .select("id, titulo, descripcion, zona, presupuesto, fecha_preferida")
          .in("id", solicitudIds);
        
        solicitudesData?.forEach(s => solicitudesMap.set(s.id, s));
      }

      const userIds = new Set<string>();
      serviciosData.forEach(s => {
        if (s.cliente_id) userIds.add(s.cliente_id);
        if (s.trabajador_id) userIds.add(s.trabajador_id);
      });

      const perfilesMap = new Map();
      if (userIds.size > 0) {
        const { data: perfilesData } = await supabase
          .from("perfiles")
          .select("id, nombre_completo, foto_url, zona, verificado")
          .in("id", Array.from(userIds));
        
        perfilesData?.forEach(p => perfilesMap.set(p.id, p));
      }

      const serviciosCompletos: ServicioInfo[] = serviciosData.map(servicio => ({
        ...servicio,
        solicitud: solicitudesMap.get(servicio.solicitud_id) || null,
        cliente: perfilesMap.get(servicio.cliente_id) || null,
        trabajador: perfilesMap.get(servicio.trabajador_id) || null
      }));

      setServicios(serviciosCompletos);

      const { data: recibidasData } = await supabase
        .from("resenas")
        .select("id, servicio_id, autor_id, usuario_calificado_id, puntuacion, comentario, creado_en")
        .eq("usuario_calificado_id", user.id)
        .order("creado_en", { ascending: false });

      let recibidasConAutor: ResenaInfo[] = [];
      if (recibidasData && recibidasData.length > 0) {
        const autorIds = recibidasData.map(r => r.autor_id).filter((id): id is string => Boolean(id));
        
        if (autorIds.length > 0) {
          const { data: autoresData } = await supabase
            .from("perfiles")
            .select("id, nombre_completo, foto_url, zona, verificado")
            .in("id", autorIds);
          
          const autoresMap = new Map();
          autoresData?.forEach(a => autoresMap.set(a.id, a));
          
          recibidasConAutor = recibidasData.map(resena => ({
            ...resena,
            autor: autoresMap.get(resena.autor_id) || null
          })) as ResenaInfo[];
        }
      }
      setResenasRecibidas(recibidasConAutor);

      const { data: realizadasData } = await supabase
        .from("resenas")
        .select("id, servicio_id, autor_id, usuario_calificado_id, puntuacion, comentario, creado_en")
        .eq("autor_id", user.id)
        .order("creado_en", { ascending: false });

      let realizadasConCalificado: ResenaInfo[] = [];
      if (realizadasData && realizadasData.length > 0) {
        const calificadoIds = realizadasData.map(r => r.usuario_calificado_id).filter((id): id is string => Boolean(id));
        
        if (calificadoIds.length > 0) {
          const { data: calificadosData } = await supabase
            .from("perfiles")
            .select("id, nombre_completo, foto_url, zona, verificado")
            .in("id", calificadoIds);
          
          const calificadosMap = new Map();
          calificadosData?.forEach(c => calificadosMap.set(c.id, c));
          
          realizadasConCalificado = realizadasData.map(resena => ({
            ...resena,
            usuario_calificado: calificadosMap.get(resena.usuario_calificado_id) || null
          })) as ResenaInfo[];
        }

        const serviciosIds = realizadasConCalificado.map(r => r.servicio_id).filter((id): id is string => Boolean(id));
        if (serviciosIds.length > 0) {
          const { data: serviciosResenasData } = await supabase
            .from("servicios")
            .select("id, solicitud_id, cliente_id, trabajador_id, estado, finalizado_en, creado_en")
            .in("id", serviciosIds);

          if (serviciosResenasData) {
            const solicitudIdsResenas = serviciosResenasData.map(s => s.solicitud_id).filter((id): id is string => Boolean(id));
            const solicitudesResenasMap = new Map();
            
            if (solicitudIdsResenas.length > 0) {
              const { data: solicitudesResenasData } = await supabase
                .from("solicitudes_servicio")
                .select("id, titulo, descripcion, zona, presupuesto, fecha_preferida")
                .in("id", solicitudIdsResenas);
              
              solicitudesResenasData?.forEach(s => solicitudesResenasMap.set(s.id, s));
            }
            
            const serviciosResenasMap = new Map();
            serviciosResenasData.forEach(servicio => {
              serviciosResenasMap.set(servicio.id, {
                ...servicio,
                solicitud: solicitudesResenasMap.get(servicio.solicitud_id) || null
              });
            });
            
            realizadasConCalificado.forEach(resena => {
              resena.servicio = serviciosResenasMap.get(resena.servicio_id) || null;
            });
          }
        }
      }
      setResenasRealizadas(realizadasConCalificado);

    } catch (error) {
      console.error("Error cargando reseñas:", error);
      setError("No se pudieron cargar los datos.");
    } finally {
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    cargarResenas();
  }, [cargarResenas]);

  const serviciosPendientes = useMemo(() => {
    const serviciosYaResenados = new Set(
      resenasRealizadas.map((resena) => resena.servicio_id)
    );
    return servicios.filter((servicio) => !serviciosYaResenados.has(servicio.id));
  }, [servicios, resenasRealizadas]);

  const promedioRecibido = useMemo(() => {
    if (resenasRecibidas.length === 0) return 0;
    const total = resenasRecibidas.reduce(
      (suma, resena) => suma + Number(resena.puntuacion || 0),
      0
    );
    return Number((total / resenasRecibidas.length).toFixed(1));
  }, [resenasRecibidas]);

  const porcentajePositivas = useMemo(() => {
    if (resenasRecibidas.length === 0) return 0;
    const positivas = resenasRecibidas.filter(
      (resena) => Number(resena.puntuacion) >= 4
    ).length;
    return Math.round((positivas / resenasRecibidas.length) * 100);
  }, [resenasRecibidas]);

  const serviciosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return serviciosPendientes;

    return serviciosPendientes.filter((servicio) => {
      const titulo = servicio.solicitud?.titulo?.toLowerCase() || "";
      const descripcion = servicio.solicitud?.descripcion?.toLowerCase() || "";
      const zona = servicio.solicitud?.zona?.toLowerCase() || "";
      const cliente = servicio.cliente?.nombre_completo?.toLowerCase() || "";
      const trabajador = servicio.trabajador?.nombre_completo?.toLowerCase() || "";

      return (
        titulo.includes(texto) ||
        descripcion.includes(texto) ||
        zona.includes(texto) ||
        cliente.includes(texto) ||
        trabajador.includes(texto)
      );
    });
  }, [busqueda, serviciosPendientes]);

  const recibidasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return resenasRecibidas;

    return resenasRecibidas.filter((resena) => {
      const autor = resena.autor?.nombre_completo?.toLowerCase() || "";
      const comentario = resena.comentario?.toLowerCase() || "";
      const titulo = resena.servicio?.solicitud?.titulo?.toLowerCase() || "";
      return autor.includes(texto) || comentario.includes(texto) || titulo.includes(texto);
    });
  }, [busqueda, resenasRecibidas]);

  const realizadasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return resenasRealizadas;

    return resenasRealizadas.filter((resena) => {
      const usuarioCalificado = resena.usuario_calificado?.nombre_completo?.toLowerCase() || "";
      const titulo = resena.servicio?.solicitud?.titulo?.toLowerCase() || "";
      const comentario = resena.comentario?.toLowerCase() || "";
      return usuarioCalificado.includes(texto) || titulo.includes(texto) || comentario.includes(texto);
    });
  }, [busqueda, resenasRealizadas]);

  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return "Sin fecha";
    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return "Sin fecha";
    return valor.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatearPresupuesto = (presupuesto: number | null | undefined) => {
    if (!presupuesto || presupuesto === 0) return "No especificado";
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(presupuesto);
  };

  const obtenerPersonaAResenar = (servicio: ServicioInfo) => {
    if (servicio.cliente_id === usuarioId) return servicio.trabajador;
    return servicio.cliente;
  };

  const obtenerDescripcionServicio = (servicio: ServicioInfo): string => {
    const descripcion = servicio.solicitud?.descripcion;
    const titulo = servicio.solicitud?.titulo;
    const zona = servicio.solicitud?.zona;
    
    if (descripcion && descripcion.trim()) return descripcion;
    if (titulo && titulo.trim()) return titulo;
    if (zona && zona.trim()) return `Servicio en ${zona}`;
    return "Servicio finalizado";
  };

  const cambiarPuntuacion = (servicioId: string, puntuacion: number) => {
    setFormularios((prev) => ({
      ...prev,
      [servicioId]: {
        puntuacion,
        comentario: prev[servicioId]?.comentario || "",
      },
    }));
  };

  const cambiarComentario = (servicioId: string, comentario: string) => {
    setFormularios((prev) => ({
      ...prev,
      [servicioId]: {
        puntuacion: prev[servicioId]?.puntuacion || 0,
        comentario,
      },
    }));
  };

  const guardarResena = async (servicio: ServicioInfo) => {
    const formulario = formularios[servicio.id];

    setError("");
    setMensaje("");

    if (!usuarioId) {
      setError("No se encontró el usuario autenticado.");
      return;
    }

    if (!formulario || formulario.puntuacion < 1 || formulario.puntuacion > 5) {
      setError("Selecciona una calificación válida (1-5 estrellas) antes de publicar.");
      return;
    }

    const esCliente = servicio.cliente_id === usuarioId;
    const usuarioCalificadoId = esCliente ? servicio.trabajador_id : servicio.cliente_id;

    if (!usuarioCalificadoId) {
      setError("No se pudo identificar a la persona a calificar.");
      return;
    }

    try {
      setGuardandoId(servicio.id);

      const { data: resenasExistentes, error: errorVerificacion } = await supabase
        .from("resenas")
        .select("id")
        .eq("servicio_id", servicio.id)
        .eq("autor_id", usuarioId);

      if (errorVerificacion) {
        setError(`Error al verificar: ${errorVerificacion.message}`);
        setGuardandoId(null);
        return;
      }

      if (resenasExistentes && resenasExistentes.length > 0) {
        setError("Ya publicaste una reseña para este servicio.");
        setGuardandoId(null);
        return;
      }

      const { error: insertError } = await supabase.from("resenas").insert({
        servicio_id: servicio.id,
        autor_id: usuarioId,
        usuario_calificado_id: usuarioCalificadoId,
        puntuacion: formulario.puntuacion,
        comentario: formulario.comentario.trim() || null,
      });

      if (insertError) {
        setError(`No se pudo publicar: ${insertError.message}`);
        setGuardandoId(null);
        return;
      }

      await actualizarPromedioTrabajador(usuarioCalificadoId);

      setMensaje("¡Reseña publicada correctamente!");

      setFormularios((prev) => {
        const copia = { ...prev };
        delete copia[servicio.id];
        return copia;
      });

      await cargarResenas();
      setTab("realizadas");
    } catch (error) {
      console.error("Error al guardar reseña:", error);
      setError("Ocurrió un error inesperado al publicar la reseña.");
    } finally {
      setGuardandoId(null);
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
              <Star className="w-4 h-4" />
              Gestión de reseñas
            </div>

            <h1 className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}>
              Reseñas
            </h1>

            <p className={`mt-2 ${estilos.textoSecundario}`}>
              Califica servicios finalizados y revisa las opiniones recibidas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <TabButton
              activo={tab === "pendientes"}
              texto="Pendientes"
              cantidad={serviciosPendientes.length}
              onClick={() => setTab("pendientes")}
              modoOscuro={modoOscuro}
            />

            <TabButton
              activo={tab === "recibidas"}
              texto="Recibidas"
              cantidad={resenasRecibidas.length}
              onClick={() => setTab("recibidas")}
              modoOscuro={modoOscuro}
            />

            <TabButton
              activo={tab === "realizadas"}
              texto="Realizadas"
              cantidad={resenasRealizadas.length}
              onClick={() => setTab("realizadas")}
              modoOscuro={modoOscuro}
            />

            <button
              onClick={cargarResenas}
              disabled={actualizando}
              className={`px-4 py-3 rounded-2xl font-bold transition flex items-center justify-center gap-2 ${
                modoOscuro
                  ? "bg-[#111827] text-white border border-[#334155]"
                  : "bg-[#f3f4f6] text-gray-700"
              } disabled:opacity-60`}
            >
              <RefreshCw className={`w-4 h-4 ${actualizando ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ResumenCard
          icon={<Star className="w-5 h-5" />}
          titulo="Promedio"
          valor={promedioRecibido > 0 ? promedioRecibido.toFixed(1) : "0.0"}
          detalle="Calificación recibida"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />

        <ResumenCard
          icon={<MessageSquare className="w-5 h-5" />}
          titulo="Recibidas"
          valor={resenasRecibidas.length.toString()}
          detalle="Opiniones sobre ti"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />

        <ResumenCard
          icon={<Send className="w-5 h-5" />}
          titulo="Realizadas"
          valor={resenasRealizadas.length.toString()}
          detalle="Opiniones publicadas"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />

        <ResumenCard
          icon={<Award className="w-5 h-5" />}
          titulo="Positivas"
          valor={`${porcentajePositivas}%`}
          detalle="Con 4 o 5 estrellas"
          estilos={estilos}
          modoOscuro={modoOscuro}
        />
      </div>

      {(error || mensaje) && (
        <div
          className={`rounded-2xl border px-4 py-3 flex items-start gap-3 ${
            error
              ? "border-red-200 bg-red-50"
              : modoOscuro
              ? "border-green-900 bg-green-950"
              : "border-green-200 bg-green-50"
          }`}
        >
          {error ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          )}

          <p
            className={`text-sm font-medium ${
              error ? "text-red-700" : modoOscuro ? "text-green-300" : "text-green-700"
            }`}
          >
            {error || mensaje}
          </p>
        </div>
      )}

      <section className={`rounded-[18px] border p-4 ${estilos.tarjeta}`}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por servicio, usuario, zona o comentario..."
            className={`w-full rounded-2xl border py-3 pl-10 pr-4 outline-none ${
              modoOscuro
                ? "bg-[#111827] border-[#334155] text-white placeholder:text-gray-500"
                : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-400"
            }`}
          />
        </div>
      </section>

      {tab === "pendientes" ? (
        <ListaPendientes
          servicios={serviciosFiltrados}
          usuarioId={usuarioId}
          formularios={formularios}
          guardandoId={guardandoId}
          estilos={estilos}
          modoOscuro={modoOscuro}
          formatearFecha={formatearFecha}
          formatearPresupuesto={formatearPresupuesto}
          obtenerPersonaAResenar={obtenerPersonaAResenar}
          obtenerDescripcionServicio={obtenerDescripcionServicio}
          cambiarPuntuacion={cambiarPuntuacion}
          cambiarComentario={cambiarComentario}
          guardarResena={guardarResena}
        />
      ) : tab === "recibidas" ? (
        <ListaResenas
          resenas={recibidasFiltradas}
          tipo="recibidas"
          estilos={estilos}
          modoOscuro={modoOscuro}
          formatearFecha={formatearFecha}
          formatearPresupuesto={formatearPresupuesto}
        />
      ) : (
        <ListaResenas
          resenas={realizadasFiltradas}
          tipo="realizadas"
          estilos={estilos}
          modoOscuro={modoOscuro}
          formatearFecha={formatearFecha}
          formatearPresupuesto={formatearPresupuesto}
        />
      )}
    </div>
  );
}

function TabButton({
  activo,
  texto,
  cantidad,
  onClick,
  modoOscuro,
}: {
  activo: boolean;
  texto: string;
  cantidad: number;
  onClick: () => void;
  modoOscuro: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-2xl font-bold transition ${
        activo
          ? "bg-[#0B3C7F] text-white"
          : modoOscuro
          ? "bg-[#111827] text-white border border-[#334155]"
          : "bg-[#f3f4f6] text-gray-700"
      }`}
    >
      {texto} <span className="opacity-80">({cantidad})</span>
    </button>
  );
}

function ResumenCard({
  icon,
  titulo,
  valor,
  detalle,
  estilos,
  modoOscuro,
}: {
  icon: ReactNode;
  titulo: string;
  valor: string;
  detalle: string;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border p-5 ${
        modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-[#0B3C7F] ${
            modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
          }`}
        >
          {icon}
        </div>

        <p className={`text-2xl font-extrabold ${estilos.textoPrincipal}`}>{valor}</p>
      </div>

      <h3 className={`mt-4 font-extrabold ${estilos.textoPrincipal}`}>{titulo}</h3>
      <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>{detalle}</p>
    </div>
  );
}

function ListaPendientes({
  servicios,
  usuarioId,
  formularios,
  guardandoId,
  estilos,
  modoOscuro,
  formatearFecha,
  formatearPresupuesto,
  obtenerPersonaAResenar,
  obtenerDescripcionServicio,
  cambiarPuntuacion,
  cambiarComentario,
  guardarResena,
}: {
  servicios: ServicioInfo[];
  usuarioId: string;
  formularios: Record<string, FormularioResena>;
  guardandoId: string | null;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
  formatearFecha: (fecha: string | null) => string;
  formatearPresupuesto: (presupuesto: number | null | undefined) => string;
  obtenerPersonaAResenar: (servicio: ServicioInfo) => PerfilInfo | null;
  obtenerDescripcionServicio: (servicio: ServicioInfo) => string;
  cambiarPuntuacion: (servicioId: string, puntuacion: number) => void;
  cambiarComentario: (servicioId: string, comentario: string) => void;
  guardarResena: (servicio: ServicioInfo) => void;
}) {
  if (servicios.length === 0) {
    return (
      <Vacio
        texto="No tienes servicios finalizados pendientes de reseña."
        modoOscuro={modoOscuro}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {servicios.map((servicio) => {
        const persona = obtenerPersonaAResenar(servicio);
        const formulario = formularios[servicio.id] || {
          puntuacion: 0,
          comentario: "",
        };
        const descripcion = obtenerDescripcionServicio(servicio);
        const esCliente = servicio.cliente_id === usuarioId;

        return (
          <div
            key={servicio.id}
            className={`rounded-[22px] border p-5 ${
              modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-[#0B3C7F] mb-3 ${
                    modoOscuro ? "bg-[#172554]" : "bg-[#e7f0ff]"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Servicio finalizado
                </div>

                <h3 className={`text-lg font-extrabold ${estilos.textoPrincipal}`}>
                  {servicio.solicitud?.titulo || "Servicio finalizado"}
                </h3>

                <p className={`text-sm mt-2 line-clamp-2 ${estilos.textoSecundario}`}>
                  {descripcion}
                </p>

                {servicio.solicitud?.zona && (
                  <div className="flex items-center gap-1 mt-2">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <p className={`text-xs ${estilos.textoSecundario}`}>
                      {servicio.solicitud.zona}
                    </p>
                  </div>
                )}
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                  modoOscuro ? "bg-green-950 text-green-300" : "bg-green-100 text-green-700"
                }`}
              >
                finalizado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <InfoItem
                icon={<CalendarDays className="w-4 h-4" />}
                label="Fecha finalización"
                value={formatearFecha(servicio.finalizado_en || servicio.creado_en)}
                estilos={estilos}
              />

              <InfoItem
    icon={<UserRound className="w-4 h-4" />}
    label="Estás calificando a"
    value={esCliente ? "Trabajador del servicio" : "Cliente del servicio"}
    estilos={estilos}
  />

              <InfoItem
                icon={<DollarSign className="w-4 h-4" />}
                label="Presupuesto"
                value={formatearPresupuesto(servicio.solicitud?.presupuesto)}
                estilos={estilos}
              />
            </div>
{/* Persona a calificar */}
<div
  className={`mt-4 rounded-2xl border p-4 ${
    modoOscuro ? "border-[#334155] bg-[#0f172a]" : "border-gray-100 bg-gray-50"
  }`}
>
  <div className="flex items-center gap-3">
    <Avatar perfil={persona} />
    <div className="min-w-0 flex-1">
      <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
        {esCliente ? "Trabajador que realizó el servicio" : "Cliente que contrató el servicio"}
      </p>
      <p className={`font-extrabold truncate ${estilos.textoPrincipal}`}>
        {persona?.nombre_completo || "Usuario"}
      </p>
      <p className={`text-xs truncate ${estilos.textoSecundario}`}>
        {persona?.zona || "Zona no definida"}
      </p>
    </div>
    {persona?.verificado && (
      <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
    )}
  </div>
</div>

            <div className="mt-5">
              <p className={`text-sm font-bold ${estilos.textoPrincipal}`}>
  ¿Cómo fue tu experiencia con {esCliente ? "este trabajador" : "este cliente"}?
</p>

              <div className="flex items-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((estrella) => (
                  <button
                    key={estrella}
                    type="button"
                    onClick={() => cambiarPuntuacion(servicio.id, estrella)}
                    className={`rounded-xl p-1 transition ${
                      modoOscuro ? "hover:bg-[#172554]" : "hover:bg-[#e7f0ff]"
                    }`}
                  >
                    <Star
                      className={`w-7 h-7 ${
                        estrella <= formulario.puntuacion
                          ? "fill-[#0B3C7F] text-[#0B3C7F]"
                          : modoOscuro
                          ? "text-gray-600"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={formulario.comentario}
                onChange={(e) => cambiarComentario(servicio.id, e.target.value)}
                rows={3}
                placeholder="Cuéntanos sobre tu experiencia. ¿Qué te pareció el servicio?"
                className={`mt-3 w-full resize-none rounded-2xl border p-3 outline-none ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155] text-white placeholder:text-gray-500"
                    : "bg-white border-gray-200 text-gray-800 placeholder:text-gray-400"
                }`}
              />

              <button
                onClick={() => guardarResena(servicio)}
                disabled={guardandoId === servicio.id}
                className="mt-3 rounded-2xl px-4 py-3 font-bold bg-[#0B3C7F] hover:bg-[#082f63] text-white transition flex items-center justify-center gap-2 w-full disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                {guardandoId === servicio.id ? "Publicando..." : "Publicar reseña"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListaResenas({
  resenas,
  tipo,
  estilos,
  modoOscuro,
  formatearFecha,
  formatearPresupuesto,
}: {
  resenas: ResenaInfo[];
  tipo: "recibidas" | "realizadas";
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
  formatearFecha: (fecha: string | null) => string;
  formatearPresupuesto: (presupuesto: number | null | undefined) => string;
}) {
  if (resenas.length === 0) {
    return (
      <Vacio
        texto={
          tipo === "recibidas"
            ? "Aún no tienes reseñas recibidas."
            : "Aún no has publicado reseñas."
        }
        modoOscuro={modoOscuro}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {resenas.map((resena) => {
        const perfil = tipo === "recibidas" ? resena.autor : resena.usuario_calificado;
        const esRecibida = tipo === "recibidas";

        return (
          <div
            key={resena.id}
            className={`rounded-[22px] border p-5 ${
              modoOscuro ? "bg-[#111827] border-[#334155]" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar perfil={perfil || null} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                    {esRecibida ? "Te calificó" : "Calificaste a"}
                  </p>
                  <h3 className={`text-lg font-extrabold truncate ${estilos.textoPrincipal}`}>
                    {perfil?.nombre_completo || "Usuario"}
                  </h3>
                  {perfil?.zona && (
                    <p className={`text-xs truncate ${estilos.textoSecundario}`}>
                      {perfil.zona}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                  modoOscuro ? "bg-blue-950 text-blue-300" : "bg-blue-100 text-blue-700"
                }`}
              >
                {formatearFecha(resena.creado_en)}
              </span>
            </div>

            {resena.servicio?.solicitud && (
              <div className={`mt-4 rounded-2xl p-3 ${
                modoOscuro ? "bg-[#0f172a]" : "bg-gray-50"
              }`}>
                <p className={`text-xs font-bold mb-1 ${estilos.textoSecundario}`}>
                  Servicio
                </p>
                <p className={`text-sm font-semibold ${estilos.textoPrincipal}`}>
                  {resena.servicio.solicitud.titulo || "Servicio finalizado"}
                </p>
                {resena.servicio.solicitud.descripcion && (
                  <p className={`text-xs mt-1 line-clamp-2 ${estilos.textoSecundario}`}>
                    {resena.servicio.solicitud.descripcion}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {resena.servicio.solicitud.zona && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className={`text-xs ${estilos.textoSecundario}`}>
                        {resena.servicio.solicitud.zona}
                      </span>
                    </div>
                  )}
                  {resena.servicio.solicitud.presupuesto && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className={`text-xs ${estilos.textoSecundario}`}>
                        {formatearPresupuesto(resena.servicio.solicitud.presupuesto)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Estrellas valor={resena.puntuacion} modoOscuro={modoOscuro} />
              <span className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                {resena.puntuacion}/5
              </span>
            </div>

            <p
              className={`mt-4 rounded-2xl p-4 text-sm leading-relaxed ${
                modoOscuro ? "bg-[#0f172a] text-gray-300" : "bg-gray-50 text-gray-600"
              }`}
            >
              {resena.comentario || "Sin comentario adicional."}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Avatar({ perfil }: { perfil: PerfilInfo | null }) {
  if (perfil?.foto_url) {
    return (
      <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-gray-200">
        <Image
          src={perfil.foto_url}
          alt={perfil.nombre_completo || "Usuario"}
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-2xl bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center">
      <UserRound className="w-6 h-6" />
    </div>
  );
}

function Estrellas({
  valor,
  modoOscuro,
}: {
  valor: number;
  modoOscuro: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((estrella) => (
        <Star
          key={estrella}
          className={`w-4 h-4 ${
            estrella <= valor
              ? "fill-[#0B3C7F] text-[#0B3C7F]"
              : modoOscuro
              ? "text-gray-600"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  estilos,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  estilos: { textoPrincipal: string; textoSecundario: string };
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-[#0B3C7F] mt-0.5">{icon}</div>
      <div>
        <p className={`text-xs font-bold ${estilos.textoSecundario}`}>{label}</p>
        <p className={`text-sm font-semibold ${estilos.textoPrincipal}`}>{value}</p>
      </div>
    </div>
  );
}

function Vacio({
  texto,
  modoOscuro,
}: {
  texto: string;
  modoOscuro: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border border-dashed p-8 text-center ${
        modoOscuro
          ? "bg-[#111827] border-[#334155] text-gray-300"
          : "bg-white border-gray-300 text-gray-600"
      }`}
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center mb-4">
        <MessageSquare className="w-7 h-7" />
      </div>
      <p className="font-bold">{texto}</p>
    </div>
  );
}