/**
 * Service Worker registration with strict environment guards.
 *
 * The Lovable editor preview runs the app inside an iframe and cannot host
 * service workers safely (causes stale content + navigation interference).
 * The SW is only registered on the production / installed PWA host.
 */

const PREVIEW_HOST_PATTERNS = [
  /\.lovableproject\.com$/i,
  /\.lovableproject-dev\.com$/i,
  /^id-preview--/i,
  /^preview--/i,
];

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const host = window.location.hostname;
  const isPreviewHost = PREVIEW_HOST_PATTERNS.some((re) => re.test(host));

  if (inIframe || isPreviewHost) {
    // Defensive cleanup of any SW that may have been registered previously.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    return;
  }

  // Use the workbox-window helper provided by vite-plugin-pwa at build time.
  // We import dynamically so the registration code is only loaded in eligible hosts.
  import("workbox-window")
    .then(({ Workbox }) => {
      const wb = new Workbox("/sw.js", { scope: "/" });
      wb.addEventListener("waiting", () => {
        // New version ready — force activation on next reload.
        wb.messageSkipWaiting();
      });
      wb.addEventListener("controlling", () => {
        // Service worker took control; reload once to pick up fresh assets.
        if (!sessionStorage.getItem("__sw_reloaded__")) {
          sessionStorage.setItem("__sw_reloaded__", "1");
          window.location.reload();
        }
      });
      wb.register().catch((err) => {
        console.warn("[PWA] register failed", err);
      });
    })
    .catch((err) => console.warn("[PWA] workbox-window unavailable", err));
}
