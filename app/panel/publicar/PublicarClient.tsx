"use client";

import dynamic from "next/dynamic";

const PublicarView = dynamic(() => import("./PublicarView"), {
  ssr: false,
});

export default function PublicarClient() {
  return <PublicarView />;
}