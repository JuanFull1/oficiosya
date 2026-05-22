"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const procesarCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error("Error intercambiando código OAuth:", exchangeError);
            router.replace("/login?error=google");
            return;
          }
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error("No se pudo obtener usuario Google:", userError);
          router.replace("/login?error=google");
          return;
        }

        const { data: perfil, error: perfilError } = await supabase
          .from("perfiles")
          .select("id, activo, es_cliente, es_trabajador, es_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (perfilError) {
          console.error("Error buscando perfil:", perfilError);
          await supabase.auth.signOut();
          router.replace("/login?error=google");
          return;
        }

        if (!perfil) {
          console.error("Usuario Google sin perfil. Se eliminará de Auth.");

          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.access_token) {
            const respuesta = await fetch("/api/auth/eliminar-huerfano", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
              console.error(
                "No se pudo eliminar usuario huérfano:",
                resultado
              );
            }
          }

          await supabase.auth.signOut();
          router.replace("/login?error=sin_perfil");
          return;
        }

        if (!perfil.activo) {
          await supabase.auth.signOut();
          router.replace("/login?error=usuario_inactivo");
          return;
        }

        if (!perfil.es_cliente && !perfil.es_trabajador && !perfil.es_admin) {
          await supabase.auth.signOut();
          router.replace("/login?error=sin_perfil");
          return;
        }

        if (perfil.es_admin) {
          router.replace("/admin");
          return;
        }

        router.replace("/panel");
      } catch (error) {
        console.error("Error inesperado en callback:", error);
        await supabase.auth.signOut();
        router.replace("/login?error=google");
      }
    };

    procesarCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f8ff]">
      <div className="rounded-3xl bg-white border border-[#d9e6f7] shadow-xl p-8 text-center">
        <h1 className="text-xl font-bold text-[#0B3C7F]">
          Verificando sesión...
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Espera un momento mientras validamos tu cuenta.
        </p>
      </div>
    </div>
  );
}