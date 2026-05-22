"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Flag,
  Loader2,
  ShieldCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  activo: boolean;
  verificado: boolean;
  es_trabajador: boolean;
  es_cliente: boolean;
  es_admin: boolean;
  zona: string | null;
};

type Verificacion = {
  id: string;
  estado: "pendiente" | "aprobada" | "rechazada";
};

type Reporte = {
  id: string;
  estado: "pendiente" | "en_revision" | "resuelto" | "rechazado";
  creado_en: string;
};

type Servicio = {
  id: string;
  estado: string;
  creado_en: string;
};

type CacheDashboard = {
  usuarios: Perfil[];
  verificaciones: Verificacion[];
  reportes: Reporte[];
  servicios: Servicio[];
};

const CACHE_KEY = "oficiosya-admin-dashboard-cache";

export default function DashboardAdminView() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [verificaciones, setVerificaciones] = useState<Verificacion[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);

  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState("");

  const leerCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;

      const cache = JSON.parse(raw) as CacheDashboard;

      setUsuarios(cache.usuarios || []);
      setVerificaciones(cache.verificaciones || []);
      setReportes(cache.reportes || []);
      setServicios(cache.servicios || []);
    } catch (err) {
      console.error("No se pudo leer cache dashboard admin:", err);
    }
  }, []);

  const guardarCache = useCallback((cache: CacheDashboard) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (err) {
      console.error("No se pudo guardar cache dashboard admin:", err);
    }
  }, []);

  const cargarDashboard = useCallback(async () => {
    setSincronizando(true);
    setError("");

    try {
      const [usuariosResp, verificacionesResp, reportesResp, serviciosResp] =
        await Promise.all([
          supabase
            .from("perfiles")
            .select(
              "id,activo,verificado,es_trabajador,es_cliente,es_admin,zona"
            ),

          supabase.from("verificaciones_identidad").select("id,estado"),

          supabase.from("reportes").select("id,estado,creado_en"),

          supabase.from("servicios").select("id,estado,creado_en"),
        ]);

      if (usuariosResp.error) throw usuariosResp.error;
      if (verificacionesResp.error) throw verificacionesResp.error;
      if (reportesResp.error) throw reportesResp.error;
      if (serviciosResp.error) throw serviciosResp.error;

      const usuariosData = (usuariosResp.data || []) as Perfil[];
      const verificacionesData = (verificacionesResp.data ||
        []) as Verificacion[];
      const reportesData = (reportesResp.data || []) as Reporte[];
      const serviciosData = (serviciosResp.data || []) as Servicio[];

      setUsuarios(usuariosData);
      setVerificaciones(verificacionesData);
      setReportes(reportesData);
      setServicios(serviciosData);

      guardarCache({
        usuarios: usuariosData,
        verificaciones: verificacionesData,
        reportes: reportesData,
        servicios: serviciosData,
      });
    } catch (err) {
      console.error("Error dashboard admin:", err);
      setError("No se pudo cargar el resumen administrativo.");
    } finally {
      setSincronizando(false);
    }
  }, [guardarCache]);

  useEffect(() => {
    leerCache();
    cargarDashboard();
  }, [leerCache, cargarDashboard]);

  const metricas = useMemo(() => {
    const serviciosActivos = servicios.filter((s) =>
      ["confirmado", "en_camino", "en_curso"].includes(s.estado)
    );

    return {
      usuariosRegistrados: usuarios.length,
      trabajadoresActivos: usuarios.filter(
        (u) => u.es_trabajador && u.activo
      ).length,
      clientes: usuarios.filter((u) => u.es_cliente).length,
      administradores: usuarios.filter((u) => u.es_admin).length,
      usuariosSuspendidos: usuarios.filter((u) => !u.activo).length,
      usuariosVerificados: usuarios.filter((u) => u.verificado).length,
      serviciosActivos: serviciosActivos.length,
      serviciosFinalizados: servicios.filter((s) => s.estado === "finalizado")
        .length,
      reportesPendientes: reportes.filter((r) => r.estado === "pendiente")
        .length,
      reportesEnRevision: reportes.filter((r) => r.estado === "en_revision")
        .length,
      verificacionesPendientes: verificaciones.filter(
        (v) => v.estado === "pendiente"
      ).length,
      verificacionesAprobadas: verificaciones.filter(
        (v) => v.estado === "aprobada"
      ).length,
    };
  }, [usuarios, verificaciones, reportes, servicios]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
                <BarChart3 size={28} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    Dashboard administrativo
                  </h1>

                  {sincronizando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                      <Loader2 size={12} className="animate-spin" />
                      Actualizando
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  Resumen general de usuarios, servicios, reportes y
                  verificaciones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Usuarios registrados"
          value={metricas.usuariosRegistrados}
          icon={<UsersRound size={24} />}
          tone="slate"
        />

        <MetricCard
          title="Trabajadores activos"
          value={metricas.trabajadoresActivos}
          icon={<ShieldCheck size={24} />}
          tone="emerald"
        />

        <MetricCard
          title="Servicios activos"
          value={metricas.serviciosActivos}
          icon={<Clock3 size={24} />}
          tone="amber"
        />

        <MetricCard
          title="Servicios finalizados"
          value={metricas.serviciosFinalizados}
          icon={<CheckCircle2 size={24} />}
          tone="emerald"
        />

        <MetricCard
          title="Reportes pendientes"
          value={metricas.reportesPendientes}
          icon={<Flag size={24} />}
          tone="red"
        />

        <MetricCard
          title="Verificaciones pendientes"
          value={metricas.verificacionesPendientes}
          icon={<FileCheck2 size={24} />}
          tone="amber"
        />

        <MetricCard
          title="Usuarios suspendidos"
          value={metricas.usuariosSuspendidos}
          icon={<XCircle size={24} />}
          tone="red"
        />

        <MetricCard
          title="Usuarios verificados"
          value={metricas.usuariosVerificados}
          icon={<BadgeCheck size={24} />}
          tone="emerald"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Estado de reportes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Casos pendientes y en revisión.
          </p>

          <div className="mt-5 space-y-3">
            <ProgressItem
              label="Pendientes"
              value={metricas.reportesPendientes}
              total={Math.max(reportes.length, 1)}
            />
            <ProgressItem
              label="En revisión"
              value={metricas.reportesEnRevision}
              total={Math.max(reportes.length, 1)}
            />
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Estado de verificaciones
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Solicitudes pendientes y aprobadas.
          </p>

          <div className="mt-5 space-y-3">
            <ProgressItem
              label="Pendientes"
              value={metricas.verificacionesPendientes}
              total={Math.max(verificaciones.length, 1)}
            />
            <ProgressItem
              label="Aprobadas"
              value={metricas.verificacionesAprobadas}
              total={Math.max(verificaciones.length, 1)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "slate" | "emerald" | "amber" | "red";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone]}`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function ProgressItem({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = Math.min(100, Math.round((value / total) * 100));

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold text-slate-900">{value}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}