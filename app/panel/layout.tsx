import PanelLayout from "./PanelLayout";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PanelLayout>{children}</PanelLayout>;
}