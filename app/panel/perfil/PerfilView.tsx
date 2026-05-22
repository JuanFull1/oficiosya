"use client";

import { useEffect, useMemo, useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BadgeCheck,
  ShieldCheck,
  Home,
  Navigation,
  Building2,
  CalendarDays,
  Camera,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";

type UbicacionItem = {
  id: number;
  nombre: string;
};

type PerfilExtendido = {
  id?: string;
  nombre_completo?: string | null;
  correo?: string | null;
  telefono?: string | null;
  zona?: string | null;
  provincia_id?: number | null;
  canton_id?: number | null;
  parroquia_id?: number | null;
  barrio_manual?: string | null;
  sector_manual?: string | null;
  referencia_direccion?: string | null;
  fecha_nacimiento?: string | null;
  foto_url?: string | null;
  verificado?: boolean | null;
  es_cliente?: boolean | null;
  es_trabajador?: boolean | null;
};

type CachePerfil = {
  usuarioId: string;
  nombreCompleto: string;
  telefono: string;
  zona: string;
  provinciaId: string;
  cantonId: string;
  parroquiaId: string;
  barrioManual: string;
  sectorManual: string;
  referenciaDireccion: string;
  fechaNacimiento: string;
  fotoUrl: string;
};

const CACHE_BASE_KEY = "oficiosya-perfil-cache";

const obtenerCacheKey = (usuarioId?: string | null) =>
  usuarioId ? `${CACHE_BASE_KEY}-${usuarioId}` : CACHE_BASE_KEY;
const BUCKET_FOTOS = "fotos-perfil";

const leerCachePerfil = (perfil: PerfilExtendido): CachePerfil => {
  if (typeof window === "undefined") {
    return {
      usuarioId: perfil.id || "",
      nombreCompleto: perfil.nombre_completo || "",
      telefono: perfil.telefono || "",
      zona: perfil.zona || "",
      provinciaId: perfil.provincia_id ? String(perfil.provincia_id) : "",
      cantonId: perfil.canton_id ? String(perfil.canton_id) : "",
      parroquiaId: perfil.parroquia_id ? String(perfil.parroquia_id) : "",
      barrioManual: perfil.barrio_manual || "",
      sectorManual: perfil.sector_manual || "",
      referenciaDireccion: perfil.referencia_direccion || "",
      fechaNacimiento: perfil.fecha_nacimiento || "",
      fotoUrl: perfil.foto_url || "",
    };
  }

  try {
    const cache = localStorage.getItem(obtenerCacheKey(perfil.id));

    if (cache) {
      const data = JSON.parse(cache) as Partial<CachePerfil>;

      return {
        usuarioId: data.usuarioId || perfil.id || "",
        nombreCompleto: data.nombreCompleto || perfil.nombre_completo || "",
        telefono: data.telefono || perfil.telefono || "",
        zona: data.zona || perfil.zona || "",
        provinciaId:
          data.provinciaId ||
          (perfil.provincia_id ? String(perfil.provincia_id) : ""),
        cantonId:
          data.cantonId || (perfil.canton_id ? String(perfil.canton_id) : ""),
        parroquiaId:
          data.parroquiaId ||
          (perfil.parroquia_id ? String(perfil.parroquia_id) : ""),
        barrioManual: data.barrioManual || perfil.barrio_manual || "",
        sectorManual: data.sectorManual || perfil.sector_manual || "",
        referenciaDireccion:
          data.referenciaDireccion || perfil.referencia_direccion || "",
        fechaNacimiento: data.fechaNacimiento || perfil.fecha_nacimiento || "",
        fotoUrl: data.fotoUrl || perfil.foto_url || "",
      };
    }
  } catch {
    console.warn("No se pudo leer el caché del perfil.");
  }

  return {
    usuarioId: perfil.id || "",
    nombreCompleto: perfil.nombre_completo || "",
    telefono: perfil.telefono || "",
    zona: perfil.zona || "",
    provinciaId: perfil.provincia_id ? String(perfil.provincia_id) : "",
    cantonId: perfil.canton_id ? String(perfil.canton_id) : "",
    parroquiaId: perfil.parroquia_id ? String(perfil.parroquia_id) : "",
    barrioManual: perfil.barrio_manual || "",
    sectorManual: perfil.sector_manual || "",
    referenciaDireccion: perfil.referencia_direccion || "",
    fechaNacimiento: perfil.fecha_nacimiento || "",
    fotoUrl: perfil.foto_url || "",
  };
};

const guardarCachePerfil = (data: CachePerfil) => {
  try {
    localStorage.setItem(obtenerCacheKey(data.usuarioId), JSON.stringify(data));
  } catch {
    console.warn("No se pudo guardar el caché del perfil.");
  }
};

export default function PerfilView() {
  const { estilos, modoOscuro, perfil, correo } = usePanelContext();

  const perfilActual = perfil as PerfilExtendido;
  const [cacheInicial] = useState(() => leerCachePerfil(perfilActual));

  const [usuarioId, setUsuarioId] = useState(cacheInicial.usuarioId);
  const [nombreCompleto, setNombreCompleto] = useState(
    cacheInicial.nombreCompleto
  );
  const [telefono, setTelefono] = useState(cacheInicial.telefono);
  const [correoPerfil, setCorreoPerfil] = useState("");
  const [zona, setZona] = useState(cacheInicial.zona);

  const correoMostrado =
    correo || correoPerfil || perfilActual.correo || "";

  const [fechaNacimiento, setFechaNacimiento] = useState(
    cacheInicial.fechaNacimiento
  );

  const [fotoUrl, setFotoUrl] = useState(cacheInicial.fotoUrl);
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState(cacheInicial.fotoUrl);

  const [provinciaId, setProvinciaId] = useState(cacheInicial.provinciaId);
  const [cantonId, setCantonId] = useState(cacheInicial.cantonId);
  const [parroquiaId, setParroquiaId] = useState(cacheInicial.parroquiaId);

  const [barrioManual, setBarrioManual] = useState(cacheInicial.barrioManual);
  const [sectorManual, setSectorManual] = useState(cacheInicial.sectorManual);
  const [referenciaDireccion, setReferenciaDireccion] = useState(
    cacheInicial.referenciaDireccion
  );

  const [provincias, setProvincias] = useState<UbicacionItem[]>([]);
  const [cantones, setCantones] = useState<UbicacionItem[]>([]);
  const [parroquias, setParroquias] = useState<UbicacionItem[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const provinciaSeleccionada = useMemo(() => {
    return provincias.find((item) => String(item.id) === provinciaId);
  }, [provincias, provinciaId]);

  const cantonSeleccionado = useMemo(() => {
    return cantones.find((item) => String(item.id) === cantonId);
  }, [cantones, cantonId]);

  const parroquiaSeleccionada = useMemo(() => {
    return parroquias.find((item) => String(item.id) === parroquiaId);
  }, [parroquias, parroquiaId]);

  const zonaGenerada = useMemo(() => {
    return [
      sectorManual.trim(),
      barrioManual.trim(),
      parroquiaSeleccionada?.nombre,
      cantonSeleccionado?.nombre,
      provinciaSeleccionada?.nombre,
    ]
      .filter(Boolean)
      .join(", ");
  }, [
    sectorManual,
    barrioManual,
    parroquiaSeleccionada,
    cantonSeleccionado,
    provinciaSeleccionada,
  ]);

  const fechaNacimientoTexto = useMemo(() => {
    if (!fechaNacimiento) return "Sin fecha registrada";

    const fecha = new Date(`${fechaNacimiento}T00:00:00`);

    if (Number.isNaN(fecha.getTime())) return "Sin fecha registrada";

    return fecha.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [fechaNacimiento]);

  const guardarCacheActual = (fotoFinal = fotoUrl) => {
    guardarCachePerfil({
      usuarioId,
      nombreCompleto,
      telefono,
      zona: zonaGenerada || zona,
      provinciaId,
      cantonId,
      parroquiaId,
      barrioManual,
      sectorManual,
      referenciaDireccion,
      fechaNacimiento,
      fotoUrl: fotoFinal || "",
    });
  };

  const cargarProvincias = async () => {
    const { data, error } = await supabase
      .from("provincias")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error al cargar provincias:", error);
      return;
    }

    setProvincias((data || []) as UbicacionItem[]);
  };

  const cargarCantones = async (idProvincia: string) => {
    if (!idProvincia) {
      setCantones([]);
      return;
    }

    const { data, error } = await supabase
      .from("cantones")
      .select("id, nombre")
      .eq("provincia_id", Number(idProvincia))
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error al cargar cantones:", error);
      setCantones([]);
      return;
    }

    setCantones((data || []) as UbicacionItem[]);
  };

  const cargarParroquias = async (idCanton: string) => {
    if (!idCanton) {
      setParroquias([]);
      return;
    }

    const { data, error } = await supabase
      .from("parroquias")
      .select("id, nombre")
      .eq("canton_id", Number(idCanton))
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error al cargar parroquias:", error);
      setParroquias([]);
      return;
    }

    setParroquias((data || []) as UbicacionItem[]);
  };

  const aplicarPerfil = async (data: PerfilExtendido) => {
    const nuevoUsuarioId = data.id || "";
    const nuevoNombre = data.nombre_completo || "";
    const nuevoCorreo = data.correo || "";
    const nuevoTelefono = data.telefono || "";
    const nuevaZona = data.zona || "";
    const nuevaFechaNacimiento = data.fecha_nacimiento || "";
    const nuevaFoto = data.foto_url || "";

    const nuevaProvinciaId = data.provincia_id ? String(data.provincia_id) : "";
    const nuevoCantonId = data.canton_id ? String(data.canton_id) : "";
    const nuevaParroquiaId = data.parroquia_id ? String(data.parroquia_id) : "";

    const nuevoBarrio = data.barrio_manual || "";
    const nuevoSector = data.sector_manual || "";
    const nuevaReferencia = data.referencia_direccion || "";

    setUsuarioId(nuevoUsuarioId);
    setNombreCompleto(nuevoNombre);
    setCorreoPerfil(nuevoCorreo);
    setTelefono(nuevoTelefono);
    setZona(nuevaZona);
    setFechaNacimiento(nuevaFechaNacimiento);
    setFotoUrl(nuevaFoto);
    setPreviewFoto(nuevaFoto);
    setArchivoFoto(null);

    setProvinciaId(nuevaProvinciaId);
    setCantonId(nuevoCantonId);
    setParroquiaId(nuevaParroquiaId);

    setBarrioManual(nuevoBarrio);
    setSectorManual(nuevoSector);
    setReferenciaDireccion(nuevaReferencia);

    guardarCachePerfil({
      usuarioId: nuevoUsuarioId,
      nombreCompleto: nuevoNombre,
      telefono: nuevoTelefono,
      zona: nuevaZona,
      provinciaId: nuevaProvinciaId,
      cantonId: nuevoCantonId,
      parroquiaId: nuevaParroquiaId,
      barrioManual: nuevoBarrio,
      sectorManual: nuevoSector,
      referenciaDireccion: nuevaReferencia,
      fechaNacimiento: nuevaFechaNacimiento,
      fotoUrl: nuevaFoto,
    });

    if (nuevaProvinciaId) {
      await cargarCantones(nuevaProvinciaId);
    }

    if (nuevoCantonId) {
      await cargarParroquias(nuevoCantonId);
    }
  };

  const cargarUsuarioYPerfil = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setUsuarioId(user.id);

    const { data, error } = await supabase
      .from("perfiles")
      .select(
        `
        id,
        nombre_completo,
        correo,
        telefono,
        zona,
        provincia_id,
        canton_id,
        parroquia_id,
        barrio_manual,
        sector_manual,
        referencia_direccion,
        fecha_nacimiento,
        foto_url,
        verificado,
        es_cliente,
        es_trabajador
      `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error al cargar perfil:", error);
      return;
    }

    if (data) {
      await aplicarPerfil(data as PerfilExtendido);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      await cargarProvincias();

      if (provinciaId) {
        await cargarCantones(provinciaId);
      }

      if (cantonId) {
        await cargarParroquias(cantonId);
      }

      await cargarUsuarioYPerfil();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const cambiarProvincia = async (valor: string) => {
    setProvinciaId(valor);
    setCantonId("");
    setParroquiaId("");
    setCantones([]);
    setParroquias([]);

    if (valor) {
      await cargarCantones(valor);
    }
  };

  const cambiarCanton = async (valor: string) => {
    setCantonId(valor);
    setParroquiaId("");
    setParroquias([]);

    if (valor) {
      await cargarParroquias(valor);
    }
  };

  const seleccionarFoto = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen válida.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen no debe superar los 2 MB.");
      return;
    }

    setError("");
    setArchivoFoto(file);
    setPreviewFoto(URL.createObjectURL(file));
  };

  const subirFotoPerfil = async () => {
    if (!archivoFoto || !usuarioId) return fotoUrl || null;

    const extension = archivoFoto.name.split(".").pop() || "jpg";
    const ruta = `${usuarioId}/perfil-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(ruta, archivoFoto, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error al subir foto:", uploadError);
      throw new Error(
        `No se pudo subir la foto. Verifica que exista el bucket "${BUCKET_FOTOS}" en Supabase Storage.`
      );
    }

    const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta);

    return data.publicUrl;
  };

  const guardarPerfil = async () => {
    setError("");
    setMensaje("");

    if (!usuarioId) {
      setError("No se pudo identificar al usuario.");
      return;
    }

    if (!nombreCompleto.trim()) {
      setError("Ingresa tu nombre completo.");
      return;
    }

    try {
      setGuardando(true);

      const fotoFinal = await subirFotoPerfil();
      const zonaFinal = zonaGenerada || zona.trim() || null;

      const { error } = await supabase
        .from("perfiles")
        .update({
          nombre_completo: nombreCompleto.trim(),
          telefono: telefono.trim() || null,
          provincia_id: provinciaId ? Number(provinciaId) : null,
          canton_id: cantonId ? Number(cantonId) : null,
          parroquia_id: parroquiaId ? Number(parroquiaId) : null,
          barrio_manual: barrioManual.trim() || null,
          sector_manual: sectorManual.trim() || null,
          referencia_direccion: referenciaDireccion.trim() || null,
          zona: zonaFinal,
          foto_url: fotoFinal,
        })
        .eq("id", usuarioId);

      if (error) {
        console.error("Error al guardar perfil:", error);
        setError("No se pudo guardar la información.");
        return;
      }

      setFotoUrl(fotoFinal || "");
      setPreviewFoto(fotoFinal || "");
      setZona(zonaFinal || "");
      setArchivoFoto(null);

      guardarCacheActual(fotoFinal || "");

      await cargarUsuarioYPerfil();

      setMensaje("Perfil actualizado correctamente.");
    } catch (error) {
      console.error("Error inesperado al guardar perfil:", error);
      setError(
        error instanceof Error ? error.message : "Ocurrió un error inesperado."
      );
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
              <User className="w-4 h-4" />
              Perfil
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
            >
              Mi perfil
            </h1>

            <p className={`mt-2 max-w-3xl ${estilos.textoSecundario}`}>
              Administra tu información personal dentro de la plataforma.
            </p>
          </div>

          {perfilActual.verificado ? (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-[#fff6da] text-[#a36a00] px-4 py-3 font-bold">
              <BadgeCheck className="w-5 h-5" />
              Cuenta verificada
            </div>
          ) : (
            <div
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-bold ${
                modoOscuro
                  ? "bg-[#111827] text-slate-300 border border-[#334155]"
                  : "bg-[#f0f2f5] text-gray-600"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              Sin verificación
            </div>
          )}
        </div>
      </section>

      <section
        className={`rounded-[18px] border overflow-hidden ${estilos.tarjeta}`}
      >
        <div className={`px-5 sm:px-6 py-5 border-b ${estilos.borde}`}>
          <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
            Datos personales
          </h2>

          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            Esta información te identifica dentro de la plataforma.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
            <div className="space-y-4">
              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center shrink-0">
                    {previewFoto ? (
                      <img
                        src={previewFoto}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10" />
                    )}
                  </div>

                  <div className="flex-1">
                    <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                      Foto de perfil
                    </p>
                    <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                      Sube una imagen clara para tu perfil público.
                    </p>

                    <label className="inline-flex items-center gap-2 mt-3 rounded-2xl bg-[#0B3C7F] text-white px-4 py-3 font-bold cursor-pointer hover:bg-[#092f63] transition">
                      <Camera className="w-5 h-5" />
                      Seleccionar foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          seleccionarFoto(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Nombre completo
                </label>

                <div className="relative mt-1">
                  <User className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    type="text"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 ${estilos.inputBase}`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Correo electrónico
                </label>

                <div className="relative mt-1">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    type="email"
                    value={correoMostrado}
                    disabled
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 opacity-70 ${
                      modoOscuro
                        ? "bg-[#0f172a] border-[#334155] text-white"
                        : "bg-[#f0f2f5] border-gray-200 text-gray-600"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Fecha de nacimiento
                </label>

                <div className="relative mt-1">
                  <CalendarDays className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    type="text"
                    value={fechaNacimientoTexto}
                    disabled
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 opacity-70 ${
                      modoOscuro
                        ? "bg-[#0f172a] border-[#334155] text-white"
                        : "bg-[#f0f2f5] border-gray-200 text-gray-600"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-sm font-bold ${estilos.textoPrincipal}`}>
                  Teléfono
                </label>

                <div className="relative mt-1">
                  <Phone className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ejemplo: 0999999999"
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 ${estilos.inputBase}`}
                  />
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-[#0B3C7F]" />
                  <h3 className={`font-extrabold ${estilos.textoPrincipal}`}>
                    Ubicación general
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      className={`text-sm font-bold ${estilos.textoPrincipal}`}
                    >
                      Provincia
                    </label>

                    <select
                      value={provinciaId}
                      onChange={(e) => cambiarProvincia(e.target.value)}
                      className={`mt-1 w-full rounded-2xl border px-4 py-3 ${estilos.inputBase}`}
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
                    <label
                      className={`text-sm font-bold ${estilos.textoPrincipal}`}
                    >
                      Cantón
                    </label>

                    <select
                      value={cantonId}
                      onChange={(e) => cambiarCanton(e.target.value)}
                      disabled={!provinciaId}
                      className={`mt-1 w-full rounded-2xl border px-4 py-3 disabled:opacity-60 disabled:cursor-not-allowed ${estilos.inputBase}`}
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
                    <label
                      className={`text-sm font-bold ${estilos.textoPrincipal}`}
                    >
                      Parroquia
                    </label>

                    <select
                      value={parroquiaId}
                      onChange={(e) => setParroquiaId(e.target.value)}
                      disabled={!cantonId}
                      className={`mt-1 w-full rounded-2xl border px-4 py-3 disabled:opacity-60 disabled:cursor-not-allowed ${estilos.inputBase}`}
                    >
                      <option value="">Selecciona parroquia</option>
                      {parroquias.map((parroquia) => (
                        <option key={parroquia.id} value={parroquia.id}>
                          {parroquia.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label
                      className={`text-sm font-bold ${estilos.textoPrincipal}`}
                    >
                      Barrio
                    </label>

                    <div className="relative mt-1">
                      <Home className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                      <input
                        value={barrioManual}
                        onChange={(e) => setBarrioManual(e.target.value)}
                        placeholder="Ejemplo: Huachi Grande"
                        className={`w-full rounded-2xl border pl-12 pr-4 py-3 ${estilos.inputBase}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className={`text-sm font-bold ${estilos.textoPrincipal}`}
                    >
                      Sector
                    </label>

                    <div className="relative mt-1">
                      <Building2 className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                      <input
                        value={sectorManual}
                        onChange={(e) => setSectorManual(e.target.value)}
                        placeholder="Ejemplo: sector centro"
                        className={`w-full rounded-2xl border pl-12 pr-4 py-3 ${estilos.inputBase}`}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    className={`text-sm font-bold ${estilos.textoPrincipal}`}
                  >
                    Referencia de dirección
                  </label>

                  <div className="relative mt-1">
                    <Navigation className="w-5 h-5 text-gray-400 absolute left-4 top-4" />

                    <textarea
                      rows={3}
                      value={referenciaDireccion}
                      onChange={(e) => setReferenciaDireccion(e.target.value)}
                      placeholder="Ejemplo: cerca del parque, frente a la farmacia, casa color blanco..."
                      className={`w-full rounded-2xl border pl-12 pr-4 py-3 resize-none ${estilos.inputBase}`}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    className={`text-sm font-bold ${estilos.textoPrincipal}`}
                  >
                    Zona generada
                  </label>

                  <div className="relative mt-1">
                    <MapPin className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                    <input
                      value={zonaGenerada || zona}
                      readOnly
                      className={`w-full rounded-2xl border pl-12 pr-4 py-3 opacity-80 ${
                        modoOscuro
                          ? "bg-[#111827] border-[#334155] text-slate-300"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    />
                  </div>
                </div>
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
                onClick={guardarPerfil}
                disabled={guardando}
                className="w-full sm:w-auto rounded-2xl bg-[#0B3C7F] text-white px-6 py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {guardando ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>

            <aside
              className={`rounded-[22px] border p-5 ${estilos.tarjetaSuave}`}
            >
              <div className="w-16 h-16 rounded-3xl bg-[#e7f0ff] text-[#0B3C7F] flex items-center justify-center mb-4 overflow-hidden">
                {previewFoto ? (
                  <img
                    src={previewFoto}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8" />
                )}
              </div>

              <h3 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
                Estado de cuenta
              </h3>

              <p className={`text-sm mt-2 ${estilos.textoSecundario}`}>
                Mantén tu información actualizada para una mejor experiencia
                dentro de la plataforma.
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                {perfilActual.es_cliente && (
                  <span className="px-3 py-1 rounded-full bg-[#e7f0ff] text-[#0B3C7F] text-xs font-bold">
                    Cliente
                  </span>
                )}

                {perfilActual.es_trabajador && (
                  <span className="px-3 py-1 rounded-full bg-[#eaf8ef] text-[#166534] text-xs font-bold">
                    Trabajador
                  </span>
                )}

                {perfilActual.verificado && (
                  <span className="px-3 py-1 rounded-full bg-[#fff6da] text-[#a36a00] text-xs font-bold">
                    Verificado
                  </span>
                )}
              </div>

              <div
                className={`mt-5 rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-white border-gray-100"
                }`}
              >
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Ubicación actual
                </p>
                <p className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}>
                  {zonaGenerada || zona || "Sin ubicación registrada"}
                </p>
              </div>

              <div
                className={`mt-4 rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-white border-gray-100"
                }`}
              >
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Contacto
                </p>
                <p className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}>
                  {telefono || "Sin teléfono registrado"}
                </p>
              </div>

              <div
                className={`mt-4 rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#0f172a] border-[#334155]"
                    : "bg-white border-gray-100"
                }`}
              >
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Fecha de nacimiento
                </p>
                <p className={`mt-1 text-sm font-bold ${estilos.textoPrincipal}`}>
                  {fechaNacimientoTexto}
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}