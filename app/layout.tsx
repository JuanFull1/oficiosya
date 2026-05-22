// app/layout.tsx
import { Poppins } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={poppins.className}>
        {children}
      </body>
    </html>
  );
}