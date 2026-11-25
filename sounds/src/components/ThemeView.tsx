import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { lessonKey, type Theme } from "~/content/themes";
import { useStore } from "~/lib/store";
import { Crumbs } from "~/components/ui";

/** A theme: the lesson rail beside one lesson, or the planned outline. */
export function ThemeView({ theme, lessonId }: { theme: Theme; lessonId?: string }) {
  const { done, toggleDone, visit } = useStore();
  const index = Math.max(0, theme.lessons.findIndex((l) => l.id === lessonId));
  const lesson = theme.lessons[index];
  const key = lesson ? lessonKey(theme, lesson) : null;
  const complete = theme.lessons.filter((l) => done[lessonKey(theme, l)]).length;

  useEffect(() => {
    if (key) visit(key);
  }, [key, visit]);

  const prev = theme.lessons[index - 1];
  const next = theme.lessons[index + 1];

  return (
    <>
      <Crumbs section="Themes" />
      <header className="themehead">
        <h1>{theme.name}</h1>
        <p className="lede dim">{theme.blurb}</p>
        {theme.lessons.length ? (
          <span className="src">
            {complete} of {theme.lessons.length} lessons done
            {theme.planned.length ? ` · ${theme.planned.length} planned` : ""}
          </span>
        ) : null}
      </header>
      <div className="reader">
        <nav className="rail" aria-label="Lessons">
          {theme.lessons.map((l, i) => {
            const isDone = !!done[lessonKey(theme, l)];
            return (
              <Link
                key={l.id}
                to="/themes/$themeId/$lessonId"
                params={{ themeId: theme.id, lessonId: l.id }}
                className={isDone ? "done" : undefined}
                aria-current={i === index ? "page" : undefined}
              >
                <span className="n">{isDone ? "✓" : String(i + 1).padStart(2, "0")}</span>
                <span>{l.title}</span>
              </Link>
            );
          })}
          {theme.planned.map((p) => (
            <span key={p} className="planned">
              <span className="n">··</span>
              <span>{p}</span>
            </span>
          ))}
        </nav>
        {lesson && key ? (
          <article className="lesson">
            <div>
              <span className="lab">
                Lesson {index + 1} of {theme.lessons.length}
              </span>
              <h2>{lesson.title}</h2>
            </div>
            <lesson.Body />
            <div className="lessonfoot">
              <button type="button" className={done[key] ? "btn isdone" : "btn primary"} onClick={() => toggleDone(key)}>
                {done[key] ? "✓ Done" : "Mark lesson done"}
              </button>
              <div className="navbtns">
                {prev ? (
                  <Link className="btn" to="/themes/$themeId/$lessonId" params={{ themeId: theme.id, lessonId: prev.id }}>
                    ← {prev.title}
                  </Link>
                ) : null}
                {next ? (
                  <Link className="btn" to="/themes/$themeId/$lessonId" params={{ themeId: theme.id, lessonId: next.id }}>
                    {next.title} →
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ) : (
          <div className="lesson">
            <p>This theme is planned. Its lessons are listed alongside; ask Claude to write the first one and it lands here.</p>
            {theme.Extra ? <theme.Extra /> : null}
          </div>
        )}
      </div>
    </>
  );
}
