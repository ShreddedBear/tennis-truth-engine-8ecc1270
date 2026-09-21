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
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

import { Toaster } from "@/components/ui/sonner";

const baseUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Tennis Matrix Audit" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: `${baseUrl}favicon.ico`, type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  // publishableKeyFromHost() throws "Host must not be empty" during SSR when
  // VITE_CLERK_PUBLISHABLE_KEY isn't set (or isn't a recognized dev key) --
  // there's no window/hostname on the server, and Clerk explicitly refuses
  // to derive a key from an empty host. That crash previously took down the
  // ENTIRE app (every server-rendered route 500s) whenever the key was
  // missing, rather than degrading to a clear "auth not configured" state.
  // The real fix is setting a valid VITE_CLERK_PUBLISHABLE_KEY; this guard
  // just stops a missing key from being an app-wide outage.
  let publishableKey = "";
  try {
    publishableKey = publishableKeyFromHost(
      typeof window === "undefined" ? "" : window.location.hostname,
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    );
  } catch (error) {
    if (typeof window === "undefined") {
      console.error(
        "[Clerk] No usable publishable key -- set VITE_CLERK_PUBLISHABLE_KEY. Rendering without auth for this request.",
        error,
      );
    }
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      appearance={{
        theme: shadcn,
        options: {
          logoPlacement: "inside",
          logoLinkUrl: import.meta.env.BASE_URL,
          logoImageUrl: `${typeof window === "undefined" ? "" : window.location.origin}${import.meta.env.BASE_URL}logo.svg`,
        },
        variables: {
          colorPrimary: "hsl(var(--primary))",
          colorForeground: "hsl(var(--foreground))",
          colorBackground: "hsl(var(--background))",
          colorInput: "hsl(var(--background))",
          colorInputForeground: "hsl(var(--foreground))",
          colorNeutral: "hsl(var(--border))",
          fontFamily: "IBM Plex Sans, sans-serif",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
