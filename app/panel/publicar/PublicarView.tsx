"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  Tag,
  FileText,
  MapPin,
  CalendarDays,
  DollarSign,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  X,
  LocateFixed,
  Check,
  Navigation,
} from "lucide-react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/lib/supabase";
import { usePanelContext } from "../PanelLayout";

type Categoria = {
  id: string;
  nombre: string;
};

type UbicacionItem = {
  id: number;
  nombre: string;
};

type Coordenadas = {
  lat: number;
  lng: number;
};

type PerfilUbicacion = {
  provincia_id: number | null;
  canton_id: number | null;
  parroquia_id: number | null;
  barrio_id: number | null;
  sector_id: number | null;
  barrio_manual: string | null;
  sector_manual: string | null;
  zona: string | null;
  referencia_direccion: string | null;
};

type SolicitudPublicada = {
  titulo: string;
  categoria: string;
  zona: string;
  presupuesto: string;
  fechaPreferida: string;
  adjuntos: number;
};

type ConfiguracionPublicacion = {
  max_solicitudes: number;
  ventana_minutos: number;
  activo: boolean;
};



type UbicacionDetectada = {
  provincia: string;
  canton: string;
  parroquia: string;
  texto: string;
};

const CENTRO_INICIAL: Coordenadas = {
  lat: -1.24908,
  lng: -78.61675,
};

