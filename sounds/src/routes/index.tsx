import { createFileRoute, Link } from "@tanstack/react-router";
import { CHORDS_URL, KeyBox, Logo } from "~/components/ui";
import { RECIPES } from "~/content/recipes";
import { lessonKey, THEMES, type Theme } from "~/content/themes";
import { useStore } from "~/lib/store";

export const Route = createFileRoute("/")({ component: Home });

/** Edition log, newest first. Add a line when a theme or recipe lands. */
const LOG: [string, string, string][] = [
  ["2026-11-25", "Edition 3.", "Moves to sounds.charliegleason.com, built from the ableton repo and deployed on every push to main."],
  ["2026-11-25", "Edition 2.", "A course: six themes and recipes. The Sound quality theme, the “The Peace” vocoder recipe, and the in-this-key panel."],
  ["2026-11-24", "Edition 1.", "Fog & Pulse handbook: map, drums, textures, low end, space, arrangement, live rig."],
];

function Home() {
  const { done, last, ready } = useStore();
  const resume = ready && last ? findLesson(last) : null;
  return (
    <>
      <section className="hero">
        <Logo big />
        <h1>Fog &amp; Pulse</h1>
        <p className="lede">
          A step-by-step course in music production with Ableton Live 12: high-quality audio, soundscapes, melody and pop songwriting. Big themes you work through in order, and short recipes that rebuild one sound from a real record.
        </p>
      </section>
      <div className="home">
        {resume ? (
          <Link className="continue" to="/themes/$themeId/$lessonId" params={{ themeId: resume.theme.id, lessonId: resume.lesson.id }}>
            <span className="lab">Continue</span>
            <b>
              {resume.theme.name} · {resume.lesson.title}
            </b>
            <span className="dim">→</span>
          </Link>
        ) : null}
        <section className="block">
          <h2>
            Themes <span className="dim">Longer courses, in order. Each lesson ends with something to make.</span>
          </h2>
          <div className="cards">
            {THEMES.map((t, i) => (
              <ThemeCard key={t.id} theme={t} index={i} done={done} />
            ))}
          </div>
        </section>
        <section className="block">
          <h2>
            Recipes <span className="dim">One sound, rebuilt from a real record.</span>
          </h2>
          <div className="list">
            {RECIPES.map((r) => (
              <Link key={r.id} to="/recipes/$recipeId" params={{ recipeId: r.id }}>
                <span className="t">{r.title}</span>
                <span className={done[`recipe.${r.id}`] ? "chip lit" : "chip cool"}>{done[`recipe.${r.id}`] ? "Done" : "Recipe"}</span>
                <span className="s">
                  {r.artist} · {r.track} · {r.summary}
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="block">
          <h2>
            In this key{" "}
            <span className="dim">
              Follows the key and mode above. Harmony in depth lives in <a href={CHORDS_URL}>Chords</a>.
            </span>
          </h2>
          <KeyBox />
        </section>
        <section className="block">
          <h2>Edition log</h2>
          <div className="log">
            {LOG.map(([date, title, text]) => (
              <div key={title}>
                <time dateTime={date}>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
                <span>
                  <b>{title}</b> {text}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function ThemeCard({ theme, index, done }: { theme: Theme; index: number; done: Record<string, true> }) {
  const total = theme.lessons.length;
  const complete = theme.lessons.filter((l) => done[lessonKey(theme, l)]).length;
  const status = total === 0 ? <span className="chip">Planned</span> : complete === total ? <span className="chip lit">Done</span> : <span className="chip">{total} {total === 1 ? "lesson" : "lessons"}</span>;
  return (
    <Link className="card" to="/themes/$themeId" params={{ themeId: theme.id }}>
      <div className="top">
        <span className="num">{String(index + 1).padStart(2, "0")}</span>
        {status}
      </div>
      <div className="name">{theme.name}</div>
      <div className="blurb">{theme.blurb}</div>
      <div className="meta">
        {total === 0 ? (
          <span className="src">{theme.planned.length} lessons planned</span>
        ) : (
          <>
            <div className="bar" role="img" aria-label={`${complete} of ${total} done`}>
              <i style={{ width: `${(complete / total) * 100}%` }} />
            </div>
            <span className="src">
              {complete} of {total} done
            </span>
          </>
        )}
      </div>
    </Link>
  );
}

function findLesson(key: string) {
  const [themeId, lessonId] = key.split(".");
  const theme = THEMES.find((t) => t.id === themeId);
  const lesson = theme?.lessons.find((l) => l.id === lessonId);
  return theme && lesson ? { theme, lesson } : null;
}
