import "../dist/css/styles.css";
import "../dist/css/admin.css";

export const metadata = {
  title: "Maha Duck | The Master of Mala",
  description: "Order Mala Xiang Guo, Malatang, Mala Duck and Sichuan dishes online from Maha Duck, Bangkok.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="my">
      <head>
        <meta name="theme-color" content="#14532f" />
        <link rel="icon" href="/legacy/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/legacy/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Poppins:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;600;700&family=Noto+Sans+Myanmar:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
