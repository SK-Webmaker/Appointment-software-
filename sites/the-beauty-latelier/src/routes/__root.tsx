import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SITE } from "../site.config";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-5">
      <div className="max-w-md text-center">
        <p className="eyebrow">Page not found</p>
        <h1 className="mt-4 text-[44px] leading-none text-espresso">
          This page <em className="text-bronze">wandered off.</em>
        </h1>
        <p className="mt-4 text-[15px] text-mocha">The page you're looking for doesn't exist or has moved.</p>
        <div className="mt-8">
          <Link to="/" className="btn-primary">
            Back to the atelier
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-5">
      <div className="max-w-md text-center">
        <h1 className="text-[32px] leading-tight text-espresso">This page didn't load</h1>
        <p className="mt-3 text-[15px] text-mocha">Something went wrong on our end. You can try again, or message {SITE.founder} directly.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-primary"
          >
            Try again
          </button>
          <a href={SITE.instagramDm} className="btn-ghost">
            Message on Instagram
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "author", content: SITE.name },
      { name: "theme-color", content: "#FBF9F1" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:locale", content: "en_AU" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      // Self-hosted fonts the first screen needs, fetched alongside the CSS.
      { rel: "preload", href: "/fonts/bodoni-moda-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/bodoni-moda-italic.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/montserrat-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
