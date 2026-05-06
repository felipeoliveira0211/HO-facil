import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "HO fácil — Folha de campo" },
      {
        name: "description",
        content:
          "HO fácil: folha de campo digital para higiene ocupacional, com cronômetro, pausa e captura de assinatura.",
      },
      { property: "og:title", content: "HO fácil — Folha de campo" },
      { name: "twitter:title", content: "HO fácil — Folha de campo" },
      { name: "description", content: "HO-facil digitizes occupational hygiene field sheets, capturing worker signatures and tracking assessments." },
      { property: "og:description", content: "HO-facil digitizes occupational hygiene field sheets, capturing worker signatures and tracking assessments." },
      { name: "twitter:description", content: "HO-facil digitizes occupational hygiene field sheets, capturing worker signatures and tracking assessments." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/215295de-28b9-4ed5-a119-b369b002ee05/id-preview-1987239c--9b2ef4e4-f26c-4693-800c-9a1d52b8e9a6.lovable.app-1776864344144.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/215295de-28b9-4ed5-a119-b369b002ee05/id-preview-1987239c--9b2ef4e4-f26c-4693-800c-9a1d52b8e9a6.lovable.app-1776864344144.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body className="safe-area-all">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
