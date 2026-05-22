"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function validarPassword(password: string) {
  const tieneMinimo = password.length >= 8;
  const tieneMayuscula = /[A-Z]/.test(password);
  const tieneMinuscula = /[a-z]/.test(password);
  const tieneNumero = /[0-9]/.test(password);
  const tieneEspecial = /[^A-Za-z0-9]/.test(password);

  return {
    valida:
      tieneMinimo &&
      tieneMayuscula &&
      tieneMinuscula &&
      tieneNumero &&
      tieneEspecial,
    tieneMinimo,
    tieneMayuscula,
    tieneMinuscula,
    tieneNumero,
    tieneEspecial,
  };
}

function esMayorDeEdad(fechaNacimiento: string) {
  if (!fechaNacimiento) return false;

  const fecha = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return false;

  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();

  const mesActual = hoy.getMonth();
  const mesNacimiento = fecha.getMonth();

  if (
    mesActual < mesNacimiento ||
    (mesActual === mesNacimiento && hoy.getDate() < fecha.getDate())
  ) {
    edad--;
  }

  return edad >= 18;
}

type PasoRegistro = "formulario" | "verificar" | "password";

type Ubicacion = {
  id: number;
  nombre: string;
};

export default function RegistroView() {
  const router = useRouter();

  const [paso, setPaso] = useState<PasoRegistro>("formulario");

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const [telefono, setTelefono] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");

  const [provincias, setProvincias] = useState<Ubicacion[]>([]);
  const [cantones, setCantones] = useState<Ubicacion[]>([]);
  const [parroquias, setParroquias] = useState<Ubicacion[]>([]);

  const [provinciaId, setProvinciaId] = useState("");
  const [cantonId, setCantonId] = useState("");
  const [parroquiaId, setParroquiaId] = useState("");

  const [barrioManual, setBarrioManual] = useState("");
  const [referenciaDireccion, setReferenciaDireccion] = useState("");

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const passwordInfo = useMemo(() => validarPassword(password), [password]);

  useEffect(() => {
    const cargarProvincias = async () => {
      const { data, error } = await supabase
        .from("provincias")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error al cargar provincias:", error);
        setError("No se pudieron cargar las provincias.");
        return;
      }

      setProvincias(data || []);
    };

    cargarProvincias();
  }, []);

  useEffect(() => {
    const cargarCantones = async () => {
      if (!provinciaId) {
        setCantones([]);
        setCantonId("");
        setParroquias([]);
        setParroquiaId("");
        return;
      }

      const { data, error } = await supabase
        .from("cantones")
        .select("id, nombre")
        .eq("provincia_id", Number(provinciaId))
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error al cargar cantones:", error);
        setError("No se pudieron cargar los cantones.");
        return;
      }

      setCantones(data || []);
      setCantonId("");
      setParroquias([]);
      setParroquiaId("");
    };

    cargarCantones();
  }, [provinciaId]);

  useEffect(() => {
    const cargarParroquias = async () => {
      if (!cantonId) {
        setParroquias([]);
        setParroquiaId("");
        return;
      }

      const { data, error } = await supabase
        .from("parroquias")
        .select("id, nombre")
        .eq("canton_id", Number(cantonId))
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error al cargar parroquias:", error);
        setError("No se pudieron cargar las parroquias.");
        return;
      }

      setParroquias(data || []);
      setParroquiaId("");
    };

    cargarParroquias();
  }, [cantonId]);

  const enviarCodigo = async () => {
    setError("");
    setMensaje("");

    if (!nombreCompleto.trim() || !correo.trim()) {
      setError("Completa nombre y correo.");
      return;
    }

    if (!fechaNacimiento) {
      setError("Selecciona tu fecha de nacimiento.");
      return;
    }

    if (!esMayorDeEdad(fechaNacimiento)) {
      setError("Debes ser mayor de 18 años para registrarte.");
      return;
    }

    if (!provinciaId || !cantonId || !parroquiaId) {
      setError("Selecciona provincia, cantón y parroquia.");
      return;
    }

    if (!barrioManual.trim()) {
      setError("Ingresa tu barrio o sector.");
      return;
    }

    try {
      setCargando(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: correo.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: "http://localhost:3000/registro",
          data: {
            nombre_completo: nombreCompleto.trim(),
            fecha_nacimiento: fechaNacimiento,
          },
        },
      });

      if (error) {
        console.error("Error al enviar código:", error);
        setError(`No se pudo enviar el código: ${error.message}`);
        return;
      }

      setMensaje("Te enviamos un código a tu correo.");
      setPaso("verificar");
    } catch (error) {
      console.error("Error inesperado al enviar código:", error);
      setError("Ocurrió un error inesperado al enviar el código.");
    } finally {
      setCargando(false);
    }
  };

  const verificarCodigo = async () => {
    setError("");
    setMensaje("");

    if (!codigo.trim()) {
      setError("Ingresa el código que llegó a tu correo.");
      return;
    }

    try {
      setCargando(true);

      const { data, error } = await supabase.auth.verifyOtp({
        email: correo.trim(),
        token: codigo.trim().replace(/\s/g, ""),
        type: "email",
      });

      if (error) {
        console.error("Error al verificar código:", error);
        setError("El código es incorrecto o expiró.");
        return;
      }

      if (!data.user) {
        setError("No se pudo verificar el usuario.");
        return;
      }

      setMensaje("Correo verificado correctamente.");
      setPaso("password");
    } catch (error) {
      console.error("Error inesperado al verificar código:", error);
      setError("Ocurrió un error inesperado al verificar el código.");
    } finally {
      setCargando(false);
    }
  };

  const finalizarRegistro = async () => {
    setError("");
    setMensaje("");

    if (!password || !confirmarPassword) {
      setError("Completa la contraseña y su confirmación.");
      return;
    }

    if (!passwordInfo.valida) {
      setError("La contraseña no cumple los requisitos de seguridad.");
      return;
    }

    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setCargando(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.updateUser({
        password,
        data: {
          nombre_completo: nombreCompleto.trim(),
          fecha_nacimiento: fechaNacimiento,
        },
      });

      let usuarioFinal = user;

      if (userError) {
        console.error("No se pudo guardar la contraseña final:", userError);

        if (
          userError.message.includes(
            "New password should be different from the old password"
          )
        ) {
          const {
            data: { user: usuarioActual },
            error: usuarioActualError,
          } = await supabase.auth.getUser();

          if (usuarioActualError || !usuarioActual) {
            setError(
              "La contraseña ya existía, pero no se pudo obtener el usuario actual."
            );
            return;
          }

          usuarioFinal = usuarioActual;
        } else {
          setError(
            `No se pudo guardar la contraseña final: ${userError.message}`
          );
          return;
        }
      }

      if (!usuarioFinal) {
        setError("No se pudo obtener el usuario verificado.");
        return;
      }

      const { error: perfilError } = await supabase.from("perfiles").upsert(
        {
          id: usuarioFinal.id,
          correo: usuarioFinal.email || correo.trim(),
          nombre_completo: nombreCompleto.trim(),
          fecha_nacimiento: fechaNacimiento,
          telefono: telefono.trim() || null,

          provincia_id: Number(provinciaId),
          canton_id: Number(cantonId),
          parroquia_id: Number(parroquiaId),

          barrio_id: null,
          sector_id: null,

          barrio_manual: barrioManual.trim() || null,
          sector_manual: null,

          zona: barrioManual.trim() || null,
          referencia_direccion: referenciaDireccion.trim() || null,

          activo: true,
          verificado: false,
          es_cliente: true,
          es_trabajador: true,
          es_admin: false,
        },
        {
          onConflict: "id",
        }
      );

      if (perfilError) {
        console.error("Error al crear perfil:", perfilError);
        setError(
          `La cuenta existe en Auth, pero no se pudo crear el perfil: ${perfilError.message}`
        );
        return;
      }

      const { error: rolesError } = await supabase.from("roles_usuario").upsert(
        [
          {
            usuario_id: usuarioFinal.id,
            rol: "cliente",
          },
          {
            usuario_id: usuarioFinal.id,
            rol: "trabajador",
          },
        ],
        {
          onConflict: "usuario_id,rol",
        }
      );

      if (rolesError) {
        console.error("Error al crear roles:", rolesError);
        setError(
          `Perfil creado, pero no se pudieron crear los roles: ${rolesError.message}`
        );
        return;
      }

      const { error: trabajadorError } = await supabase
        .from("perfiles_trabajador")
        .upsert(
          {
            usuario_id: usuarioFinal.id,
            experiencia_anios: 0,
            disponibilidad: null,
            zona_atencion: barrioManual.trim() || null,
            calificacion_promedio: 0,
            servicios_completados: 0,
            disponible: true,
          },
          {
            onConflict: "usuario_id",
          }
        );

      if (trabajadorError) {
        console.error("Error al crear perfil trabajador:", trabajadorError);
        setError(
          `Perfil creado, pero no se pudo crear el perfil trabajador: ${trabajadorError.message}`
        );
        return;
      }

      setMensaje("Cuenta creada correctamente.");

      setTimeout(() => {
        router.push("/panel");
      }, 1000);
    } catch (error) {
      console.error("Error inesperado en finalizarRegistro:", error);
      setError("Ocurrió un error inesperado.");
    } finally {
      setCargando(false);
    }
  };

  const reenviarCodigo = async () => {
    setError("");
    setMensaje("");

    if (!correo.trim()) {
      setError("No hay un correo para reenviar el código.");
      return;
    }

    if (!fechaNacimiento) {
      setError("Selecciona tu fecha de nacimiento.");
      return;
    }

    if (!esMayorDeEdad(fechaNacimiento)) {
      setError("Debes ser mayor de 18 años para registrarte.");
      return;
    }

    try {
      setCargando(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: correo.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: "http://localhost:3000/registro",
          data: {
            nombre_completo: nombreCompleto.trim(),
            fecha_nacimiento: fechaNacimiento,
          },
        },
      });

      if (error) {
        console.error("Error al reenviar código:", error);
        setError(`No se pudo reenviar el código: ${error.message}`);
        return;
      }

      setMensaje("Código reenviado al correo.");
    } catch (error) {
      console.error("Error inesperado al reenviar código:", error);
      setError("Ocurrió un error inesperado al reenviar el código.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-neutral-900/40 px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-neutral-800/40 backdrop-blur-md" />

      <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[#1E5DB8]/25 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#0B3C7F]/30 blur-3xl" />

      <div className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-full max-w-2xl rounded-[2rem] bg-white shadow-[0_30px_70px_rgba(0,0,0,0.28)] border border-white/70 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0B3C7F] to-[#1E5DB8] px-5 py-6 sm:px-8 sm:py-7 text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white text-[#0B3C7F] flex items-center justify-center font-black shadow-sm">
                OY
              </div>

              <div>
                <h1 className="text-lg sm:text-xl font-extrabold tracking-wide">
                  OFICIOS YA
                </h1>
                <p className="text-xs sm:text-sm text-white/80">
                  Empleos y servicios locales
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold">
                Crear cuenta
              </h2>
              <p className="text-sm text-white/80 mt-1">
                Completa tus datos para registrarte en la plataforma.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <div
                className={`rounded-2xl px-2 py-3 text-center border ${
                  paso === "formulario"
                    ? "bg-white text-[#0B3C7F] border-white"
                    : "bg-white/10 text-white border-white/20"
                }`}
              >
                <div className="mx-auto mb-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-current/10">
                  1
                </div>
                <p className="text-[11px] sm:text-xs font-bold">Datos</p>
              </div>

              <div
                className={`rounded-2xl px-2 py-3 text-center border ${
                  paso === "verificar"
                    ? "bg-white text-[#0B3C7F] border-white"
                    : "bg-white/10 text-white border-white/20"
                }`}
              >
                <div className="mx-auto mb-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-current/10">
                  2
                </div>
                <p className="text-[11px] sm:text-xs font-bold">Código</p>
              </div>

              <div
                className={`rounded-2xl px-2 py-3 text-center border ${
                  paso === "password"
                    ? "bg-white text-[#0B3C7F] border-white"
                    : "bg-white/10 text-white border-white/20"
                }`}
              >
                <div className="mx-auto mb-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-current/10">
                  3
                </div>
                <p className="text-[11px] sm:text-xs font-bold">Contraseña</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 bg-[#f8fafc]">
            {paso === "formulario" && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-extrabold text-[#0B3C7F] mb-4">
                    Información personal
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        placeholder="Nombre completo"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={nombreCompleto}
                        onChange={(e) => setNombreCompleto(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        placeholder="tu@email.com"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        placeholder="Teléfono"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Fecha de nacimiento
                      </label>

                      <input
                        type="date"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={fechaNacimiento}
                        onChange={(e) => setFechaNacimiento(e.target.value)}
                      />

                      {fechaNacimiento && !esMayorDeEdad(fechaNacimiento) && (
                        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                          Debes ser mayor de 18 años para registrarte.
                        </p>
                      )}

                      {fechaNacimiento && esMayorDeEdad(fechaNacimiento) && (
                        <p className="mt-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                          Edad válida para registrarte.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-extrabold text-[#0B3C7F] mb-4">
                    Ubicación
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Provincia
                      </label>
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={provinciaId}
                        onChange={(e) => setProvinciaId(e.target.value)}
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
                      <label className="text-sm font-semibold text-gray-700">
                        Cantón
                      </label>
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20 disabled:bg-gray-100 disabled:text-gray-400"
                        value={cantonId}
                        onChange={(e) => setCantonId(e.target.value)}
                        disabled={!provinciaId}
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
                      <label className="text-sm font-semibold text-gray-700">
                        Parroquia
                      </label>
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20 disabled:bg-gray-100 disabled:text-gray-400"
                        value={parroquiaId}
                        onChange={(e) => setParroquiaId(e.target.value)}
                        disabled={!cantonId}
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
                      <label className="text-sm font-semibold text-gray-700">
                        Barrio o sector
                      </label>
                      <input
                        type="text"
                        placeholder="Barrio o sector"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={barrioManual}
                        onChange={(e) => setBarrioManual(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Referencia de dirección
                      </label>
                      <input
                        type="text"
                        placeholder="Referencia de dirección"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={referenciaDireccion}
                        onChange={(e) =>
                          setReferenciaDireccion(e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <button
                  className="w-full rounded-xl bg-[#0B3C7F] py-3.5 font-bold text-white shadow-lg shadow-[#0B3C7F]/25 transition hover:bg-[#092f63] disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={enviarCodigo}
                  disabled={cargando}
                >
                  {cargando ? "Enviando..." : "Enviar código"}
                </button>
              </div>
            )}

            {paso === "verificar" && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-extrabold text-gray-900">
                    Verifica tu correo
                  </h3>

                  <p className="text-sm text-gray-500 mt-1 mb-5">
                    Ingresa el código que enviamos a tu correo electrónico.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-gray-500 outline-none"
                        value={correo}
                        disabled
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">
                        Código de verificación
                      </label>
                      <input
                        type="text"
                        placeholder="Código de verificación"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-lg tracking-[0.3em] font-bold text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  className="w-full rounded-xl bg-[#0B3C7F] py-3.5 font-bold text-white shadow-lg shadow-[#0B3C7F]/25 transition hover:bg-[#092f63] disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={verificarCodigo}
                  disabled={cargando}
                >
                  {cargando ? "Verificando..." : "Verificar código"}
                </button>

                <button
                  className="w-full rounded-xl border border-[#1E5DB8]/30 bg-white py-3.5 font-bold text-[#1E5DB8] transition hover:bg-[#1E5DB8]/5 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={reenviarCodigo}
                  disabled={cargando}
                >
                  Reenviar código
                </button>
              </div>
            )}

            {paso === "password" && (
              <>
                <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-extrabold text-gray-900">
                    Crea tu contraseña
                  </h3>

                  <p className="text-sm text-gray-500 mt-1 mb-5">
                    Usa una contraseña segura para proteger tu cuenta.
                  </p>

                  <div className="space-y-4">
                    <div className="relative">
                      <label className="text-sm font-semibold text-gray-700">
                        Contraseña
                      </label>
                      <input
                        type={mostrarPassword ? "text" : "password"}
                        placeholder="Contraseña"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-20 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPassword(!mostrarPassword)}
                        className="absolute right-3 bottom-3 text-sm text-[#1E5DB8] font-bold"
                      >
                        {mostrarPassword ? "Ocultar" : "Ver"}
                      </button>
                    </div>

                    <div className="relative">
                      <label className="text-sm font-semibold text-gray-700">
                        Confirmar contraseña
                      </label>
                      <input
                        type={mostrarConfirmar ? "text" : "password"}
                        placeholder="Confirmar contraseña"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-20 text-gray-900 outline-none transition focus:border-[#0B3C7F] focus:ring-2 focus:ring-[#0B3C7F]/20"
                        value={confirmarPassword}
                        onChange={(e) =>
                          setConfirmarPassword(e.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                        className="absolute right-3 bottom-3 text-sm text-[#1E5DB8] font-bold"
                      >
                        {mostrarConfirmar ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-[#f8fafc] border border-gray-100 p-4">
                    <p className="text-sm font-bold text-[#0B3C7F] mb-3">
                      Requisitos de seguridad
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <p
                        className={`rounded-xl px-3 py-2 ${
                          passwordInfo.tieneMinimo
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "bg-white text-gray-500"
                        }`}
                      >
                        • Mínimo 8 caracteres
                      </p>

                      <p
                        className={`rounded-xl px-3 py-2 ${
                          passwordInfo.tieneMayuscula
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "bg-white text-gray-500"
                        }`}
                      >
                        • Al menos una mayúscula
                      </p>

                      <p
                        className={`rounded-xl px-3 py-2 ${
                          passwordInfo.tieneMinuscula
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "bg-white text-gray-500"
                        }`}
                      >
                        • Al menos una minúscula
                      </p>

                      <p
                        className={`rounded-xl px-3 py-2 ${
                          passwordInfo.tieneNumero
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "bg-white text-gray-500"
                        }`}
                      >
                        • Al menos un número
                      </p>

                      <p
                        className={`rounded-xl px-3 py-2 sm:col-span-2 ${
                          passwordInfo.tieneEspecial
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "bg-white text-gray-500"
                        }`}
                      >
                        • Al menos un carácter especial
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mt-5">
                  <button
                    className="w-full rounded-xl bg-[#0B3C7F] py-3.5 font-bold text-white shadow-lg shadow-[#0B3C7F]/25 transition hover:bg-[#092f63] disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={finalizarRegistro}
                    disabled={cargando}
                  >
                    {cargando ? "Guardando..." : "Finalizar registro"}
                  </button>
                </div>
              </>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-red-700 text-sm text-center font-medium">
                  {error}
                </p>
              </div>
            )}

            {mensaje && (
              <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-green-700 text-sm text-center font-medium">
                  {mensaje}
                </p>
              </div>
            )}

            <div className="mt-5">
              <button
                className="w-full rounded-xl border border-gray-300 bg-white py-3.5 font-bold text-gray-700 transition hover:bg-gray-50"
                onClick={() => router.push("/login")}
              >
                Volver al login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}