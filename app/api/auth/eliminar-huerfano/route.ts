import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Faltan variables de entorno de Supabase en el servidor.",
        },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error: userError,
    } = await supabasePublic.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sesión inválida." },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (perfilError) {
      return NextResponse.json(
        { error: "No se pudo verificar el perfil." },
        { status: 500 }
      );
    }

    if (perfil) {
      return NextResponse.json(
        { error: "El usuario sí tiene perfil. No se puede eliminar." },
        { status: 409 }
      );
    }

    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Usuario huérfano eliminado correctamente.",
    });
  } catch (error) {
    console.error("Error eliminando usuario huérfano:", error);

    return NextResponse.json(
      { error: "Error inesperado eliminando usuario huérfano." },
      { status: 500 }
    );
  }
}