"use client";

import dynamic from "next/dynamic";

const SolicitudesView = dynamic(() => import("./SolicitudesView"), {
  ssr: false,
});

export default function SolicitudesClient() {
  return <SolicitudesView />;
}