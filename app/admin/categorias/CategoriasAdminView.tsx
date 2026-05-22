"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Search,
  Tags,
  ToggleLeft,
  ToggleRight,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Categoria = {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activa: boolean;
  creado_en: string;
};

const CACHE_KEY = "oficiosya-admin-categorias-cache";

export default function CategoriasAdminView() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "activas" | "inactivas">(
    "todas"
  );

  const [modalAbierto, setModalAbierto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] =
    useState<Categoria | null>(null);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activa, setActiva] = useState(true);

  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      setCategorias(JSON.parse(raw) as Categoria[]);
    } catch (err) {
      console.error("No se pudo leer cache categorías admin:", err);
    }
  }, []);

  const guardarCache = useCallback((data: Categoria[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("No se pudo guardar cache categorías admin:", err);
    }
  }, []);

  const cargarCategorias = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const { data, error: categoriasError } = await supabase
        .from("categorias")
        .select("id,nombre,descripcion,icono,activa,creado_en")
        .order("nombre", { ascending: true });

      if (categoriasError) {
        console.error("Error al cargar categorías:", categoriasError);
        setError("No se pudieron cargar las categorías.");
        return;
      }

      const lista = (data || []) as Categoria[];
      setCategorias(lista);
      guardarCache(lista);
    } catch (err) {
      console.error("Error general categorías admin:", err);
      setError("Ocurrió un error al sincronizar categorías.");
    } finally {
      setSincronizando(false);
    }
  }, [guardarCache]);

  useEffect(() => {
    leerCache();
    cargarCategorias();
  }, [leerCache, cargarCategorias]);

  const metricas = useMemo(() => {
    return {
      total: categorias.length,
      activas: categorias.filter((c) => c.activa).length,
      inactivas: categorias.filter((c) => !c.activa).length,
    };
  }, [categorias]);

  const categoriasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return categorias.filter((categoria) => {
      const coincideTexto =
        !texto ||
        categoria.nombre.toLowerCase().includes(texto) ||
        categoria.descripcion?.toLowerCase().includes(texto);

      const coincideFiltro =
        filtro === "todas" ||
        (filtro === "activas" && categoria.activa) ||
        (filtro === "inactivas" && !categoria.activa);

      return coincideTexto && coincideFiltro;
    });
  }, [categorias, busqueda, filtro]);

  const abrirCrear = () => {
    setCategoriaEditando(null);
    setNombre("");
    setDescripcion("");
    setActiva(true);
    setMensaje("");
    setError("");
    setModalAbierto(true);
  };

  const abrirEditar = (categoria: Categoria) => {
    setCategoriaEditando(categoria);
    setNombre(categoria.nombre);
    setDescripcion(categoria.descripcion || "");
    setActiva(categoria.activa);
    setMensaje("");
    setError("");
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setCategoriaEditando(null);
    setNombre("");
    setDescripcion("");
    setActiva(true);
  };

  const guardarCategoria = async () => {
    setMensaje("");
    setError("");

    const nombreLimpio = nombre.trim();
    const descripcionLimpia = descripcion.trim();

    if (!nombreLimpio) {
      setError("Ingresa el nombre de la categoría.");
      return;
    }

    const nombreDuplicado = categorias.some(
      (categoria) =>
        categoria.nombre.toLowerCase() === nombreLimpio.toLowerCase() &&
        categoria.id !== categoriaEditando?.id
    );

    if (nombreDuplicado) {
      setError("Ya existe una categoría con ese nombre.");
      return;
    }

    setGuardando(true);

    if (categoriaEditando) {
      const { data, error: updateError } = await supabase
        .from("categorias")
        .update({
          nombre: nombreLimpio,
          descripcion: descripcionLimpia || null,
          icono: null,
          activa,
        })
        .eq("id", categoriaEditando.id)
        .select("id,nombre,descripcion,icono,activa,creado_en")
        .single();

      if (updateError) {
        console.error("Error al actualizar categoría:", updateError);
        setError("No se pudo actualizar la categoría.");
        setGuardando(false);
        return;
      }

      const actualizada = data as Categoria;

      setCategorias((prev) => {
        const nuevaLista = prev
          .map((item) => (item.id === actualizada.id ? actualizada : item))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        guardarCache(nuevaLista);
        return nuevaLista;
      });

      setMensaje("Categoría actualizada correctamente.");
    } else {
      const { data, error: insertError } = await supabase
        .from("categorias")
        .insert({
          nombre: nombreLimpio,
          descripcion: descripcionLimpia || null,
          icono: null,
          activa,
        })
        .select("id,nombre,descripcion,icono,activa,creado_en")
        .single();

      if (insertError) {
        console.error("Error al crear categoría:", insertError);
        setError("No se pudo crear la categoría.");
        setGuardando(false);
        return;
      }

      const nuevaCategoria = data as Categoria;

      setCategorias((prev) => {
        const nuevaLista = [nuevaCategoria, ...prev].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        );

        guardarCache(nuevaLista);
        return nuevaLista;
      });

      setMensaje("Categoría creada correctamente.");
    }

    setGuardando(false);
    cerrarModal();
  };

  const cambiarEstadoCategoria = async (categoria: Categoria) => {
    setMensaje("");
    setError("");
    setProcesandoId(categoria.id);

    const { data, error: updateError } = await supabase
      .from("categorias")
      .update({
        activa: !categoria.activa,
      })
      .eq("id", categoria.id)
      .select("id,nombre,descripcion,icono,activa,creado_en")
      .single();

    if (updateError) {
      console.error("Error al cambiar estado categoría:", updateError);
      setError("No se pudo cambiar el estado de la categoría.");
      setProcesandoId(null);
      return;
    }

    const actualizada = data as Categoria;

    setCategorias((prev) => {
      const nuevaLista = prev.map((item) =>
        item.id === actualizada.id ? actualizada : item
      );

      guardarCache(nuevaLista);
      return nuevaLista;
    });

    setMensaje(
      actualizada.activa
        ? "Categoría activada correctamente."
        : "Categoría desactivada correctamente."
    );

    setProcesandoId(null);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <Tags size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    Gestión de categorías
                  </h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Administra los oficios disponibles para solicitudes y
                  trabajadores.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={abrirCrear}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <Plus size={17} />
              Nueva categoría
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

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard titulo="Total" valor={metricas.total} />
        <MetricCard titulo="Activas" valor={metricas.activas} verde />
        <MetricCard titulo="Inactivas" valor={metricas.inactivas} rojo />
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
              placeholder="Buscar categoría..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FiltroButton
              activo={filtro === "todas"}
              onClick={() => setFiltro("todas")}
            >
              Todas
            </FiltroButton>

            <FiltroButton
              activo={filtro === "activas"}
              onClick={() => setFiltro("activas")}
            >
              Activas
            </FiltroButton>

            <FiltroButton
              activo={filtro === "inactivas"}
              onClick={() => setFiltro("inactivas")}
            >
              Inactivas
            </FiltroButton>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {categoriasFiltradas.length === 0 ? (
          <EmptyCard texto="No se encontraron categorías con esos filtros." />
        ) : (
          categoriasFiltradas.map((categoria) => (
            <article
              key={categoria.id}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-3xl ${
                      categoria.activa
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    <Tags size={24} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {categoria.nombre}
                      </h3>

                      {categoria.activa ? (
                        <EstadoBadge texto="Activa" verde />
                      ) : (
                        <EstadoBadge texto="Inactiva" rojo />
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {categoria.descripcion ||
                        "Sin descripción registrada para esta categoría."}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Creada: {formatearFecha(categoria.creado_en)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => abrirEditar(categoria)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Edit3 size={16} />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => cambiarEstadoCategoria(categoria)}
                    disabled={procesandoId === categoria.id}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-70 ${
                      categoria.activa
                        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {procesandoId === categoria.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : categoria.activa ? (
                      <ToggleLeft size={17} />
                    ) : (
                      <ToggleRight size={17} />
                    )}

                    {categoria.activa ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {categoriaEditando ? "Editar categoría" : "Nueva categoría"}
                </h2>

                <p className="text-sm text-slate-500">
                  Define el nombre, descripción y estado.
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarModal}
                className="rounded-2xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nombre de la categoría
                </label>

                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ejemplo: Electricidad"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Descripción
                </label>

                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ejemplo: Instalaciones, reparaciones y mantenimiento eléctrico."
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiva((prev) => !prev)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  activa
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                <span>{activa ? "Categoría activa" : "Categoría inactiva"}</span>
                {activa ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              </button>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={guardarCategoria}
                  disabled={guardando}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                >
                  {guardando ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}

                  {categoriaEditando ? "Guardar cambios" : "Crear categoría"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  titulo,
  valor,
  verde = false,
  rojo = false,
}: {
  titulo: string;
  valor: number;
  verde?: boolean;
  rojo?: boolean;
}) {
  let clases = "bg-slate-100 text-slate-700";
  if (verde) clases = "bg-emerald-100 text-emerald-700";
  if (rojo) clases = "bg-red-100 text-red-700";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${clases}`}
      >
        <Tags size={21} />
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

function EstadoBadge({
  texto,
  verde = false,
  rojo = false,
}: {
  texto: string;
  verde?: boolean;
  rojo?: boolean;
}) {
  let clases = "bg-slate-100 text-slate-700";
  if (verde) clases = "bg-emerald-100 text-emerald-700";
  if (rojo) clases = "bg-red-100 text-red-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${clases}`}>
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

function formatearFecha(fecha: string) {
  if (!fecha) return "";

  try {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(fecha));
  } catch {
    return "";
  }
}