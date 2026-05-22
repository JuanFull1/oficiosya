"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Crown,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  nombre_completo: string;
  correo: string | null;
  telefono: string | null;
  foto_url: string | null;
  zona: string | null;
  activo: boolean;
  verificado: boolean;
  es_cliente: boolean;
  es_trabajador: boolean;
  es_admin: boolean;
  creado_en: string;
  actualizado_en?: string;
};

const CACHE_KEY = "oficiosya-admin-usuarios-cache";

export default function UsuariosAdminView() {
  const [adminId, setAdminId] = useState("");
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<
    "todos" | "activos" | "suspendidos" | "verificados" | "admins" | "trabajadores"
  >("todos");

  const [sincronizando, setSincronizando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;

      const cache = JSON.parse(raw) as Perfil[];
      setUsuarios(cache || []);
    } catch (err) {
      console.error("No se pudo leer cache usuarios admin:", err);
    }
  }, []);

  const guardarCache = useCallback((data: Perfil[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("No se pudo guardar cache usuarios admin:", err);
    }
  }, []);

  const cargarUsuarios = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError("No se pudo validar la sesión.");
        return;
      }

      setAdminId(authData.user.id);

      const { data, error: usuariosError } = await supabase
        .from("perfiles")
        .select(
          "id,nombre_completo,correo,telefono,foto_url,zona,activo,verificado,es_cliente,es_trabajador,es_admin,creado_en,actualizado_en"
        )
        .order("creado_en", { ascending: false });

      if (usuariosError) {
        console.error("Error al cargar usuarios:", usuariosError);
        setError("No se pudieron cargar los usuarios.");
        return;
      }

      const usuariosData = (data || []) as Perfil[];
      setUsuarios(usuariosData);
      guardarCache(usuariosData);
    } catch (err) {
      console.error("Error general usuarios admin:", err);
      setError("Ocurrió un error al sincronizar usuarios.");
    } finally {
      setSincronizando(false);
    }
  }, [guardarCache]);

  useEffect(() => {
    leerCache();
    cargarUsuarios();
  }, [leerCache, cargarUsuarios]);

  const metricas = useMemo(() => {
    return {
      total: usuarios.length,
      activos: usuarios.filter((u) => u.activo).length,
      suspendidos: usuarios.filter((u) => !u.activo).length,
      verificados: usuarios.filter((u) => u.verificado).length,
      trabajadores: usuarios.filter((u) => u.es_trabajador).length,
      admins: usuarios.filter((u) => u.es_admin).length,
    };
  }, [usuarios]);

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const coincideTexto =
        !texto ||
        usuario.nombre_completo?.toLowerCase().includes(texto) ||
        usuario.correo?.toLowerCase().includes(texto) ||
        usuario.telefono?.toLowerCase().includes(texto) ||
        usuario.zona?.toLowerCase().includes(texto);

      const coincideFiltro =
        filtro === "todos" ||
        (filtro === "activos" && usuario.activo) ||
        (filtro === "suspendidos" && !usuario.activo) ||
        (filtro === "verificados" && usuario.verificado) ||
        (filtro === "admins" && usuario.es_admin) ||
        (filtro === "trabajadores" && usuario.es_trabajador);

      return coincideTexto && coincideFiltro;
    });
  }, [usuarios, busqueda, filtro]);

  const actualizarUsuarioLocal = (usuarioActualizado: Perfil) => {
    setUsuarios((prev) => {
      const nuevaLista = prev.map((u) =>
        u.id === usuarioActualizado.id ? usuarioActualizado : u
      );

      guardarCache(nuevaLista);
      return nuevaLista;
    });
  };

  const cambiarActivoUsuario = async (usuario: Perfil, activo: boolean) => {
    setMensaje("");
    setError("");

    if (usuario.id === adminId && !activo) {
      setError("No puedes suspender tu propia cuenta de administrador.");
      return;
    }

    setProcesandoId(usuario.id);

    const { data, error: updateError } = await supabase
      .from("perfiles")
      .update({
        activo,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", usuario.id)
      .select(
        "id,nombre_completo,correo,telefono,foto_url,zona,activo,verificado,es_cliente,es_trabajador,es_admin,creado_en,actualizado_en"
      )
      .single();

    if (updateError) {
      console.error("Error al cambiar estado usuario:", updateError);
      setError("No se pudo actualizar el estado del usuario.");
      setProcesandoId(null);
      return;
    }

    actualizarUsuarioLocal(data as Perfil);
    setMensaje(activo ? "Usuario activado correctamente." : "Usuario suspendido correctamente.");
    setProcesandoId(null);
  };

  const cambiarAdminUsuario = async (usuario: Perfil, esAdmin: boolean) => {
    setMensaje("");
    setError("");

    if (usuario.id === adminId && !esAdmin) {
      setError("No puedes quitarte el rol de administrador a ti mismo.");
      return;
    }

    setProcesandoId(usuario.id);

    const { data, error: updateError } = await supabase
      .from("perfiles")
      .update({
        es_admin: esAdmin,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", usuario.id)
      .select(
        "id,nombre_completo,correo,telefono,foto_url,zona,activo,verificado,es_cliente,es_trabajador,es_admin,creado_en,actualizado_en"
      )
      .single();

    if (updateError) {
      console.error("Error al cambiar rol admin:", updateError);
      setError("No se pudo actualizar el rol del usuario.");
      setProcesandoId(null);
      return;
    }

    actualizarUsuarioLocal(data as Perfil);
    setMensaje(esAdmin ? "Usuario convertido en administrador." : "Rol de administrador retirado.");
    setProcesandoId(null);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <UsersRound size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">Gestión de usuarios</h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Revisa cuentas, roles, verificación y estado de acceso.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cargarUsuarios}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <Loader2 size={16} className={sincronizando ? "animate-spin" : ""} />
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard titulo="Total" valor={metricas.total} />
        <MetricCard titulo="Activos" valor={metricas.activos} verde />
        <MetricCard titulo="Suspendidos" valor={metricas.suspendidos} rojo />
        <MetricCard titulo="Verificados" valor={metricas.verificados} verde />
        <MetricCard titulo="Trabajadores" valor={metricas.trabajadores} />
        <MetricCard titulo="Admins" valor={metricas.admins} ambar />
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, correo, teléfono o zona..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FiltroButton activo={filtro === "todos"} onClick={() => setFiltro("todos")}>
              Todos
            </FiltroButton>
            <FiltroButton activo={filtro === "activos"} onClick={() => setFiltro("activos")}>
              Activos
            </FiltroButton>
            <FiltroButton activo={filtro === "suspendidos"} onClick={() => setFiltro("suspendidos")}>
              Suspendidos
            </FiltroButton>
            <FiltroButton activo={filtro === "verificados"} onClick={() => setFiltro("verificados")}>
              Verificados
            </FiltroButton>
            <FiltroButton activo={filtro === "trabajadores"} onClick={() => setFiltro("trabajadores")}>
              Trabajadores
            </FiltroButton>
            <FiltroButton activo={filtro === "admins"} onClick={() => setFiltro("admins")}>
              Admins
            </FiltroButton>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {usuariosFiltrados.length === 0 ? (
          <EmptyCard texto="No se encontraron usuarios con esos filtros." />
        ) : (
          usuariosFiltrados.map((usuario) => (
            <article
              key={usuario.id}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 text-xl font-bold text-slate-700">
                    {usuario.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={usuario.foto_url}
                        alt={usuario.nombre_completo}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      usuario.nombre_completo?.charAt(0)?.toUpperCase() || "U"
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {usuario.nombre_completo}
                      </h3>

                      {usuario.verificado && (
                        <Badge texto="Verificado" icon={<BadgeCheck size={14} />} color="emerald" />
                      )}

                      {usuario.es_admin && (
                        <Badge texto="Admin" icon={<Crown size={14} />} color="amber" />
                      )}

                      {!usuario.activo && (
                        <Badge texto="Suspendido" icon={<Ban size={14} />} color="red" />
                      )}
                    </div>

                    <div className="mt-2 grid gap-1 text-sm text-slate-500">
                      <InfoLine icon={<Mail size={15} />} texto={usuario.correo || "Sin correo"} />
                      <InfoLine icon={<Phone size={15} />} texto={usuario.telefono || "Sin teléfono"} />
                      <InfoLine icon={<MapPin size={15} />} texto={usuario.zona || "Zona no registrada"} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {usuario.es_cliente && <SmallRole texto="Cliente" />}
                      {usuario.es_trabajador && <SmallRole texto="Trabajador" />}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {usuario.activo ? (
                    <button
                      type="button"
                      onClick={() => cambiarActivoUsuario(usuario, false)}
                      disabled={procesandoId === usuario.id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
                    >
                      {procesandoId === usuario.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Ban size={16} />
                      )}
                      Suspender
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cambiarActivoUsuario(usuario, true)}
                      disabled={procesandoId === usuario.id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
                    >
                      {procesandoId === usuario.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Activar
                    </button>
                  )}

                  {usuario.es_admin ? (
                    <button
                      type="button"
                      onClick={() => cambiarAdminUsuario(usuario, false)}
                      disabled={procesandoId === usuario.id || usuario.id === adminId}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      Quitar admin
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cambiarAdminUsuario(usuario, true)}
                      disabled={procesandoId === usuario.id}
                      className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-70"
                    >
                      <ShieldAlert size={16} />
                      Volver admin
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function MetricCard({
  titulo,
  valor,
  verde = false,
  rojo = false,
  ambar = false,
}: {
  titulo: string;
  valor: number;
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
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${clases}`}>
        <UserCheck size={21} />
      </div>
      <p className="text-sm font-semibold text-slate-500">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}

function FiltroButton({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        activo
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({
  texto,
  icon,
  color,
}: {
  texto: string;
  icon: React.ReactNode;
  color: "emerald" | "amber" | "red";
}) {
  const colores = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${colores[color]}`}
    >
      {icon}
      {texto}
    </span>
  );
}

function InfoLine({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span>{texto}</span>
    </div>
  );
}

function SmallRole({ texto }: { texto: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      {texto}
    </span>
  );
}

function EmptyCard({ texto }: { texto: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500">
      {texto}
    </div>
  );
}