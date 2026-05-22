"use client";

import dynamic from "next/dynamic";

const SeguimientoView = dynamic(() => import("./SeguimientoView"), {
  ssr: false,
});

export default function SeguimientoClient() {
  return <SeguimientoView />;
}