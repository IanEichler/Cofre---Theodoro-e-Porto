import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cofre — Tudo seguro. Tudo no lugar.",
  description: "O lugar seguro para as senhas do seu escritório. Cofres compartilhados, permissões de equipe e verificação em duas etapas.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
