"use client";

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Eye,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
  Wallet,
  XCircle,
  AlertCircle,
  ClipboardList,
  X,
  Phone,
  Lock,
  UserRound,
  Send,
  MailCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";

type EstadoPropuesta = "enviada" | "aceptada" | "rechazada" | "cancelada";

type TabPropuestas =
  | "recibidas"
  | "enviadas"
  | "invitacionesRecibidas"
  | "invitacionesEnviadas";

type PropuestaBase = {
  id: string;
  solicitud_id: string;
  trabajador_id: string;
  mensaje: string;
  valor_estimado: number | null;
  estado: EstadoPropuesta;
  created_at: string;
};

type SolicitudInfo = {
  id: string;
  cliente_id: string;
  categoria_id: string | null;
  trabajador_invitado_id: string | null;
  titulo: string | null;
  zona: string | null;
  estado: string | null;
};

type PerfilInfo = {
  id: string;
  nombre_completo: string | null;
  verificado: boolean | null;
  foto_url: string | null;
  zona: string | null;
  telefono: string | null;
  provincia_id: number | null;
  canton_id: number | null;
};

type PerfilTrabajadorInfo = {
  usuario_id: string;
  descripcion: string | null;
  disponibilidad: string | null;
  zona_atencion: string | null;
  calificacion_promedio: number | null;
  servicios_completados: number | null;
  disponible: boolean | null;
};

type CategoriaInfo = {
  id: string;
  nombre: string;
};

type UbicacionItem = {
  id: number;
  nombre: string;
};

type PropuestaEnviada = PropuestaBase & {
  solicitud: SolicitudInfo | null;
  categoria: string;
  cliente: PerfilInfo | null;
};

type PropuestaRecibida = PropuestaBase & {
  solicitud: SolicitudInfo | null;
  trabajador: PerfilInfo | null;
  trabajadorPerfil: PerfilTrabajadorInfo | null;
  provinciaNombre: string;
  cantonNombre: string;
};

type InvitacionRecibida = PropuestaBase & {
  solicitud: SolicitudInfo | null;
  categoria: string;
  cliente: PerfilInfo | null;
};

type InvitacionEnviada = PropuestaBase & {
  solicitud: SolicitudInfo | null;
  trabajador: PerfilInfo | null;
  trabajadorPerfil: PerfilTrabajadorInfo | null;
  provinciaNombre: string;
  cantonNombre: string;
};

type CachePropuestas = {
  propuestasEnviadas: PropuestaEnviada[];
  propuestasRecibidas: PropuestaRecibida[];
  invitacionesRecibidas: InvitacionRecibida[];
  invitacionesEnviadas: InvitacionEnviada[];
};

