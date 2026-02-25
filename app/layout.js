import "./globals.css";

export const metadata = {
  title: "PaceTune",
  description: "Match your runs with Spotify listening history."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
