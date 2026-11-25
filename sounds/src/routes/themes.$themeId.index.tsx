import { createFileRoute, notFound } from "@tanstack/react-router";
import { ThemeView } from "~/components/ThemeView";
import { findTheme } from "~/content/themes";

export const Route = createFileRoute("/themes/$themeId/")({
  loader: ({ params }) => {
    if (!findTheme(params.themeId)) throw notFound();
  },
  head: ({ params }) => ({ meta: [{ title: `${findTheme(params.themeId)?.name ?? "Theme"} · Fog & Pulse` }] }),
  component: ThemeIndex,
});

function ThemeIndex() {
  const { themeId } = Route.useParams();
  const theme = findTheme(themeId);
  return theme ? <ThemeView theme={theme} /> : null;
}
