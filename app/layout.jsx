import "./globals.css";

export const metadata = {
  title: "ImmoCIV — Immobilier Côte d'Ivoire",
  description: "Trouve ton bien idéal en Côte d'Ivoire. Maisons, appartements, terrains à vendre ou à louer.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
