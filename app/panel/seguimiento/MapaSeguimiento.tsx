"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type PuntoMapa = {
  lat: number | null;
  lng: number | null;
  nombre: string;
  rumbo?: number | null;
};

type Props = {
  cliente: PuntoMapa;
  trabajador: PuntoMapa;
  modo: "cliente" | "trabajador";
};

type RutaInfo = {
  principal: [number, number][];
  alternativas: [number, number][][];
  distanciaKm: string;
  duracionMin: string;
  instruccion: string;
};

function crearIconoTrabajador(rumbo?: number | null) {
  const grados = Number.isFinite(Number(rumbo)) ? Number(rumbo) : 0;

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 62px;
        height: 62px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.24);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 0 10px rgba(37, 99, 235, 0.10);
      ">
        <div style="
          width: 42px;
          height: 42px;
          border-radius: 999px;
          background: linear-gradient(135deg, #2563eb, #60a5fa);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.38);
          transform: rotate(${grados}deg);
        ">
          <svg width="25" height="25" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L21 22L12 18L3 22L12 2Z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [62, 62],
    iconAnchor: [31, 31],
    popupAnchor: [0, -30],
  });
}

function crearIconoCliente() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 46px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 12px 14px rgba(220, 38, 38, .35));
      ">
        <svg width="46" height="56" viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M32 4C18.2 4 7 15.2 7 29c0 19.5 25 47 25 47s25-27.5 25-47C57 15.2 45.8 4 32 4Z"
            fill="#dc2626"
            stroke="white"
            stroke-width="5"
          />
          <circle cx="32" cy="29" r="9" fill="#7f1d1d"/>
        </svg>
      </div>
    `,
    iconSize: [46, 56],
    iconAnchor: [23, 53],
    popupAnchor: [0, -50],
  });
}

function convertirCoordenadas(coordenadas: [number, number][]) {
  return coordenadas.map((punto) => [punto[1], punto[0]]) as [number, number][];
}

function textoInstruccion(maniobra: string, nombreVia: string, distancia: number) {
  const metros = Math.max(10, Math.round(distancia / 10) * 10);
  const via = nombreVia ? ` hacia ${nombreVia}` : "";

  if (maniobra === "turn") return `Gira${via} en ${metros} metros`;
  if (maniobra === "new name") return `Continúa${via} en ${metros} metros`;
  if (maniobra === "depart") return `Inicia el recorrido${via}`;
  if (maniobra === "arrive") return "Has llegado al destino";
  if (maniobra === "roundabout") return `Toma la rotonda${via} en ${metros} metros`;

  return `Continúa${via} por ${metros} metros`;
}

function AjustarMapa({ cliente, trabajador }: Props) {
  const map = useMap();

  useEffect(() => {
    const puntos: [number, number][] = [];

    if (cliente.lat !== null && cliente.lng !== null) {
      puntos.push([cliente.lat, cliente.lng]);
    }

    if (trabajador.lat !== null && trabajador.lng !== null) {
      puntos.push([trabajador.lat, trabajador.lng]);
    }

    setTimeout(() => {
      map.invalidateSize();

      if (puntos.length === 1) {
        map.setView(puntos[0], 17);
      }

      if (puntos.length === 2) {
        map.fitBounds(puntos, {
          padding: [95, 95],
          maxZoom: 16,
        });
      }
    }, 200);
  }, [cliente.lat, cliente.lng, trabajador.lat, trabajador.lng, map]);

  return null;
}

function BotonCentrar({ cliente, trabajador, modo }: Props) {
  const map = useMap();

  const centrar = () => {
    if (
      modo === "trabajador" &&
      trabajador.lat !== null &&
      trabajador.lng !== null
    ) {
      map.setView([trabajador.lat, trabajador.lng], 18);
      return;
    }

    if (modo === "cliente" && cliente.lat !== null && cliente.lng !== null) {
      map.setView([cliente.lat, cliente.lng], 18);
      return;
    }

    if (cliente.lat !== null && cliente.lng !== null) {
      map.setView([cliente.lat, cliente.lng], 18);
      return;
    }

    if (trabajador.lat !== null && trabajador.lng !== null) {
      map.setView([trabajador.lat, trabajador.lng], 18);
    }
  };

  return (
    <div className="leaflet-bottom leaflet-left">
      <div className="leaflet-control m-4">
        <button
          type="button"
          onClick={centrar}
          className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-xl hover:bg-slate-800"
        >
          <span className="text-lg">▲</span>
          Centrar
        </button>
      </div>
    </div>
  );
}

function PanelNavegacion({
  ruta,
  modo,
}: {
  ruta: RutaInfo | null;
  modo: "cliente" | "trabajador";
}) {
  const dijoRef = useRef("");

  useEffect(() => {
    if (modo !== "trabajador") return;
    if (!ruta?.instruccion) return;
    if (dijoRef.current === ruta.instruccion) return;

    dijoRef.current = ruta.instruccion;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const voz = new SpeechSynthesisUtterance(ruta.instruccion);
      voz.lang = "es-EC";
      voz.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(voz);
    }
  }, [ruta?.instruccion, modo]);

  if (!ruta || modo !== "trabajador") return null;

  return (
    <>
      <div className="leaflet-top leaflet-left">
        <div className="leaflet-control m-4 rounded-[22px] bg-teal-800 px-5 py-4 text-white shadow-2xl">
          <p className="text-xs font-semibold text-teal-100">
            Siguiente indicación
          </p>
          <p className="mt-1 text-xl font-bold">{ruta.instruccion}</p>
        </div>
      </div>

      <div className="leaflet-bottom leaflet-right">
        <div className="leaflet-control m-4 rounded-[24px] bg-slate-950 px-6 py-4 text-white shadow-2xl">
          <p className="text-3xl font-extrabold text-amber-400">
            {ruta.duracionMin}
          </p>
          <p className="mt-1 text-sm text-slate-300">{ruta.distanciaKm}</p>
        </div>
      </div>
    </>
  );
}

function RutaPorCalles({ cliente, trabajador, modo }: Props) {
  const [ruta, setRuta] = useState<RutaInfo | null>(null);

  useEffect(() => {
    const cargarRuta = async () => {
      if (
        cliente.lat === null ||
        cliente.lng === null ||
        trabajador.lat === null ||
        trabajador.lng === null
      ) {
        setRuta(null);
        return;
      }

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${trabajador.lng},${trabajador.lat};${cliente.lng},${cliente.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;

        const respuesta = await fetch(url);
        const data = await respuesta.json();
        const rutas = data?.routes;

        if (!Array.isArray(rutas) || !rutas[0]?.geometry?.coordinates) {
          setRuta(null);
          return;
        }

        const principal = convertirCoordenadas(rutas[0].geometry.coordinates);

        const alternativas = rutas
          .slice(1, 3)
          .filter((item) => Array.isArray(item?.geometry?.coordinates))
          .map((item) => convertirCoordenadas(item.geometry.coordinates));

        const primerPaso = rutas[0]?.legs?.[0]?.steps?.[0];
        const segundoPaso = rutas[0]?.legs?.[0]?.steps?.[1];
        const paso = segundoPaso || primerPaso;

        const instruccion = textoInstruccion(
          paso?.maneuver?.type || "continue",
          paso?.name || "",
          Number(paso?.distance || 100)
        );

        const distanciaKm = `${(Number(rutas[0].distance || 0) / 1000).toFixed(
          1
        )} km`;

        const minutos = Math.max(
          1,
          Math.round(Number(rutas[0].duration || 0) / 60)
        );

        const duracionMin =
          minutos >= 60
            ? `${Math.floor(minutos / 60)} h ${minutos % 60} min`
            : `${minutos} min`;

        setRuta({
          principal,
          alternativas,
          distanciaKm,
          duracionMin,
          instruccion,
        });
      } catch (error) {
        console.error("Error al cargar ruta:", error);
        setRuta(null);
      }
    };

    cargarRuta();
  }, [cliente.lat, cliente.lng, trabajador.lat, trabajador.lng]);

  if (!ruta) {
    return <PanelNavegacion ruta={null} modo={modo} />;
  }

  return (
    <>
      {ruta.alternativas.map((alternativa, index) => (
        <Polyline
          key={`alternativa-${index}`}
          positions={alternativa}
          pathOptions={{
            color: "#7dd3fc",
            weight: 6,
            opacity: 0.7,
          }}
        />
      ))}

      <Polyline
        positions={ruta.principal}
        pathOptions={{
          color: "#2563eb",
          weight: 9,
          opacity: 0.95,
        }}
      />

      <Polyline
        positions={ruta.principal}
        pathOptions={{
          color: "#facc15",
          weight: 4,
          opacity: 0.45,
          dashArray: "18 18",
        }}
      />

      <PanelNavegacion ruta={ruta} modo={modo} />
    </>
  );
}

export default function MapaSeguimiento({ cliente, trabajador, modo }: Props) {
  const centro = useMemo<[number, number]>(() => {
    if (
      cliente.lat !== null &&
      cliente.lng !== null &&
      trabajador.lat !== null &&
      trabajador.lng !== null
    ) {
      return [
        (cliente.lat + trabajador.lat) / 2,
        (cliente.lng + trabajador.lng) / 2,
      ];
    }

    if (cliente.lat !== null && cliente.lng !== null) {
      return [cliente.lat, cliente.lng];
    }

    if (trabajador.lat !== null && trabajador.lng !== null) {
      return [trabajador.lat, trabajador.lng];
    }

    return [-1.24908, -78.61675];
  }, [cliente.lat, cliente.lng, trabajador.lat, trabajador.lng]);

  return (
    <MapContainer
      center={centro}
      zoom={16}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <AjustarMapa cliente={cliente} trabajador={trabajador} modo={modo} />
      <RutaPorCalles cliente={cliente} trabajador={trabajador} modo={modo} />
      <BotonCentrar cliente={cliente} trabajador={trabajador} modo={modo} />

      {cliente.lat !== null && cliente.lng !== null && (
        <Marker position={[cliente.lat, cliente.lng]} icon={crearIconoCliente()}>
          <Popup>
            <strong>Ubicación del servicio</strong>
            <br />
            {cliente.nombre}
          </Popup>
        </Marker>
      )}

      {trabajador.lat !== null && trabajador.lng !== null && (
        <Marker
          position={[trabajador.lat, trabajador.lng]}
          icon={crearIconoTrabajador(trabajador.rumbo)}
        >
          <Popup>
            <strong>Trabajador</strong>
            <br />
            {trabajador.nombre}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}