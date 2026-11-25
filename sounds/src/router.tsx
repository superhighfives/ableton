import { createRouter, Link } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
  });
}

function NotFound() {
  return (
    <div className="empty">
      <h1>Not found</h1>
      <p>That theme, lesson or recipe doesn’t exist.</p>
      <Link to="/">Back to Fog &amp; Pulse</Link>
    </div>
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