export default function PropuestasView() {
  const { estilos, modoOscuro } = usePanelContext();

  const [tab, setTab] = useState<TabPropuestas>("recibidas");
  const [propuestasEnviadas, setPropuestasEnviadas] = useState<
    PropuestaEnviada[]
  >([]);
  const [propuestasRecibidas, setPropuestasRecibidas] = useState<
    PropuestaRecibida[]
  >([]);
  const [invitacionesRecibidas, setInvitacionesRecibidas] = useState<
    InvitacionRecibida[]
  >([]);
  const [invitacionesEnviadas, setInvitacionesEnviadas] = useState<
    InvitacionEnviada[]
  >([]);

  const [error, setError] = useState("");
  const [perfilAbierto, setPerfilAbierto] =
    useState<PropuestaRecibida | InvitacionEnviada | null>(null);

  const colorEstado = useMemo(
    () => ({
      enviada: modoOscuro
        ? "bg-blue-950 text-blue-300"
        : "bg-blue-100 text-blue-700",
      aceptada: modoOscuro
        ? "bg-green-950 text-green-300"
        : "bg-green-100 text-green-700",
      rechazada: modoOscuro
        ? "bg-red-950 text-red-300"
        : "bg-red-100 text-red-700",
      cancelada: modoOscuro
        ? "bg-gray-800 text-gray-300"
        : "bg-gray-200 text-gray-700",
    }),
    [modoOscuro]
  );

  const formatearFecha = (fecha: string) => {
    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return "Sin fecha";

    return valor.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const cargarPropuestas = async () => {
    try {
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("No se encontró el usuario autenticado.");
        return;
      }

      const [
        propuestasComoTrabajadorRes,
        misSolicitudesRes,
      ] = await Promise.all([
        supabase
          .from("propuestas_servicio")
          .select(
            "id, solicitud_id, trabajador_id, mensaje, valor_estimado, estado, created_at"
          )
          .eq("trabajador_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("solicitudes_servicio")
          .select(
            "id, cliente_id, categoria_id, trabajador_invitado_id, titulo, zona, estado"
          )
          .eq("cliente_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (propuestasComoTrabajadorRes.error) {
        console.error(
          "Error al cargar propuestas del trabajador:",
          propuestasComoTrabajadorRes.error
        );
        setError("No se pudieron cargar tus propuestas.");
        return;
      }

      if (misSolicitudesRes.error) {
        console.error(
          "Error al cargar solicitudes del cliente:",
          misSolicitudesRes.error
        );
        setError("No se pudieron cargar tus solicitudes.");
        return;
      }

      const propuestasComoTrabajador =
        (propuestasComoTrabajadorRes.data || []) as PropuestaBase[];

      const misSolicitudes = (misSolicitudesRes.data || []) as SolicitudInfo[];
      const misSolicitudesIds = misSolicitudes.map((solicitud) => solicitud.id);

      let propuestasDeMisSolicitudes: PropuestaBase[] = [];

      if (misSolicitudesIds.length > 0) {
        const { data, error } = await supabase
          .from("propuestas_servicio")
          .select(
            "id, solicitud_id, trabajador_id, mensaje, valor_estimado, estado, created_at"
          )
          .in("solicitud_id", misSolicitudesIds)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error al cargar propuestas recibidas:", error);
          setError("No se pudieron cargar las propuestas recibidas.");
          return;
        }

        propuestasDeMisSolicitudes = (data || []) as PropuestaBase[];
      }

      const todasSolicitudesIds = Array.from(
        new Set([
          ...misSolicitudes.map((solicitud) => solicitud.id),
          ...propuestasComoTrabajador.map((propuesta) => propuesta.solicitud_id),
          ...propuestasDeMisSolicitudes.map(
            (propuesta) => propuesta.solicitud_id
          ),
        ])
      );

      let solicitudes: SolicitudInfo[] = misSolicitudes;

      if (todasSolicitudesIds.length > 0) {
        const { data } = await supabase
          .from("solicitudes_servicio")
          .select(
            "id, cliente_id, categoria_id, trabajador_invitado_id, titulo, zona, estado"
          )
          .in("id", todasSolicitudesIds);

        solicitudes = (data || misSolicitudes) as SolicitudInfo[];
      }

      const solicitudesPorId = new Map(
        solicitudes.map((solicitud) => [solicitud.id, solicitud])
      );

      const categoriasIds = Array.from(
        new Set(
          solicitudes
            .map((solicitud) => solicitud.categoria_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const trabajadoresIds = Array.from(
        new Set(
          propuestasDeMisSolicitudes.map((propuesta) => propuesta.trabajador_id)
        )
      );

      const clientesIds = Array.from(
        new Set(
          propuestasComoTrabajador
            .map(
              (propuesta) =>
                solicitudesPorId.get(propuesta.solicitud_id)?.cliente_id
            )
            .filter((id): id is string => Boolean(id))
        )
      );

      const perfilesIds = Array.from(
        new Set([...trabajadoresIds, ...clientesIds])
      );

      const [
        categoriasRes,
        perfilesRes,
        perfilesTrabajadorRes,
      ] = await Promise.all([
        categoriasIds.length > 0
          ? supabase.from("categorias").select("id, nombre").in("id", categoriasIds)
          : Promise.resolve({ data: [], error: null }),

        perfilesIds.length > 0
          ? supabase
              .from("perfiles")
              .select(
                "id, nombre_completo, verificado, foto_url, zona, telefono, provincia_id, canton_id"
              )
              .in("id", perfilesIds)
          : Promise.resolve({ data: [], error: null }),

        trabajadoresIds.length > 0
          ? supabase
              .from("perfiles_trabajador")
              .select(
                "usuario_id, descripcion, disponibilidad, zona_atencion, calificacion_promedio, servicios_completados, disponible"
              )
              .in("usuario_id", trabajadoresIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const categorias = (categoriasRes.data || []) as CategoriaInfo[];
      const perfiles = (perfilesRes.data || []) as PerfilInfo[];
      const perfilesTrabajador =
        (perfilesTrabajadorRes.data || []) as PerfilTrabajadorInfo[];

      const provinciaIds = Array.from(
        new Set(
          perfiles
            .map((perfil) => perfil.provincia_id)
            .filter((id): id is number => typeof id === "number")
        )
      );

      const cantonIds = Array.from(
        new Set(
          perfiles
            .map((perfil) => perfil.canton_id)
            .filter((id): id is number => typeof id === "number")
        )
      );

      const [provinciasRes, cantonesRes] = await Promise.all([
        provinciaIds.length > 0
          ? supabase.from("provincias").select("id, nombre").in("id", provinciaIds)
          : Promise.resolve({ data: [], error: null }),

        cantonIds.length > 0
          ? supabase.from("cantones").select("id, nombre").in("id", cantonIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const provincias = (provinciasRes.data || []) as UbicacionItem[];
      const cantones = (cantonesRes.data || []) as UbicacionItem[];

      const categoriasPorId = new Map(
        categorias.map((categoria) => [categoria.id, categoria])
      );

      const perfilesPorId = new Map(perfiles.map((perfil) => [perfil.id, perfil]));

      const perfilesTrabajadorPorId = new Map(
        perfilesTrabajador.map((perfilTrabajador) => [
          perfilTrabajador.usuario_id,
          perfilTrabajador,
        ])
      );

      const provinciasPorId = new Map(
        provincias.map((item) => [item.id, item.nombre])
      );

      const cantonesPorId = new Map(
        cantones.map((item) => [item.id, item.nombre])
      );

      const invitacionesRecibidasBase = propuestasComoTrabajador.filter(
        (propuesta) => {
          const solicitud = solicitudesPorId.get(propuesta.solicitud_id);
          return solicitud?.trabajador_invitado_id === user.id;
        }
      );

      const propuestasEnviadasBase = propuestasComoTrabajador.filter(
        (propuesta) => {
          const solicitud = solicitudesPorId.get(propuesta.solicitud_id);
          return solicitud?.trabajador_invitado_id !== user.id;
        }
      );

      const invitacionesEnviadasBase = propuestasDeMisSolicitudes.filter(
        (propuesta) => {
          const solicitud = solicitudesPorId.get(propuesta.solicitud_id);
          return solicitud?.trabajador_invitado_id === propuesta.trabajador_id;
        }
      );

      const propuestasRecibidasBase = propuestasDeMisSolicitudes.filter(
        (propuesta) => {
          const solicitud = solicitudesPorId.get(propuesta.solicitud_id);
          return solicitud?.trabajador_invitado_id !== propuesta.trabajador_id;
        }
      );

      const propuestasEnviadasFormateadas: PropuestaEnviada[] =
        propuestasEnviadasBase.map((propuesta) => {
          const solicitud = solicitudesPorId.get(propuesta.solicitud_id) || null;

          const categoria = solicitud?.categoria_id
            ? categoriasPorId.get(solicitud.categoria_id)?.nombre ||
              "Sin categoría"
            : "Sin categoría";

          return {
            ...propuesta,
            solicitud,
            categoria,
            cliente: solicitud?.cliente_id
              ? perfilesPorId.get(solicitud.cliente_id) || null
              : null,
          };
        });

      const invitacionesRecibidasFormateadas: InvitacionRecibida[] =
        invitacionesRecibidasBase.map((propuesta) => {
          const solicitud = solicitudesPorId.get(propuesta.solicitud_id) || null;

          const categoria = solicitud?.categoria_id
            ? categoriasPorId.get(solicitud.categoria_id)?.nombre ||
              "Sin categoría"
            : "Sin categoría";

          return {
            ...propuesta,
            solicitud,
            categoria,
            cliente: solicitud?.cliente_id
              ? perfilesPorId.get(solicitud.cliente_id) || null
              : null,
          };
        });

      const propuestasRecibidasFormateadas: PropuestaRecibida[] =
        propuestasRecibidasBase.map((propuesta) => {
          const trabajador = perfilesPorId.get(propuesta.trabajador_id) || null;

          return {
            ...propuesta,
            solicitud: solicitudesPorId.get(propuesta.solicitud_id) || null,
            trabajador,
            trabajadorPerfil:
              perfilesTrabajadorPorId.get(propuesta.trabajador_id) || null,
            provinciaNombre: trabajador?.provincia_id
              ? provinciasPorId.get(trabajador.provincia_id) || ""
              : "",
            cantonNombre: trabajador?.canton_id
              ? cantonesPorId.get(trabajador.canton_id) || ""
              : "",
          };
        });

      const invitacionesEnviadasFormateadas: InvitacionEnviada[] =
        invitacionesEnviadasBase.map((propuesta) => {
          const trabajador = perfilesPorId.get(propuesta.trabajador_id) || null;

          return {
            ...propuesta,
            solicitud: solicitudesPorId.get(propuesta.solicitud_id) || null,
            trabajador,
            trabajadorPerfil:
              perfilesTrabajadorPorId.get(propuesta.trabajador_id) || null,
            provinciaNombre: trabajador?.provincia_id
              ? provinciasPorId.get(trabajador.provincia_id) || ""
              : "",
            cantonNombre: trabajador?.canton_id
              ? cantonesPorId.get(trabajador.canton_id) || ""
              : "",
          };
        });

      setPropuestasEnviadas(propuestasEnviadasFormateadas);
      setPropuestasRecibidas(propuestasRecibidasFormateadas);
      setInvitacionesRecibidas(invitacionesRecibidasFormateadas);
      setInvitacionesEnviadas(invitacionesEnviadasFormateadas);
    } catch (error) {
      console.error("Error inesperado al cargar propuestas:", error);
      setError("No se pudieron actualizar las propuestas.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await cargarPropuestas();
    };
    loadData();
  }, []);

  const actualizarEstadoLocal = (
    propuestaId: string,
    solicitudId: string,
    nuevoEstado: EstadoPropuesta
  ) => {
    setPropuestasRecibidas((prev) =>
      prev.map((item) => {
        if (item.id === propuestaId) return { ...item, estado: nuevoEstado };
        if (nuevoEstado === "aceptada" && item.solicitud_id === solicitudId) {
          return { ...item, estado: "rechazada" };
        }
        return item;
      })
    );

    setPropuestasEnviadas((prev) =>
      prev.map((item) =>
        item.id === propuestaId ? { ...item, estado: nuevoEstado } : item
      )
    );

    setInvitacionesRecibidas((prev) =>
      prev.map((item) => {
        if (item.id === propuestaId) return { ...item, estado: nuevoEstado };
        if (nuevoEstado === "aceptada" && item.solicitud_id === solicitudId) {
          return { ...item, estado: "rechazada" };
        }
        return item;
      })
    );

    setInvitacionesEnviadas((prev) =>
      prev.map((item) =>
        item.id === propuestaId ? { ...item, estado: nuevoEstado } : item
      )
    );
  };




  
  
  const aceptarPropuesta = async (propuestaId: string, solicitudId: string) => {
  if (!propuestaId || !solicitudId) return;

  actualizarEstadoLocal(propuestaId, solicitudId, "aceptada");
  setError("");

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("No se encontró el usuario autenticado.");
      cargarPropuestas();
      return;
    }

    const { data: propuesta, error: propuestaError } = await supabase
      .from("propuestas_servicio")
      .select("id, solicitud_id, trabajador_id, valor_estimado, estado")
      .eq("id", propuestaId)
      .maybeSingle();

    if (propuestaError || !propuesta) {
      console.error("Error al obtener propuesta:", propuestaError);
      setError("No se pudo obtener la propuesta seleccionada.");
      cargarPropuestas();
      return;
    }

    const { data: solicitud, error: solicitudError } = await supabase
      .from("solicitudes_servicio")
      .select("id, cliente_id, estado")
      .eq("id", solicitudId)
      .maybeSingle();

    if (solicitudError || !solicitud) {
      console.error("Error al obtener solicitud:", solicitudError);
      setError("No se pudo obtener la solicitud.");
      cargarPropuestas();
      return;
    }

    const esCliente = solicitud.cliente_id === user.id;
    const esTrabajadorInvitado = propuesta.trabajador_id === user.id;

    if (!esCliente && !esTrabajadorInvitado) {
      setError("No tienes permiso para aceptar esta propuesta.");
      cargarPropuestas();
      return;
    }

    const { error: aceptarError } = await supabase
      .from("propuestas_servicio")
      .update({
        estado: "aceptada",
      })
      .eq("id", propuestaId);

    if (aceptarError) {
      console.error("Error al aceptar propuesta:", aceptarError);
      setError("No se pudo aceptar la propuesta.");
      cargarPropuestas();
      return;
    }

    const { error: rechazarError } = await supabase
      .from("propuestas_servicio")
      .update({
        estado: "rechazada",
      })
      .eq("solicitud_id", solicitudId)
      .neq("id", propuestaId);

    if (rechazarError) {
      console.error("Error al rechazar otras propuestas:", rechazarError);
    }

    const { error: solicitudUpdateError } = await supabase
      .from("solicitudes_servicio")
      .update({
        estado: "confirmado",
      })
      .eq("id", solicitudId);

    if (solicitudUpdateError) {
      console.error("Error al actualizar solicitud:", solicitudUpdateError);
      setError("La propuesta fue aceptada, pero no se pudo confirmar la solicitud.");
      cargarPropuestas();
      return;
    }

    const { data: servicioExistente, error: servicioExistenteError } =
      await supabase
        .from("servicios")
        .select("id")
        .eq("solicitud_id", solicitudId)
        .maybeSingle();

    if (servicioExistenteError) {
      console.error("Error al revisar servicio existente:", servicioExistenteError);
      setError("No se pudo revisar si el servicio ya existía.");
      cargarPropuestas();
      return;
    }

    let servicioId = servicioExistente?.id || "";

    if (!servicioId) {
      const { data: servicioCreado, error: servicioError } = await supabase
        .from("servicios")
        .insert({
          solicitud_id: solicitudId,
          propuesta_aceptada_id: propuestaId,
          cliente_id: solicitud.cliente_id,
          trabajador_id: propuesta.trabajador_id,
          estado: "confirmado",
        })
        .select("id")
        .single();

      if (servicioError || !servicioCreado) {
        console.error("Error al crear servicio:", servicioError);
        setError("La propuesta fue aceptada, pero no se pudo crear el servicio.");
        cargarPropuestas();
        return;
      }

      servicioId = servicioCreado.id;
    } else {
      const { error: actualizarServicioError } = await supabase
        .from("servicios")
        .update({
          propuesta_aceptada_id: propuestaId,
          cliente_id: solicitud.cliente_id,
          trabajador_id: propuesta.trabajador_id,
          estado: "confirmado",
        })
        .eq("id", servicioId);

      if (actualizarServicioError) {
        console.error("Error al actualizar servicio:", actualizarServicioError);
        setError("La propuesta fue aceptada, pero no se pudo actualizar el servicio.");
        cargarPropuestas();
        return;
      }
    }

    const { data: seguimientoExistente, error: seguimientoExistenteError } =
      await supabase
        .from("seguimientos_servicio")
        .select("id")
        .eq("servicio_id", servicioId)
        .maybeSingle();

    if (seguimientoExistenteError) {
      console.error(
        "Error al revisar seguimiento existente:",
        seguimientoExistenteError
      );
      setError("No se pudo revisar el seguimiento del servicio.");
      cargarPropuestas();
      return;
    }

    if (!seguimientoExistente) {
      const { error: seguimientoError } = await supabase
        .from("seguimientos_servicio")
        .insert({
          servicio_id: servicioId,
          trabajador_id: propuesta.trabajador_id,
          cliente_id: solicitud.cliente_id,
          activo: false,
        });

      if (seguimientoError) {
        console.error("Error al crear seguimiento:", seguimientoError);
        setError("El servicio fue creado, pero no se pudo crear el seguimiento.");
        cargarPropuestas();
        return;
      }
    } else {
      const { error: actualizarSeguimientoError } = await supabase
        .from("seguimientos_servicio")
        .update({
          trabajador_id: propuesta.trabajador_id,
          cliente_id: solicitud.cliente_id,
          activo: false,
          actualizado_en: new Date().toISOString(),
        })
        .eq("servicio_id", servicioId);

      if (actualizarSeguimientoError) {
        console.error(
          "Error al actualizar seguimiento:",
          actualizarSeguimientoError
        );
      }
    }

    await cargarPropuestas();
  } catch (error) {
    console.error("Error inesperado al aceptar propuesta:", error);
    setError("Ocurrió un error inesperado al aceptar la propuesta.");
    cargarPropuestas();
  }
};

  const rechazarPropuesta = async (propuestaId: string, solicitudId: string) => {
    actualizarEstadoLocal(propuestaId, solicitudId, "rechazada");

    const { error } = await supabase
      .from("propuestas_servicio")
      .update({ estado: "rechazada" })
      .eq("id", propuestaId);

    if (error) {
      setError("No se pudo rechazar.");
      cargarPropuestas();
      return;
    }

    cargarPropuestas();
  };

  const cancelarPropuesta = async (propuestaId: string, solicitudId: string) => {
    actualizarEstadoLocal(propuestaId, solicitudId, "cancelada");

    const { error } = await supabase
      .from("propuestas_servicio")
      .update({ estado: "cancelada" })
      .eq("id", propuestaId);

    if (error) {
      setError("No se pudo cancelar.");
      cargarPropuestas();
      return;
    }

    cargarPropuestas();
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
              Gestión de propuestas
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
            >
              Propuestas
            </h1>

            <p className={`mt-2 ${estilos.textoSecundario}`}>
              Administra propuestas e invitaciones de tus solicitudes.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <TabButton
              activo={tab === "recibidas"}
              texto="Recibidas"
              onClick={() => setTab("recibidas")}
              modoOscuro={modoOscuro}
            />

            <TabButton
              activo={tab === "enviadas"}
              texto="Enviadas"
              onClick={() => setTab("enviadas")}
              modoOscuro={modoOscuro}
            />

            <TabButton
              activo={tab === "invitacionesRecibidas"}
              texto="Inv. recibidas"
              onClick={() => setTab("invitacionesRecibidas")}
              modoOscuro={modoOscuro}
            />

            <TabButton
              activo={tab === "invitacionesEnviadas"}
              texto="Inv. enviadas"
              onClick={() => setTab("invitacionesEnviadas")}
              modoOscuro={modoOscuro}
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {tab === "enviadas" ? (
        <ListaEnviadas
          propuestas={propuestasEnviadas}
          colorEstado={colorEstado}
          estilos={estilos}
          modoOscuro={modoOscuro}
          formatearFecha={formatearFecha}
          cancelarPropuesta={cancelarPropuesta}
        />
      ) : tab === "invitacionesRecibidas" ? (
        <ListaInvitacionesRecibidas
          propuestas={invitacionesRecibidas}
          colorEstado={colorEstado}
          estilos={estilos}
          modoOscuro={modoOscuro}
          formatearFecha={formatearFecha}
          aceptarPropuesta={aceptarPropuesta}
          rechazarPropuesta={rechazarPropuesta}
        />
      ) : tab === "invitacionesEnviadas" ? (
        <ListaInvitacionesEnviadas
          propuestas={invitacionesEnviadas}
          colorEstado={colorEstado}
          estilos={estilos}
          modoOscuro={modoOscuro}
          formatearFecha={formatearFecha}
          cancelarPropuesta={cancelarPropuesta}
          abrirPerfil={setPerfilAbierto}
        />
      ) : (
        <ListaRecibidas
          propuestas={propuestasRecibidas}
          colorEstado={colorEstado}
          estilos={estilos}
          modoOscuro={modoOscuro}
          formatearFecha={formatearFecha}
          aceptarPropuesta={aceptarPropuesta}
          rechazarPropuesta={rechazarPropuesta}
          abrirPerfil={setPerfilAbierto}
        />
      )}

      {perfilAbierto && (
        <ModalPerfilTrabajador
          propuesta={perfilAbierto}
          modoOscuro={modoOscuro}
          estilos={estilos}
          cerrar={() => setPerfilAbierto(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  activo,
  texto,
  onClick,
  modoOscuro,
}: {
  activo: boolean;
  texto: string;
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
      {texto}
    </button>
  );
}

function ListaEnviadas({
  propuestas,
  colorEstado,
  estilos,
  modoOscuro,
  formatearFecha,
  cancelarPropuesta,
}: {
  propuestas: PropuestaEnviada[];
  colorEstado: Record<EstadoPropuesta, string>;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
  formatearFecha: (fecha: string) => string;
  cancelarPropuesta: (propuestaId: string, solicitudId: string) => void;
}) {
  if (propuestas.length === 0) {
    return (
      <Vacio texto="Aún no has enviado propuestas." modoOscuro={modoOscuro} />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {propuestas.map((propuesta) => (
        <div
          key={propuesta.id}
          className={`rounded-[22px] border p-5 ${
            modoOscuro
              ? "bg-[#111827] border-[#334155]"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={`text-lg font-extrabold ${estilos.textoPrincipal}`}>
                {propuesta.solicitud?.titulo || "Solicitud"}
              </h3>
              <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                {propuesta.categoria}
              </p>
              <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                Cliente: {propuesta.cliente?.nombre_completo || "No definido"}
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                colorEstado[propuesta.estado]
              }`}
            >
              {propuesta.estado}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <InfoItem
              icon={<MapPin className="w-4 h-4" />}
              label="Zona"
              value={propuesta.solicitud?.zona || "No definida"}
              estilos={estilos}
            />
            <InfoItem
              icon={<Wallet className="w-4 h-4" />}
              label="Oferta"
              value={
                propuesta.valor_estimado !== null
                  ? `$${propuesta.valor_estimado}`
                  : "No definida"
              }
              estilos={estilos}
            />
            <InfoItem
              icon={<CalendarDays className="w-4 h-4" />}
              label="Fecha"
              value={formatearFecha(propuesta.created_at)}
              estilos={estilos}
            />
            <InfoItem
              icon={<ClipboardList className="w-4 h-4" />}
              label="Estado solicitud"
              value={propuesta.solicitud?.estado || "Sin estado"}
              estilos={estilos}
            />
          </div>

          <MensajeBox
            mensaje={propuesta.mensaje}
            titulo="Mensaje enviado"
            modoOscuro={modoOscuro}
            estilos={estilos}
          />

          {propuesta.estado === "enviada" && (
            <button
              onClick={() =>
                cancelarPropuesta(propuesta.id, propuesta.solicitud_id)
              }
              className="mt-5 rounded-2xl px-4 py-3 font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ListaInvitacionesRecibidas({
  propuestas,
  colorEstado,
  estilos,
  modoOscuro,
  formatearFecha,
  aceptarPropuesta,
  rechazarPropuesta,
}: {
  propuestas: InvitacionRecibida[];
  colorEstado: Record<EstadoPropuesta, string>;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
  formatearFecha: (fecha: string) => string;
  aceptarPropuesta: (propuestaId: string, solicitudId: string) => void;
  rechazarPropuesta: (propuestaId: string, solicitudId: string) => void;
}) {
  if (propuestas.length === 0) {
    return (
      <Vacio
        texto="Aún no has recibido invitaciones."
        modoOscuro={modoOscuro}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {propuestas.map((propuesta) => (
        <div
          key={propuesta.id}
          className={`rounded-[22px] border p-5 ${
            modoOscuro
              ? "bg-[#111827] border-[#334155]"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold bg-[#e7f0ff] text-[#0B3C7F] mb-3">
                <MailCheck className="w-4 h-4" />
                Invitación recibida
              </div>

              <h3 className={`text-lg font-extrabold ${estilos.textoPrincipal}`}>
                {propuesta.solicitud?.titulo || "Solicitud"}
              </h3>

              <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                Cliente: {propuesta.cliente?.nombre_completo || "No definido"}
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                colorEstado[propuesta.estado]
              }`}
            >
              {propuesta.estado}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <InfoItem
              icon={<Briefcase className="w-4 h-4" />}
              label="Categoría"
              value={propuesta.categoria}
              estilos={estilos}
            />
            <InfoItem
              icon={<MapPin className="w-4 h-4" />}
              label="Zona"
              value={propuesta.solicitud?.zona || "No definida"}
              estilos={estilos}
            />
            <InfoItem
              icon={<CalendarDays className="w-4 h-4" />}
              label="Fecha"
              value={formatearFecha(propuesta.created_at)}
              estilos={estilos}
            />
            <InfoItem
              icon={<ClipboardList className="w-4 h-4" />}
              label="Estado solicitud"
              value={propuesta.solicitud?.estado || "Sin estado"}
              estilos={estilos}
            />
          </div>

          <MensajeBox
            mensaje={propuesta.mensaje}
            titulo="Mensaje del cliente"
            modoOscuro={modoOscuro}
            estilos={estilos}
          />

          {propuesta.estado === "enviada" && (
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={() =>
                  aceptarPropuesta(propuesta.id, propuesta.solicitud_id)
                }
                className="rounded-2xl px-4 py-3 font-bold bg-green-600 hover:bg-green-700 text-white transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aceptar
              </button>

              <button
                onClick={() =>
                  rechazarPropuesta(propuesta.id, propuesta.solicitud_id)
                }
                className="rounded-2xl px-4 py-3 font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Rechazar
              </button>
            </div>
          )}

          {propuesta.estado === "aceptada" && (
            <EstadoAceptado texto="Invitación aceptada" />
          )}
        </div>
      ))}
    </div>
  );
}

function ListaInvitacionesEnviadas({
  propuestas,
  colorEstado,
  estilos,
  modoOscuro,
  formatearFecha,
  cancelarPropuesta,
  abrirPerfil,
}: {
  propuestas: InvitacionEnviada[];
  colorEstado: Record<EstadoPropuesta, string>;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
  formatearFecha: (fecha: string) => string;
  cancelarPropuesta: (propuestaId: string, solicitudId: string) => void;
  abrirPerfil: (propuesta: InvitacionEnviada) => void;
}) {
  if (propuestas.length === 0) {
    return (
      <Vacio
        texto="Aún no has enviado invitaciones."
        modoOscuro={modoOscuro}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {propuestas.map((propuesta) => (
        <div
          key={propuesta.id}
          className={`rounded-[22px] border p-5 ${
            modoOscuro
              ? "bg-[#111827] border-[#334155]"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold bg-[#e7f0ff] text-[#0B3C7F] mb-3">
                <Send className="w-4 h-4" />
                Invitación enviada
              </div>

              <h3 className={`text-lg font-extrabold ${estilos.textoPrincipal}`}>
                {propuesta.trabajador?.nombre_completo || "Trabajador"}
              </h3>

              <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                {propuesta.solicitud?.titulo || "Solicitud"}
              </p>

              <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                {[propuesta.cantonNombre, propuesta.provinciaNombre]
                  .filter(Boolean)
                  .join(", ") ||
                  propuesta.trabajador?.zona ||
                  "Zona no definida"}
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                colorEstado[propuesta.estado]
              }`}
            >
              {propuesta.estado}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {propuesta.trabajador?.verificado && (
              <span className="px-3 py-1 rounded-full bg-[#fff6da] text-[#a36a00] text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verificado
              </span>
            )}

            <span className="px-3 py-1 rounded-full bg-[#e7f0ff] text-[#0B3C7F] text-xs font-bold flex items-center gap-1">
              <Star className="w-3.5 h-3.5" />
              {propuesta.trabajadorPerfil?.calificacion_promedio || 0}
            </span>

            <span className="px-3 py-1 rounded-full bg-[#eaf8ef] text-[#166534] text-xs font-bold">
              {propuesta.trabajadorPerfil?.servicios_completados || 0} servicios
            </span>
          </div>

          <MensajeBox
            mensaje={propuesta.mensaje}
            titulo="Mensaje enviado"
            modoOscuro={modoOscuro}
            estilos={estilos}
          />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <InfoItem
              icon={<CalendarDays className="w-4 h-4" />}
              label="Fecha"
              value={formatearFecha(propuesta.created_at)}
              estilos={estilos}
            />
            <InfoItem
              icon={<ClipboardList className="w-4 h-4" />}
              label="Estado solicitud"
              value={propuesta.solicitud?.estado || "Sin estado"}
              estilos={estilos}
            />
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={() => abrirPerfil(propuesta)}
              className={`rounded-2xl px-4 py-3 font-bold transition flex items-center gap-2 ${
                modoOscuro
                  ? "bg-[#0f172a] text-white border border-[#334155]"
                  : "bg-[#f3f4f6] text-gray-700"
              }`}
            >
              <Eye className="w-4 h-4" />
              Ver perfil
            </button>

            {propuesta.estado === "enviada" && (
              <button
                onClick={() =>
                  cancelarPropuesta(propuesta.id, propuesta.solicitud_id)
                }
                className="rounded-2xl px-4 py-3 font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancelar invitación
              </button>
            )}

            {propuesta.estado === "aceptada" && (
              <EstadoAceptado texto="Invitación aceptada" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListaRecibidas({
  propuestas,
  colorEstado,
  estilos,
  modoOscuro,
  formatearFecha,
  aceptarPropuesta,
  rechazarPropuesta,
  abrirPerfil,
}: {
  propuestas: PropuestaRecibida[];
  colorEstado: Record<EstadoPropuesta, string>;
  estilos: { textoPrincipal: string; textoSecundario: string };
  modoOscuro: boolean;
  formatearFecha: (fecha: string) => string;
  aceptarPropuesta: (propuestaId: string, solicitudId: string) => void;
  rechazarPropuesta: (propuestaId: string, solicitudId: string) => void;
  abrirPerfil: (propuesta: PropuestaRecibida) => void;
}) {
  if (propuestas.length === 0) {
    return (
      <Vacio texto="Aún no has recibido propuestas." modoOscuro={modoOscuro} />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {propuestas.map((propuesta) => (
        <div
          key={propuesta.id}
          className={`rounded-[22px] border p-5 ${
            modoOscuro
              ? "bg-[#111827] border-[#334155]"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={`text-lg font-extrabold ${estilos.textoPrincipal}`}>
                {propuesta.trabajador?.nombre_completo || "Trabajador"}
              </h3>

              <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                {propuesta.solicitud?.titulo || "Solicitud"}
              </p>

              <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                {[propuesta.cantonNombre, propuesta.provinciaNombre]
                  .filter(Boolean)
                  .join(", ") ||
                  propuesta.trabajador?.zona ||
                  "Zona no definida"}
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                colorEstado[propuesta.estado]
              }`}
            >
              {propuesta.estado}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {propuesta.trabajador?.verificado && (
              <span className="px-3 py-1 rounded-full bg-[#fff6da] text-[#a36a00] text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verificado
              </span>
            )}

            <span className="px-3 py-1 rounded-full bg-[#e7f0ff] text-[#0B3C7F] text-xs font-bold flex items-center gap-1">
              <Star className="w-3.5 h-3.5" />
              {propuesta.trabajadorPerfil?.calificacion_promedio || 0}
            </span>

            <span className="px-3 py-1 rounded-full bg-[#eaf8ef] text-[#166534] text-xs font-bold">
              {propuesta.trabajadorPerfil?.servicios_completados || 0} servicios
            </span>
          </div>

          <MensajeBox
            mensaje={propuesta.mensaje}
            titulo="Mensaje"
            modoOscuro={modoOscuro}
            estilos={estilos}
          />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <InfoItem
              icon={<Wallet className="w-4 h-4" />}
              label="Oferta"
              value={
                propuesta.valor_estimado !== null
                  ? `$${propuesta.valor_estimado}`
                  : "No definida"
              }
              estilos={estilos}
            />
            <InfoItem
              icon={<CalendarDays className="w-4 h-4" />}
              label="Fecha"
              value={formatearFecha(propuesta.created_at)}
              estilos={estilos}
            />
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={() => abrirPerfil(propuesta)}
              className={`rounded-2xl px-4 py-3 font-bold transition flex items-center gap-2 ${
                modoOscuro
                  ? "bg-[#0f172a] text-white border border-[#334155]"
                  : "bg-[#f3f4f6] text-gray-700"
              }`}
            >
              <Eye className="w-4 h-4" />
              Ver perfil
            </button>

            {propuesta.estado === "enviada" && (
              <>
                <button
                  onClick={() =>
                    aceptarPropuesta(propuesta.id, propuesta.solicitud_id)
                  }
                  className="rounded-2xl px-4 py-3 font-bold bg-green-600 hover:bg-green-700 text-white transition flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aceptar
                </button>

                <button
                  onClick={() =>
                    rechazarPropuesta(propuesta.id, propuesta.solicitud_id)
                  }
                  className="rounded-2xl px-4 py-3 font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Rechazar
                </button>
              </>
            )}

            {propuesta.estado === "aceptada" && (
              <EstadoAceptado texto="Propuesta aceptada" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModalPerfilTrabajador({
  propuesta,
  modoOscuro,
  estilos,
  cerrar,
}: {
  propuesta: PropuestaRecibida | InvitacionEnviada;
  modoOscuro: boolean;
  estilos: {
    textoPrincipal: string;
    textoSecundario: string;
    inputBase: string;
  };
  cerrar: () => void;
}) {
  const contactoDisponible = propuesta.estado === "aceptada";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={cerrar}
      />

      <div
        className={`relative w-full max-w-2xl rounded-[26px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
          modoOscuro
            ? "bg-[#111827] border-[#334155]"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center">
              {propuesta.trabajador?.foto_url ? (
                <img
                  src={propuesta.trabajador.foto_url}
                  alt="Foto trabajador"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserRound className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className={`text-2xl font-extrabold ${estilos.textoPrincipal}`}>
                {propuesta.trabajador?.nombre_completo || "Trabajador"}
              </h3>
              <p className={`text-sm ${estilos.textoSecundario}`}>
                {[propuesta.cantonNombre, propuesta.provinciaNombre]
                  .filter(Boolean)
                  .join(", ") ||
                  propuesta.trabajador?.zona ||
                  "Zona no definida"}
              </p>
            </div>
          </div>

          <button
            onClick={cerrar}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              modoOscuro
                ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <InfoBox
            label="Calificación"
            value={`${propuesta.trabajadorPerfil?.calificacion_promedio || 0}`}
            icon={<Star className="w-5 h-5" />}
            modoOscuro={modoOscuro}
            estilos={estilos}
          />
          <InfoBox
            label="Servicios"
            value={`${propuesta.trabajadorPerfil?.servicios_completados || 0}`}
            icon={<Briefcase className="w-5 h-5" />}
            modoOscuro={modoOscuro}
            estilos={estilos}
          />
          <InfoBox
            label="Verificación"
            value={propuesta.trabajador?.verificado ? "Verificado" : "Pendiente"}
            icon={<ShieldCheck className="w-5 h-5" />}
            modoOscuro={modoOscuro}
            estilos={estilos}
          />
        </div>

        <div
          className={`mt-5 rounded-2xl border p-4 ${
            modoOscuro
              ? "bg-[#0f172a] border-[#334155]"
              : "bg-[#f8fafc] border-gray-100"
          }`}
        >
          <p className={`font-extrabold ${estilos.textoPrincipal}`}>
            Descripción del trabajador
          </p>
          <p className={`text-sm mt-2 ${estilos.textoSecundario}`}>
            {propuesta.trabajadorPerfil?.descripcion ||
              "Este trabajador todavía no ha agregado una descripción."}
          </p>
        </div>

        <div
          className={`mt-4 rounded-2xl border p-4 ${
            modoOscuro
              ? "bg-[#0f172a] border-[#334155]"
              : "bg-[#f8fafc] border-gray-100"
          }`}
        >
          <p className={`font-extrabold ${estilos.textoPrincipal}`}>
            Información de contacto
          </p>

          {contactoDisponible ? (
            <div className="mt-3 flex items-center gap-3">
              <Phone className="w-5 h-5 text-[#0B3C7F]" />
              <p className={`font-bold ${estilos.textoPrincipal}`}>
                {propuesta.trabajador?.telefono || "Teléfono no registrado"}
              </p>
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#0B3C7F] shrink-0 mt-0.5" />
              <p className={`text-sm ${estilos.textoSecundario}`}>
                El contacto directo se mostrará cuando el servicio esté
                confirmado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MensajeBox({
  mensaje,
  titulo,
  modoOscuro,
  estilos,
}: {
  mensaje: string;
  titulo: string;
  modoOscuro: boolean;
  estilos: { textoPrincipal: string; textoSecundario: string };
}) {
  return (
    <div
      className={`mt-5 rounded-2xl border p-4 ${
        modoOscuro
          ? "bg-[#0f172a] border-[#334155]"
          : "bg-[#f8fafc] border-gray-100"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-4 h-4 text-[#0B3C7F]" />
        <p className={`font-bold ${estilos.textoPrincipal}`}>{titulo}</p>
      </div>
      <p className={`text-sm ${estilos.textoSecundario}`}>{mensaje}</p>
    </div>
  );
}

function EstadoAceptado({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl px-4 py-3 bg-green-100 text-green-700 font-bold flex items-center gap-2">
      <BadgeCheck className="w-4 h-4" />
      {texto}
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
    <div className="flex items-start gap-3">
      <div className="mt-1 text-[#0B3C7F]">{icon}</div>
      <div>
        <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
          {label}
        </p>
        <p className={`font-bold ${estilos.textoPrincipal}`}>{value}</p>
      </div>
    </div>
  );
}

function InfoBox({
  icon,
  label,
  value,
  modoOscuro,
  estilos,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  modoOscuro: boolean;
  estilos: { textoPrincipal: string; textoSecundario: string };
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        modoOscuro
          ? "bg-[#0f172a] border-[#334155]"
          : "bg-[#f8fafc] border-gray-100"
      }`}
    >
      <div className="text-[#0B3C7F]">{icon}</div>
      <p className={`text-xs font-bold mt-2 ${estilos.textoSecundario}`}>
        {label}
      </p>
      <p className={`font-extrabold ${estilos.textoPrincipal}`}>{value}</p>
    </div>
  );
}

function Vacio({ texto, modoOscuro }: { texto: string; modoOscuro: boolean }) {
  return (
    <div
      className={`rounded-[22px] border p-8 text-center ${
        modoOscuro
          ? "bg-[#111827] border-[#334155] text-slate-300"
          : "bg-white border-gray-200 text-gray-500"
      }`}
    >
      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p className="font-bold">{texto}</p>
    </div>
  );
}