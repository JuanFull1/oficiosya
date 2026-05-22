"use client";

import { useRouter } from "next/navigation";

export default function RegistroView() {
  const router = useRouter();

  return (
    <div className="center-screen">
      <div className="simple-card">
        <h1 className="text-2xl font-extrabold text-[#134a9a] mb-2">Registro</h1>
        <p className="text-sm text-[#6c84a8] mb-6">
          Aquí luego pondremos el formulario completo.
        </p>

        <div className="space-y-3">
          <input className="field" placeholder="Nombre completo" />
          <input className="field" placeholder="Correo" />
          <input className="field" placeholder="Contraseña" type="password" />
          <button className="primary-btn">Crear cuenta</button>
          <button className="secondary-btn" onClick={() => router.push("/login")}>
            Volver al login
          </button>
        </div>
      </div>
    </div>
  );
}