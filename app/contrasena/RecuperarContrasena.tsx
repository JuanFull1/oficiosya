"use client";

import { useMemo, useState } from "react";
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

type PasoRecuperacion = "correo" | "codigo" | "password";

export default function RecuperarContrasena() {
  const router = useRouter();

  const [paso, setPaso] = useState<PasoRecuperacion>("correo");

  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const passwordInfo = useMemo(() => validarPassword(password), [password]);









 const enviarCodigo = async () => {
  setError("");
  setMensaje("");

  if (!correo.trim()) {
    setError("Ingresa tu correo electrónico.");
    return;
  }

  try {
    setCargando(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/contrasena`,
      },
    });

    if (error) {
      console.error("Error al enviar código:", error);

      const mensajeError = error.message.toLowerCase();

      if (
        mensajeError.includes("signups not allowed for otp") ||
        mensajeError.includes("otp")
      ) {
        setError(
          "No se pudo enviar el código de recuperación. Verifica que el correo esté registrado."
        );
        return;
      }

      if (mensajeError.includes("email")) {
        setError("El correo electrónico no es válido.");
        return;
      }

      if (mensajeError.includes("rate limit")) {
        setError(
          "Has solicitado demasiados códigos. Espera un momento e intenta nuevamente."
        );
        return;
      }

      setError(
        "No se pudo enviar el código de recuperación. Intenta nuevamente."
      );

      return;
    }

    setMensaje(
      "Te enviamos un código de recuperación a tu correo electrónico."
    );

    setPaso("codigo");
  } catch (error) {
    console.error("Error inesperado al enviar código:", error);

    setError(
      "Ocurrió un error inesperado al enviar el código de recuperación."
    );
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

      const mensajeError = error.message.toLowerCase();

      if (
        mensajeError.includes("token") ||
        mensajeError.includes("otp") ||
        mensajeError.includes("expired")
      ) {
        setError("El código es incorrecto o expiró.");
        return;
      }

      setError("No se pudo verificar el código.");
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

const actualizarContrasena = async () => {
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

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Error al actualizar contraseña:", error);

      const mensajeError = error.message.toLowerCase();

      if (
        mensajeError.includes("new password should be different") ||
        mensajeError.includes("old password")
      ) {
        setError(
          "La nueva contraseña debe ser diferente a la contraseña anterior."
        );
        return;
      }

      if (mensajeError.includes("password")) {
        setError(
          "La contraseña no cumple con los requisitos de seguridad."
        );
        return;
      }

      if (mensajeError.includes("session")) {
        setError(
          "La sesión expiró. Solicita nuevamente la recuperación de contraseña."
        );
        return;
      }

      setError(
        "No se pudo actualizar la contraseña. Intenta nuevamente."
      );

      return;
    }

    await supabase.auth.signOut();

    setMensaje("Contraseña actualizada correctamente.");

    setTimeout(() => {
      router.push("/login");
    }, 1200);
  } catch (error) {
    console.error("Error inesperado al actualizar contraseña:", error);

    setError("Ocurrió un error inesperado al actualizar la contraseña.");
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

    try {
      setCargando(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: correo.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/contrasena`,
        },
      });

      if (error) {
        console.error("Error al reenviar código:", error);
        setError("No se pudo reenviar el código.");
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
                Recuperar contraseña
              </h2>
              <p className="text-sm text-white/80 mt-1">
                Verifica tu correo y crea una nueva contraseña para tu cuenta.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <div
                className={`rounded-2xl px-2 py-3 text-center border ${
                  paso === "correo"
                    ? "bg-white text-[#0B3C7F] border-white"
                    : "bg-white/10 text-white border-white/20"
                }`}
              >
                <div className="mx-auto mb-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-current/10">
                  1
                </div>
                <p className="text-[11px] sm:text-xs font-bold">Correo</p>
              </div>

              <div
                className={`rounded-2xl px-2 py-3 text-center border ${
                  paso === "codigo"
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
            {paso === "correo" && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-extrabold text-gray-900">
                    Ingresa tu correo
                  </h3>

                  <p className="text-sm text-gray-500 mt-1 mb-5">
                    Te enviaremos un código para verificar que la cuenta te
                    pertenece.
                  </p>

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

            {paso === "codigo" && (
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
                    Crea tu nueva contraseña
                  </h3>

                  <p className="text-sm text-gray-500 mt-1 mb-5">
                    Usa una contraseña segura para volver a ingresar a tu
                    cuenta.
                  </p>

                  <div className="space-y-4">
                    <div className="relative">
                      <label className="text-sm font-semibold text-gray-700">
                        Nueva contraseña
                      </label>
                      <input
                        type={mostrarPassword ? "text" : "password"}
                        placeholder="Nueva contraseña"
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
                        onChange={(e) => setConfirmarPassword(e.target.value)}
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
                    onClick={actualizarContrasena}
                    disabled={cargando}
                  >
                    {cargando ? "Guardando..." : "Actualizar contraseña"}
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