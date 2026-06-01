"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginView() {
  return (
    <Suspense fallback={null}>
      <LoginViewContenido />
    </Suspense>
  );
}

function LoginViewContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Limpiar cualquier sesión残留 al cargar la página de login
    const limpiarSesionAlInicio = async () => {
      // Limpiar todos los cachés
      const cacheKeys = [
        'oficiosya-panel-cache',
        'oficiosya-propuestas-cache',
        'oficiosya-resenas-cache',
        'oficiosya-trabajador-cache-v2'
      ];
      cacheKeys.forEach(key => localStorage.removeItem(key));
      
      // Limpiar claves de Supabase
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      sessionStorage.clear();
      
      // Cerrar cualquier sesión activa en Supabase
      await supabase.auth.signOut();
    };
    
    limpiarSesionAlInicio();
  }, []);

  const errorUrl = searchParams.get("error");

  const errorDesdeUrl =
    errorUrl === "sin_perfil"
      ? "Ese correo de Google no está registrado en OficiosYA. Primero debes registrarte o iniciar sesión con una cuenta que ya exista."
      : errorUrl === "usuario_inactivo"
      ? "Tu cuenta está inactiva. Contacta con el administrador."
      : errorUrl === "sin_roles"
      ? "Tu cuenta no tiene roles asignados en el sistema."
      : errorUrl === "google"
      ? "No se pudo iniciar sesión con Google. Intenta nuevamente."
      : "";

  const errorVisible = error || (!cargando ? errorDesdeUrl : "");

  const validarPerfilYRedirigir = async (userId: string) => {
    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .select("id, activo, es_cliente, es_trabajador, es_admin")
      .eq("id", userId)
        .maybeSingle();

    if (perfilError || !perfil) {
      await supabase.auth.signOut();
      setError(
        "Este usuario existe en Supabase Auth, pero no existe en la tabla perfiles de OficiosYA."
      );
      setCargando(false);
      return;
    }

    if (!perfil.activo) {
      await supabase.auth.signOut();
      setError("Tu cuenta está inactiva. Contacta con el administrador.");
      setCargando(false);
      return;
    }

    if (!perfil.es_cliente && !perfil.es_trabajador && !perfil.es_admin) {
      await supabase.auth.signOut();
      setError("Tu cuenta no tiene roles asignados.");
      setCargando(false);
      return;
    }

    if (perfil.es_admin) {
      router.push("/admin/dashboard");
      return;
    }

    router.push("/panel");
  };

  const iniciarSesion = async () => {
    setError("");

    if (!correo.trim() || !password) {
      setError("Completa correo y contraseña.");
      return;
    }

    try {
      setCargando(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password,
      });

      if (error || !data.user) {
        setError("Correo o contraseña incorrectos.");
        setCargando(false);
        return;
      }

      await validarPerfilYRedirigir(data.user.id);
    } catch (error) {
      console.error("Error inesperado al iniciar sesión:", error);
      setError("Ocurrió un error inesperado al iniciar sesión.");
      setCargando(false);
    }
  };

  const loginGoogle = async () => {
    setError("");

    try {
      setCargando(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        console.error("Error al iniciar con Google:", error);
        setError(`No se pudo iniciar con Google: ${error.message}`);
        setCargando(false);
      }
    } catch (error) {
      console.error("Error inesperado con Google:", error);
      setError("Ocurrió un error inesperado al iniciar con Google.");
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-neutral-900/40">
      <div className="absolute inset-0 backdrop-blur-md bg-neutral-800/40" />

      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:hidden flex items-center justify-center px-4 pt-8">
          <div className="bg-[#f5f7fb] rounded-3xl shadow-2xl p-4">
            <img
              src="/login-illustration.png"
              alt="Oficios"
              className="max-h-[260px] object-contain"
            />
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center">
          <div className="bg-[#f5f7fb] rounded-3xl shadow-2xl p-6">
            <img
              src="/login-illustration.png"
              alt="Oficios"
              className="max-h-[80vh] object-contain"
            />
          </div>
        </div>

        <div className="flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-[0_30px_60px_rgba(0,0,0,0.25)] p-8">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                <div className="w-10 h-10 rounded-full bg-[#0B3C7F] flex items-center justify-center text-white font-bold">
                  🛠️
                </div>
              </div>

              <h1 className="text-lg font-bold text-[#0B3C7F]">
                OFICIOS YA
              </h1>

              <p className="mt-2 text-xl font-extrabold text-gray-900">
                Conecta con expertos,<br />
                <span className="text-[#1E5DB8]">
                  soluciona cualquier tarea
                </span>
              </p>

              <p className="text-sm text-gray-500 mt-2">
                La plataforma que te permite encontrar y contratar servicios
                profesionales de manera rápida y segura.
              </p>
            </div>

            <label className="text-sm font-medium text-gray-700">
              Correo electrónico
            </label>

            <div className="relative mt-1 mb-4">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="tu@email.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-10 py-3 focus:ring-2 focus:ring-[#0B3C7F]"
              />
            </div>

            <label className="text-sm font-medium text-gray-700">
              Contraseña
            </label>

            <div className="relative mt-1 mb-2">
              <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />

              <input
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-10 py-3 pr-12 focus:ring-2 focus:ring-[#0B3C7F]"
              />

              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-3 top-3.5"
              >
                {mostrarPassword ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>

            <div className="text-right mb-4">
              <button
  type="button"
  onClick={() => router.push("/contrasena")}
  
>
  ¿Olvidaste tu contraseña?
</button>




            </div>

            {errorVisible && (
              <p className="text-sm text-red-600 mb-3">{errorVisible}</p>
            )}

            <button
              onClick={iniciarSesion}
              disabled={cargando}
              className="w-full bg-[#0B3C7F] text-white font-bold py-3 rounded-xl hover:bg-[#092f63] disabled:opacity-60"
            >
              {cargando ? "Ingresando..." : "Iniciar sesión"}
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400">o continúa con</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            <button
              onClick={loginGoogle}
              disabled={cargando}
              className="w-full border border-gray-300 rounded-xl py-3 flex items-center justify-center gap-3 hover:bg-gray-50 disabled:opacity-60"
            >
              <img src="/icons/google.svg" className="w-5 h-5" alt="Google" />
              Google
            </button>

            <p className="text-sm text-center mt-6">
              ¿No tienes cuenta?{" "}
              <button
                onClick={() => router.push("/registro")}
                className="text-[#1E5DB8] font-semibold"
              >
                Regístrate
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}