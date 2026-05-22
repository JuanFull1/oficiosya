"use client";

import { useRouter } from "next/navigation";

export default function MapaView() {
  const router = useRouter();

  return (
    <div className="mock-wrapper">
      <div className="phone">
        <div className="map-title-bar blue-header">
          <div className="back-row">
            <button
              className="text-white font-bold text-xl"
              onClick={() => router.push("/cliente")}
            >
              ←
            </button>
          </div>

          <div className="map-big-title">Servicio en Camino</div>
          <div className="soft-line bg-white/30 mt-2" />
          <div className="map-subtext">
            Juan Pérez está en camino hacia tu ubicación.
          </div>
        </div>

        <div className="fake-map">
          <div className="fake-river" />
          <div className="worker-bubble">
            <div className="scooter">🛵</div>
            <div className="name-pill">Juan Pérez</div>
          </div>

          <div className="route-line" />
          <div className="pin-red" />
          <div className="location-pill">Tu Ubicación</div>
        </div>

        <div className="bottom-panel">
          <div className="eta-row">
            <div className="eta-line" />
            <div className="eta-text">Tiempo Estimado: 8 min</div>
            <div className="eta-line" />
          </div>

          <div className="contact-card">
            <div className="contact-avatar">👨‍🔧</div>

            <div className="flex-1">
              <div className="contact-name">Juan Pérez</div>
              <div className="contact-info">⚡ Electricista</div>
              <div className="contact-info">📞 Tel: 555-123-4567</div>

              <button className="call-btn">📞 Llamar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}