const marcadorIcono = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: #0B3C7F;
      border: 4px solid white;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const marcadorMiniIcono = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 9999px;
      background: #0B3C7F;
      border: 3px solid white;
      box-shadow: 0 8px 18px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function SelectorMapa({
  posicion,
  setPosicion,
}: {
  posicion: Coordenadas | null;
  setPosicion: (posicion: Coordenadas) => void;
}) {
  useMapEvents({
    click(event) {
      setPosicion({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  if (!posicion) return null;

  return <Marker position={[posicion.lat, posicion.lng]} icon={marcadorIcono} />;
}

function RecentrarMapa({ posicion }: { posicion: Coordenadas | null }) {
  const map = useMap();

  useEffect(() => {
    if (posicion) {
      map.setView([posicion.lat, posicion.lng], 16);
    }
  }, [map, posicion]);

  return null;
}

export default function PublicarView() {
  const router = useRouter();
  const { estilos, modoOscuro, perfil } = usePanelContext();

  const [usuarioId, setUsuarioId] = useState("");

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasCargando, setCategoriasCargando] = useState(true);

  const [provincias, setProvincias] = useState<UbicacionItem[]>([]);
  const [cantones, setCantones] = useState<UbicacionItem[]>([]);
  const [parroquias, setParroquias] = useState<UbicacionItem[]>([]);
  const [barrios, setBarrios] = useState<UbicacionItem[]>([]);
  const [sectores, setSectores] = useState<UbicacionItem[]>([]);

  const [provinciaId, setProvinciaId] = useState("");
  const [cantonId, setCantonId] = useState("");
  const [parroquiaId, setParroquiaId] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [sectorId, setSectorId] = useState("");

  const [barrioManual, setBarrioManual] = useState("");
  const [sectorManual, setSectorManual] = useState("");

  const [categoriaId, setCategoriaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [zona, setZona] = useState(perfil.zona || "");
  const [referenciaDireccion, setReferenciaDireccion] = useState("");
  const [fechaPreferida, setFechaPreferida] = useState("");
  const [presupuesto, setPresupuesto] = useState("");

  const [modalMapaAbierto, setModalMapaAbierto] = useState(false);
  const [posicionMapa, setPosicionMapa] = useState<Coordenadas | null>(null);
  const [ubicacionConfirmada, setUbicacionConfirmada] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const [verificandoZona, setVerificandoZona] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [advertenciaZona, setAdvertenciaZona] = useState("");
  const [permitirZonaDiferente, setPermitirZonaDiferente] = useState(false);
  const [ubicacionDetectada, setUbicacionDetectada] =
    useState<UbicacionDetectada | null>(null);

  const [archivosAdjuntos, setArchivosAdjuntos] = useState<File[]>([]);
  console.log("Adjuntos seleccionados:", archivosAdjuntos);
  const [subiendoAdjuntos, setSubiendoAdjuntos] = useState(false);
  const [previewsAdjuntos, setPreviewsAdjuntos] = useState<string[]>([]);

  useEffect(() => {
    const nuevasPreviews = archivosAdjuntos.map(archivo => URL.createObjectURL(archivo));
    setPreviewsAdjuntos(nuevasPreviews);

    return () => {
      nuevasPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [archivosAdjuntos]);

  const [solicitudPublicada, setSolicitudPublicada] =
    useState<SolicitudPublicada | null>(null);

const [configPublicacion, setConfigPublicacion] =
  useState<ConfiguracionPublicacion>({
    max_solicitudes: 5,
    ventana_minutos: 10,
    activo: true,
  });


  const centroMapa = useMemo(() => {
    if (posicionMapa) return posicionMapa;
    return CENTRO_INICIAL;
  }, [posicionMapa]);

  const nombreCategoria =
    categorias.find((item) => item.id === categoriaId)?.nombre ||
    "Sin seleccionar";

  const nombreProvincia =
    provincias.find((item) => String(item.id) === provinciaId)?.nombre || "";

  const nombreCanton =
    cantones.find((item) => String(item.id) === cantonId)?.nombre || "";

  const nombreParroquia =
    parroquias.find((item) => String(item.id) === parroquiaId)?.nombre || "";

  const nombreBarrio =
    barrios.find((item) => String(item.id) === barrioId)?.nombre ||
    barrioManual ||
    "";

  const nombreSector =
    sectores.find((item) => String(item.id) === sectorId)?.nombre ||
    sectorManual ||
    "";

  const mostrarBarrioRegistrado = barrios.length > 0 && !barrioManual.trim();

  const mostrarSectorRegistrado =
    sectores.length > 0 && Boolean(barrioId) && !sectorManual.trim();

  useEffect(() => {
    let activo = true;

    const cargarDatosIniciales = async () => {
      try {
        setError("");

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

        const [categoriasRespuesta, provinciasRespuesta, perfilRespuesta] =
          await Promise.all([
            supabase
              .from("categorias")
              .select("id, nombre")
              .eq("activa", true)
              .order("nombre", { ascending: true }),

            supabase
              .from("provincias")
              .select("id, nombre")
              .order("nombre", { ascending: true }),

            supabase
              .from("perfiles")
              .select(
                "provincia_id, canton_id, parroquia_id, barrio_id, sector_id, barrio_manual, sector_manual, zona, referencia_direccion"
              )
              .eq("id", user.id)
              .maybeSingle(),
          ]);

        if (!activo) return;

        if (categoriasRespuesta.error) {
          console.error("Error al cargar categorías:", categoriasRespuesta.error);
          setError("No se pudieron cargar las categorías.");
        }

        if (provinciasRespuesta.error) {
          console.error("Error al cargar provincias:", provinciasRespuesta.error);
          setError("No se pudieron cargar las ubicaciones.");
        }

        setCategorias(categoriasRespuesta.data || []);
        setProvincias(provinciasRespuesta.data || []);
        setCategoriasCargando(false);

        const perfilUbicacion = perfilRespuesta.data as PerfilUbicacion | null;

        if (perfilUbicacion) {
          setProvinciaId(
            perfilUbicacion.provincia_id
              ? String(perfilUbicacion.provincia_id)
              : ""
          );
          setCantonId(
            perfilUbicacion.canton_id ? String(perfilUbicacion.canton_id) : ""
          );
          setParroquiaId(
            perfilUbicacion.parroquia_id
              ? String(perfilUbicacion.parroquia_id)
              : ""
          );
          setBarrioId(
            perfilUbicacion.barrio_id ? String(perfilUbicacion.barrio_id) : ""
          );
          setSectorId(
            perfilUbicacion.sector_id ? String(perfilUbicacion.sector_id) : ""
          );
          setBarrioManual(perfilUbicacion.barrio_manual || "");
          setSectorManual(perfilUbicacion.sector_manual || "");
          setZona(perfilUbicacion.zona || perfil.zona || "");
          setReferenciaDireccion(perfilUbicacion.referencia_direccion || "");
        }
      } catch (error) {
        console.error("Error inesperado al cargar publicación:", error);

        if (activo) {
          setError("Ocurrió un error inesperado.");
          setCategoriasCargando(false);
        }
      }
    };

    cargarDatosIniciales();

    return () => {
      activo = false;
    };
  }, [perfil.zona]);


useEffect(() => {
  let activo = true;

  const cargarConfiguracionPublicacion = async () => {
    const { data, error } = await supabase
      .from("configuracion_publicaciones")
      .select("max_solicitudes, ventana_minutos, activo")
      .eq("clave", "anti_spam_solicitudes")
      .maybeSingle();

    if (!activo) return;

    if (error) {
      console.warn(
        "No existe aún configuración admin de publicaciones. Usando valores por defecto.",
        error
      );
      return;
    }

    if (data) {
      setConfigPublicacion({
        max_solicitudes: data.max_solicitudes ?? 3,
        ventana_minutos: data.ventana_minutos ?? 10,
        activo: data.activo ?? true,
      });
    }
  };

  cargarConfiguracionPublicacion();

  return () => {
    activo = false;
  };
}, []);


  useEffect(() => {
    let activo = true;

    const cargarCantones = async () => {
      if (!provinciaId) {
        setCantones([]);
        return;
      }

      const { data, error } = await supabase
        .from("cantones")
        .select("id, nombre")
        .eq("provincia_id", Number(provinciaId))
        .order("nombre", { ascending: true });

      if (!activo) return;

      if (error) {
        console.error("Error al cargar cantones:", error);
        return;
      }

      setCantones(data || []);
    };

    cargarCantones();

    return () => {
      activo = false;
    };
  }, [provinciaId]);

  useEffect(() => {
    let activo = true;

    const cargarParroquias = async () => {
      if (!cantonId) {
        setParroquias([]);
        return;
      }

      const { data, error } = await supabase
        .from("parroquias")
        .select("id, nombre")
        .eq("canton_id", Number(cantonId))
        .order("nombre", { ascending: true });

      if (!activo) return;

      if (error) {
        console.error("Error al cargar parroquias:", error);
        return;
      }

      setParroquias(data || []);
    };

    cargarParroquias();

    return () => {
      activo = false;
    };
  }, [cantonId]);

  useEffect(() => {
    let activo = true;

    const cargarBarrios = async () => {
      if (!parroquiaId) {
        setBarrios([]);
        return;
      }

      const { data, error } = await supabase
        .from("barrios")
        .select("id, nombre")
        .eq("parroquia_id", Number(parroquiaId))
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (!activo) return;

      if (error) {
        console.error("Error al cargar barrios:", error);
        return;
      }

      setBarrios(data || []);
    };

    cargarBarrios();

    return () => {
      activo = false;
    };
  }, [parroquiaId]);

  useEffect(() => {
    let activo = true;

    const cargarSectores = async () => {
      if (!barrioId) {
        setSectores([]);
        return;
      }

      const { data, error } = await supabase
        .from("sectores")
        .select("id, nombre")
        .eq("barrio_id", Number(barrioId))
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (!activo) return;

      if (error) {
        console.error("Error al cargar sectores:", error);
        return;
      }

      setSectores(data || []);
    };

    cargarSectores();

    return () => {
      activo = false;
    };
  }, [barrioId]);

  useEffect(() => {
    const partes = [
      nombreSector,
      nombreBarrio,
      nombreParroquia,
      nombreCanton,
      nombreProvincia,
    ].filter(Boolean);

    if (partes.length > 0) {
      setZona(partes.join(", "));
    }
  }, [
    nombreSector,
    nombreBarrio,
    nombreParroquia,
    nombreCanton,
    nombreProvincia,
  ]);

  const normalizarTexto = (texto: string) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const detectarZonaPorCoordenadas = async (
    posicion: Coordenadas
  ): Promise<UbicacionDetectada> => {
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${posicion.lat}&lon=${posicion.lng}&zoom=14&addressdetails=1`
    );

    if (!respuesta.ok) {
      throw new Error("No se pudo verificar la zona del mapa.");
    }

    const data = await respuesta.json();
    const address = data.address || {};

    const provinciaDetectada =
      address.state || address.province || address.region || "";

    const cantonDetectado =
      address.city ||
      address.town ||
      address.county ||
      address.municipality ||
      "";

    const parroquiaDetectada =
      address.suburb ||
      address.city_district ||
      address.district ||
      address.village ||
      address.neighbourhood ||
      address.quarter ||
      "";

    return {
      provincia: provinciaDetectada,
      canton: cantonDetectado,
      parroquia: parroquiaDetectada,
      texto: data.display_name || "",
    };
  };

  const limpiarAdvertenciaMapa = () => {
    setAdvertenciaZona("");
    setPermitirZonaDiferente(false);
    setUbicacionDetectada(null);
  };

  const limpiarFormulario = () => {
    setCategoriaId("");
    setTitulo("");
    setDescripcion("");
    setFechaPreferida("");
    setPresupuesto("");
    setPosicionMapa(null);
    setUbicacionConfirmada(false);
    limpiarAdvertenciaMapa();
    setError("");
    setMensaje("");
    setArchivosAdjuntos([]);
    setSubiendoAdjuntos(false);
    setPreviewsAdjuntos([]);
  };

  const usarMiUbicacion = () => {
    setError("");
    limpiarAdvertenciaMapa();

    if (!navigator.geolocation) {
      setError("Tu navegador no permite obtener la ubicación.");
      return;
    }

    setUbicando(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPosicionMapa({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setUbicacionConfirmada(false);
        setUbicando(false);
      },
      (geoError) => {
        console.error("Error de geolocalización:", geoError);

        if (geoError.code === 1) {
          setError("Permite el acceso a la ubicación desde el navegador.");
        } else if (geoError.code === 2) {
          setError("No se pudo detectar tu ubicación actual.");
        } else if (geoError.code === 3) {
          setError(
            "La ubicación tardó demasiado. Intenta otra vez o marca el punto manualmente."
          );
        } else {
          setError("No se pudo obtener tu ubicación.");
        }

        setUbicando(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 60000,
      }
    );
  };

  const confirmarUbicacion = async () => {
    if (!posicionMapa) {
      setError("Selecciona una ubicación en el mapa.");
      return;
    }

    if (!provinciaId || !cantonId || !parroquiaId) {
      setError("Completa provincia, cantón y parroquia antes de confirmar el mapa.");
      return;
    }

    try {
      setError("");
      limpiarAdvertenciaMapa();
      setVerificandoZona(true);

      const detectada = await detectarZonaPorCoordenadas(posicionMapa);
      setUbicacionDetectada(detectada);

      const provinciaFormulario = normalizarTexto(nombreProvincia);
      const cantonFormulario = normalizarTexto(nombreCanton);
      const parroquiaFormulario = normalizarTexto(nombreParroquia);

      const textoMapa = normalizarTexto(
        `${detectada.provincia} ${detectada.canton} ${detectada.parroquia} ${detectada.texto}`
      );

      const coincideProvincia = textoMapa.includes(provinciaFormulario);
      const coincideCanton = textoMapa.includes(cantonFormulario);
      const coincideParroquia = textoMapa.includes(parroquiaFormulario);

      if (!coincideProvincia || !coincideCanton || !coincideParroquia) {
        setAdvertenciaZona(
          "El punto marcado en el mapa parece no coincidir con la provincia, cantón o parroquia seleccionados. Revisa la ubicación o úsala de todos modos si es correcta."
        );
        setPermitirZonaDiferente(true);
        setUbicacionConfirmada(false);
        return;
      }

      setUbicacionConfirmada(true);
      setModalMapaAbierto(false);
    } catch (error) {
      console.error("Error al verificar ubicación:", error);

      setAdvertenciaZona(
        "No se pudo verificar automáticamente la parroquia del mapa. Revisa manualmente si el punto marcado corresponde a la zona seleccionada."
      );
      setPermitirZonaDiferente(true);
      setUbicacionConfirmada(false);
    } finally {
      setVerificandoZona(false);
    }
  };

  const usarUbicacionAunqueNoCoincida = () => {
    if (!posicionMapa) {
      setError("Selecciona una ubicación en el mapa.");
      return;
    }

    setUbicacionConfirmada(true);
    setPermitirZonaDiferente(false);
    setAdvertenciaZona("");
    setModalMapaAbierto(false);
  };


const validarLimitePublicaciones = async () => {
  const { data, error } = await supabase.rpc("validar_limite_publicaciones");

  if (error) {
    console.error("Error al validar límite de publicaciones:", error);
    setError("No se pudo validar el límite de publicaciones.");
    return false;
  }

  const resultado = data as {
    puede_publicar?: boolean;
    mensaje?: string;
  } | null;

  if (!resultado?.puede_publicar) {
    setError(
      resultado?.mensaje ||
        "Has publicado muchas solicitudes en poco tiempo. Intenta más tarde."
    );
    return false;
  }

  return true;
};


  const manejarCambioArchivos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(event.target.files || []);
    const maxArchivos = 5;
    const maxTamano = 5 * 1024 * 1024; // 5MB

    if (archivos.length + archivosAdjuntos.length > maxArchivos) {
      setError(`Máximo ${maxArchivos} imágenes permitidas.`);
      return;
    }

    for (const archivo of archivos) {
      if (!archivo.type.startsWith("image/")) {
        setError("Solo se permiten archivos de imagen.");
        return;
      }
      if (archivo.size > maxTamano) {
        setError("Cada imagen debe ser menor a 5MB.");
        return;
      }
    }

    setArchivosAdjuntos(prev => [...prev, ...archivos]);
    setError("");
  };

  const eliminarArchivo = (index: number) => {
    setArchivosAdjuntos(prev => prev.filter((_, i) => i !== index));
  };


  const publicarSolicitud = async () => {
    setError("");
    setMensaje("");

    if (!usuarioId) {
      setError("No se encontró el usuario autenticado.");
      return;
    }

    if (!categoriaId) {
      setError("Selecciona una categoría.");
      return;
    }

    if (!titulo.trim()) {
      setError("Ingresa un título para la solicitud.");
      return;
    }

    if (!descripcion.trim()) {
      setError("Describe el servicio que necesitas.");
      return;
    }

    if (!provinciaId || !cantonId || !parroquiaId) {
      setError("Completa provincia, cantón y parroquia.");
      return;
    }

    if (!barrioId && !barrioManual.trim()) {
      setError("Selecciona o escribe un barrio.");
      return;
    }

    if (!zona.trim()) {
      setError("Ingresa la zona, barrio o sector.");
      return;
    }

    if (fechaPreferida) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const fechaSeleccionada = new Date(`${fechaPreferida}T00:00:00`);

      if (fechaSeleccionada < hoy) {
        setError("La fecha preferida no puede ser una fecha pasada.");
        return;
      }
    }

    if (!posicionMapa || !ubicacionConfirmada) {
      setError("Marca y confirma la ubicación exacta en el mapa.");
      return;
    }

    const presupuestoNumero = presupuesto.trim()
      ? Number(presupuesto.trim())
      : null;

    if (presupuestoNumero !== null && Number.isNaN(presupuestoNumero)) {
      setError("El presupuesto debe ser un número válido.");
      return;
    }

    if (presupuestoNumero !== null && presupuestoNumero < 0) {
      setError("El presupuesto no puede ser negativo.");
      return;
    }
const puedePublicar = await validarLimitePublicaciones();

if (!puedePublicar) {
  return;
}
    try {
      setGuardando(true);

      const { data: solicitudCreada, error } = await supabase
        .from("solicitudes_servicio")
        .insert({
          cliente_id: usuarioId,
          categoria_id: categoriaId,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          provincia_id: Number(provinciaId),
          canton_id: Number(cantonId),
          parroquia_id: Number(parroquiaId),
          barrio_id: barrioId ? Number(barrioId) : null,
          sector_id: sectorId ? Number(sectorId) : null,
          barrio_manual: barrioId ? null : barrioManual.trim(),
          sector_manual: sectorId ? null : sectorManual.trim() || null,
          zona: zona.trim(),
          referencia_direccion: referenciaDireccion.trim() || null,
          fecha_preferida: fechaPreferida || null,
          presupuesto: presupuestoNumero,
          estado: "solicitado",
          latitud: posicionMapa.lat,
          longitud: posicionMapa.lng,
          direccion_mapa: `${posicionMapa.lat.toFixed(
            7
          )}, ${posicionMapa.lng.toFixed(7)}`,
          referencia_mapa: referenciaDireccion.trim() || null,
          ubicacion_confirmada: true,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error al publicar solicitud:", error);
        setError(`No se pudo publicar la solicitud: ${error.message}`);
        return;
      }

      // Subir adjuntos si existen
      let adjuntosSubidos = 0;
      if (archivosAdjuntos.length > 0) {
        setSubiendoAdjuntos(true);
        try {
          for (const archivo of archivosAdjuntos) {
            const timestamp = Date.now();
            const path = `${usuarioId}/${solicitudCreada.id}/${timestamp}-${archivo.name}`;

            const { error: uploadError } = await supabase.storage
              .from("solicitudes")
              .upload(path, archivo);

            if (uploadError) {
              console.error("Error al subir adjunto:", uploadError);
              continue; // Continuar con otros adjuntos
            }

            const { data: publicUrlData } = supabase.storage
              .from("solicitudes")
              .getPublicUrl(path);

            const { error: insertError } = await supabase
              .from("solicitud_adjuntos")
              .insert({
                solicitud_id: solicitudCreada.id,
                url: publicUrlData.publicUrl,
                nombre: archivo.name,
                tipo: archivo.type,
              });

            if (insertError) {
              console.error("Error al guardar adjunto en BD:", insertError);
              continue;
            }

            adjuntosSubidos++;
          }
        } catch (uploadError) {
          console.error("Error inesperado al subir adjuntos:", uploadError);
        } finally {
          setSubiendoAdjuntos(false);
        }

        if (adjuntosSubidos < archivosAdjuntos.length) {
          setError("La solicitud se publicó, pero algunos adjuntos no se pudieron subir.");
        }
      }

      setSolicitudPublicada({
        titulo: titulo.trim(),
        categoria: nombreCategoria,
        zona: zona.trim(),
        presupuesto:
          presupuestoNumero !== null ? `$${presupuestoNumero}` : "Opcional",
        fechaPreferida: fechaPreferida || "Sin fecha definida",
        adjuntos: adjuntosSubidos,
      });

      setMensaje("");
    } catch (error) {
      console.error("Error inesperado al publicar solicitud:", error);
      setError("Ocurrió un error inesperado al publicar la solicitud.");
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
              <PlusCircle className="w-4 h-4" />
              Nueva publicación
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-extrabold ${estilos.textoPrincipal}`}
            >
              Publicar solicitud
            </h1>

            <p className={`mt-2 max-w-3xl ${estilos.textoSecundario}`}>
              Describe el servicio que necesitas para recibir propuestas de
              trabajadores disponibles en tu zona.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-bold ${
              modoOscuro
                ? "bg-[#111827] text-slate-300 border border-[#334155]"
                : "bg-[#f0f2f5] text-gray-600"
            }`}
          >
            <Clock3 className="w-5 h-5" />
            Solicitud nueva
          </div>
        </div>
      </section>

      <section
        className={`rounded-[18px] border overflow-hidden ${estilos.tarjeta}`}
      >
        <div className={`px-5 sm:px-6 py-5 border-b ${estilos.borde}`}>
          <h2 className={`text-xl font-extrabold ${estilos.textoPrincipal}`}>
            Detalles del servicio
          </h2>

          <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
            Completa la información principal para publicar tu solicitud.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
            <div className="space-y-5">
              <div>
                <label
                  className={`text-sm font-bold ${estilos.textoPrincipal}`}
                >
                  Categoría
                </label>

                <div className="relative mt-1">
                  <Tag className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    disabled={categoriasCargando || categorias.length === 0}
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed ${estilos.inputBase}`}
                  >
                    <option value="">
                      {categoriasCargando
                        ? "Preparando categorías"
                        : "Selecciona una categoría"}
                    </option>

                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  className={`text-sm font-bold ${estilos.textoPrincipal}`}
                >
                  Título
                </label>

                <div className="relative mt-1">
                  <ClipboardList className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ejemplo: Necesito reparar una fuga de agua"
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>
              </div>

              <div>
                <label
                  className={`text-sm font-bold ${estilos.textoPrincipal}`}
                >
                  Descripción
                </label>

                <div className="relative mt-1">
                  <FileText className="w-5 h-5 text-gray-400 absolute left-4 top-4" />

                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Explica qué necesitas, dónde ocurre el problema y cualquier detalle importante."
                    rows={5}
                    className={`w-full resize-none rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#111827] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                  Ubicación por zona
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <select
                    value={provinciaId}
                    onChange={(e) => {
                      setProvinciaId(e.target.value);
                      setCantonId("");
                      setParroquiaId("");
                      setBarrioId("");
                      setSectorId("");
                      setBarrioManual("");
                      setSectorManual("");
                      setUbicacionConfirmada(false);
                      limpiarAdvertenciaMapa();
                    }}
                    className={`rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                  >
                    <option value="">Provincia</option>
                    {provincias.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>

                  <select
                    value={cantonId}
                    onChange={(e) => {
                      setCantonId(e.target.value);
                      setParroquiaId("");
                      setBarrioId("");
                      setSectorId("");
                      setBarrioManual("");
                      setSectorManual("");
                      setUbicacionConfirmada(false);
                      limpiarAdvertenciaMapa();
                    }}
                    disabled={!provinciaId}
                    className={`rounded-2xl border px-4 py-3 outline-none transition disabled:opacity-60 ${estilos.inputBase}`}
                  >
                    <option value="">Cantón</option>
                    {cantones.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>

                  <select
                    value={parroquiaId}
                    onChange={(e) => {
                      setParroquiaId(e.target.value);
                      setBarrioId("");
                      setSectorId("");
                      setBarrioManual("");
                      setSectorManual("");
                      setUbicacionConfirmada(false);
                      limpiarAdvertenciaMapa();
                    }}
                    disabled={!cantonId}
                    className={`rounded-2xl border px-4 py-3 outline-none transition disabled:opacity-60 ${estilos.inputBase}`}
                  >
                    <option value="">Parroquia</option>
                    {parroquias.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {mostrarBarrioRegistrado ? (
                    <select
                      value={barrioId}
                      onChange={(e) => {
                        setBarrioId(e.target.value);
                        setSectorId("");
                        setSectorManual("");
                      }}
                      disabled={!parroquiaId}
                      className={`rounded-2xl border px-4 py-3 outline-none transition disabled:opacity-60 ${estilos.inputBase}`}
                    >
                      <option value="">Barrio registrado</option>
                      {barrios.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={barrioManual}
                      onChange={(e) => {
                        setBarrioManual(e.target.value);
                        setBarrioId("");
                        setSectorId("");
                        setSectorManual("");
                      }}
                      placeholder="Barrio"
                      className={`rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                    />
                  )}

                  <input
                    type="text"
                    value={sectorManual}
                    onChange={(e) => {
                      setSectorManual(e.target.value);
                      setSectorId("");
                    }}
                    placeholder="Sector exacto (opcional)"
                    className={`rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>

                {mostrarSectorRegistrado && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <select
                      value={sectorId}
                      onChange={(e) => {
                        setSectorId(e.target.value);
                        if (e.target.value) setSectorManual("");
                      }}
                      className={`rounded-2xl border px-4 py-3 outline-none transition ${estilos.inputBase}`}
                    >
                      <option value="">Sector registrado</option>
                      {sectores.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="relative mt-4">
                  <MapPin className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    type="text"
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    placeholder="Zona visible"
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>

                <div className="relative mt-4">
                  <Navigation className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                  <input
                    type="text"
                    value={referenciaDireccion}
                    onChange={(e) => setReferenciaDireccion(e.target.value)}
                    placeholder="Referencia: casa azul, junto al parque..."
                    className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className={`text-sm font-bold ${estilos.textoPrincipal}`}
                  >
                    Fecha preferida
                  </label>

                  <div className="relative mt-1">
                    <CalendarDays className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                    <input
                      type="date"
                      value={fechaPreferida}
                      onChange={(e) => setFechaPreferida(e.target.value)}
                      className={`w-full rounded-2xl border pl-12 pr-4 py-3 outline-none transition ${estilos.inputBase}`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className={`text-sm font-bold ${estilos.textoPrincipal}`}
                  >
                    Presupuesto opcional
                  </label>

                  <div className="relative mt-1">
                    <DollarSign className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />

                    <input
                      type="number"
                      min="0"
                      value={presupuesto}
                      onChange={(e) => setPresupuesto(e.target.value)}
                      placeholder="Ejemplo: 25"
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                      Ubicación exacta
                    </p>
                    <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                      {ubicacionConfirmada && posicionMapa
                        ? `${posicionMapa.lat.toFixed(
                            6
                          )}, ${posicionMapa.lng.toFixed(6)}`
                        : "Marca el punto exacto o aproximado del servicio."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalMapaAbierto(true)}
                    className={`rounded-2xl border px-4 py-3 font-bold transition flex items-center justify-center gap-2 ${
                      modoOscuro
                        ? "border-[#334155] bg-[#0f172a] text-white hover:bg-[#1e293b]"
                        : "border-gray-200 bg-white text-[#0B3C7F] hover:bg-[#f5f9ff]"
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                    Seleccionar en mapa
                  </button>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  modoOscuro
                    ? "bg-[#111827] border-[#334155]"
                    : "bg-[#f8fafc] border-gray-100"
                }`}
              >
                <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                  Fotos adjuntas (opcional)
                </p>
                <p className={`text-sm mt-1 ${estilos.textoSecundario}`}>
                  Agrega hasta 5 imágenes para mostrar el problema o referencia.
                </p>

                <div className="mt-4">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={manejarCambioArchivos}
                    className="hidden"
                    id="archivos-adjuntos"
                  />
                  <label
                    htmlFor="archivos-adjuntos"
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 font-bold transition cursor-pointer ${
                      modoOscuro
                        ? "border-[#334155] bg-[#0f172a] text-white hover:bg-[#1e293b]"
                        : "border-gray-200 bg-white text-[#0B3C7F] hover:bg-[#f5f9ff]"
                    }`}
                  >
                    <PlusCircle className="w-5 h-5" />
                    Agregar fotos
                  </label>
                </div>

                {archivosAdjuntos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {archivosAdjuntos.map((archivo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={previewsAdjuntos[index]}
                          alt={`Adjunto ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => eliminarArchivo(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={publicarSolicitud}
                  disabled={guardando}
                  className="w-full sm:w-auto rounded-2xl bg-[#0B3C7F] text-white px-6 py-3 font-bold shadow-[0_10px_22px_rgba(11,60,127,0.18)] hover:bg-[#092f63] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {guardando ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Publicar solicitud
                    </>
                  )}
                </button>

                <button
                  onClick={limpiarFormulario}
                  disabled={guardando}
                  className={`w-full sm:w-auto rounded-2xl border px-6 py-3 font-bold transition disabled:opacity-60 ${
                    modoOscuro
                      ? "border-[#334155] bg-[#111827] text-white hover:bg-[#1e293b]"
                      : "border-gray-200 bg-white text-[#0B3C7F] hover:bg-[#f5f9ff]"
                  }`}
                >
                  Limpiar
                </button>
              </div>
            </div>

            <aside
              className={`rounded-[22px] border p-5 ${estilos.tarjetaSuave}`}
            >
              <div className="space-y-3">
                <div
                  className={`rounded-2xl border overflow-hidden ${
                    modoOscuro
                      ? "bg-[#0f172a] border-[#334155]"
                      : "bg-white border-gray-100"
                  }`}
                >
                  {!modalMapaAbierto && (
                    <div className="h-[190px] w-full relative z-0 overflow-hidden">
                      <MapContainer
                        key={
                          posicionMapa
                            ? `${posicionMapa.lat}-${posicionMapa.lng}`
                            : "mini-mapa"
                        }
                        center={[centroMapa.lat, centroMapa.lng]}
                        zoom={posicionMapa ? 15 : 13}
                        dragging={false}
                        touchZoom={false}
                        doubleClickZoom={false}
                        scrollWheelZoom={false}
                        zoomControl={false}
                        attributionControl={false}
                        className="h-full w-full z-0"
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {posicionMapa && (
                          <Marker
                            position={[posicionMapa.lat, posicionMapa.lng]}
                            icon={marcadorMiniIcono}
                          />
                        )}
                      </MapContainer>
                    </div>
                  )}

                  <div className="p-4">
                    <p
                      className={`text-xs font-bold ${estilos.textoSecundario}`}
                    >
                      Ubicación exacta
                    </p>
                    <p
                      className={`mt-1 font-extrabold ${estilos.textoPrincipal}`}
                    >
                      {ubicacionConfirmada ? "Punto confirmado" : "Sin confirmar"}
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    modoOscuro
                      ? "bg-[#0f172a] border-[#334155]"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                    Categoría
                  </p>
                  <p
                    className={`mt-1 font-extrabold ${estilos.textoPrincipal}`}
                  >
                    {nombreCategoria}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    modoOscuro
                      ? "bg-[#0f172a] border-[#334155]"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                    Zona
                  </p>
                  <p
                    className={`mt-1 font-extrabold ${estilos.textoPrincipal}`}
                  >
                    {zona.trim() || "Sin zona"}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    modoOscuro
                      ? "bg-[#0f172a] border-[#334155]"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                    Presupuesto
                  </p>
                  <p
                    className={`mt-1 font-extrabold ${estilos.textoPrincipal}`}
                  >
                    {presupuesto.trim() ? `$${presupuesto}` : "Opcional"}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {modalMapaAbierto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalMapaAbierto(false)}
          />

          <div
            className={`relative w-full max-w-4xl overflow-hidden rounded-[24px] border shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
              modoOscuro
                ? "bg-[#111827] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div
              className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${estilos.borde}`}
            >
              <div>
                <h3
                  className={`text-xl font-extrabold ${estilos.textoPrincipal}`}
                >
                  Seleccionar ubicación
                </h3>
                <p className={`text-sm ${estilos.textoSecundario}`}>
                  Toca el mapa para marcar el punto del servicio.
                </p>
              </div>

              <button
                onClick={() => setModalMapaAbierto(false)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                  modoOscuro
                    ? "bg-[#1e293b] text-white hover:bg-[#263449]"
                    : "bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb]"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-[420px] relative z-0">
              <MapContainer
                center={[centroMapa.lat, centroMapa.lng]}
                zoom={14}
                scrollWheelZoom
                className="h-full w-full z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RecentrarMapa posicion={posicionMapa} />

                <SelectorMapa
                  posicion={posicionMapa}
                  setPosicion={(posicion) => {
                    setPosicionMapa(posicion);
                    setUbicacionConfirmada(false);
                    limpiarAdvertenciaMapa();
                  }}
                />
              </MapContainer>
            </div>

            <div
              className={`flex flex-col gap-3 p-5 border-t ${estilos.borde}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className={`text-sm ${estilos.textoSecundario}`}>
                    {posicionMapa
                      ? `${posicionMapa.lat.toFixed(
                          7
                        )}, ${posicionMapa.lng.toFixed(7)}`
                      : "Aún no has marcado una ubicación."}
                  </p>

                  {ubicacionDetectada && (
                    <p className={`text-xs mt-1 ${estilos.textoSecundario}`}>
                      Detectado:{" "}
                      {[
                        ubicacionDetectada.parroquia,
                        ubicacionDetectada.canton,
                        ubicacionDetectada.provincia,
                      ]
                        .filter(Boolean)
                        .join(", ") || "No identificado"}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={usarMiUbicacion}
                    disabled={ubicando || verificandoZona}
                    className={`rounded-2xl border px-5 py-3 font-bold transition disabled:opacity-60 flex items-center justify-center gap-2 ${
                      modoOscuro
                        ? "border-[#334155] bg-[#0f172a] text-white hover:bg-[#1e293b]"
                        : "border-gray-200 bg-white text-[#0B3C7F] hover:bg-[#f5f9ff]"
                    }`}
                  >
                    {ubicando ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <LocateFixed className="w-5 h-5" />
                    )}
                    Mi ubicación
                  </button>

                  <button
                    type="button"
                    onClick={confirmarUbicacion}
                    disabled={verificandoZona}
                    className="rounded-2xl bg-[#0B3C7F] text-white px-5 py-3 font-bold hover:bg-[#092f63] transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {verificandoZona ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                    {verificandoZona ? "Verificando..." : "Confirmar"}
                  </button>
                </div>
              </div>

              {advertenciaZona && (
                <div
                  className={`rounded-2xl border px-4 py-3 ${
                    modoOscuro
                      ? "border-yellow-700 bg-yellow-950/30"
                      : "border-yellow-200 bg-yellow-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          modoOscuro ? "text-yellow-100" : "text-yellow-800"
                        }`}
                      >
                        {advertenciaZona}
                      </p>

                      {permitirZonaDiferente && (
                        <div className="flex flex-col sm:flex-row gap-2 mt-3">
                          <button
                            type="button"
                            onClick={usarUbicacionAunqueNoCoincida}
                            className="rounded-xl bg-[#0B3C7F] text-white px-4 py-2 text-sm font-bold hover:bg-[#092f63] transition"
                          >
                            Usar ubicación marcada
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAdvertenciaZona("");
                              setPermitirZonaDiferente(false);
                            }}
                            className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                              modoOscuro
                                ? "border-[#334155] text-white hover:bg-[#1e293b]"
                                : "border-gray-200 text-[#0B3C7F] hover:bg-white"
                            }`}
                          >
                            Corregir punto
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {solicitudPublicada && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className={`relative w-full max-w-lg rounded-[26px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${
              modoOscuro
                ? "bg-[#111827] border-[#334155]"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>

              <div>
                <h3
                  className={`text-xl font-extrabold ${estilos.textoPrincipal}`}
                >
                  Solicitud publicada
                </h3>
                <p className={`text-sm ${estilos.textoSecundario}`}>
                  Tu solicitud fue guardada correctamente.
                </p>
              </div>
            </div>

            <div
              className={`mt-5 rounded-2xl border p-4 space-y-3 ${
                modoOscuro
                  ? "bg-[#0f172a] border-[#334155]"
                  : "bg-[#f8fafc] border-gray-100"
              }`}
            >
              <div>
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Título
                </p>
                <p className={`font-extrabold ${estilos.textoPrincipal}`}>
                  {solicitudPublicada.titulo}
                </p>
              </div>

              <div>
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Categoría
                </p>
                <p className={`font-bold ${estilos.textoPrincipal}`}>
                  {solicitudPublicada.categoria}
                </p>
              </div>

              <div>
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Zona
                </p>
                <p className={`font-bold ${estilos.textoPrincipal}`}>
                  {solicitudPublicada.zona}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                    Fecha preferida
                  </p>
                  <p className={`font-bold ${estilos.textoPrincipal}`}>
                    {solicitudPublicada.fechaPreferida}
                  </p>
                </div>

                <div>
                  <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                    Presupuesto
                  </p>
                  <p className={`font-bold ${estilos.textoPrincipal}`}>
                    {solicitudPublicada.presupuesto}
                  </p>
                </div>
              </div>

              <div>
                <p className={`text-xs font-bold ${estilos.textoSecundario}`}>
                  Adjuntos
                </p>
                <p className={`font-bold ${estilos.textoPrincipal}`}>
                  {solicitudPublicada.adjuntos} imagen(es)
                </p>
              </div>
            </div>

            <div
              className={`mt-5 rounded-2xl border px-4 py-3 ${
                modoOscuro
                  ? "border-[#334155] bg-[#0f172a]"
                  : "border-blue-100 bg-blue-50"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  modoOscuro ? "text-slate-300" : "text-[#0B3C7F]"
                }`}
              >
                Cuando existan propuestas para esta solicitud, podrás revisarlas
                desde la sección de propuestas.
              </p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => router.push("/panel")}
                className="w-full rounded-2xl bg-[#0B3C7F] text-white px-5 py-3 font-bold hover:bg-[#092f63] transition"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}