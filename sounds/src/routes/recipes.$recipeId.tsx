import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findRecipe, RECIPES } from "~/content/recipes";
import { useStore } from "~/lib/store";
import { Crumbs } from "~/components/ui";

export const Route = createFileRoute("/recipes/$recipeId")({
  loader: ({ params }) => {
    if (!findRecipe(params.recipeId)) throw notFound();
  },
  head: ({ params }) => ({ meta: [{ title: `${findRecipe(params.recipeId)?.title ?? "Recipe"} · Fog & Pulse` }] }),
  component: RecipePage,
});

function RecipePage() {
  const { recipeId } = Route.useParams();
  const { done, toggleDone } = useStore();
  const recipe = findRecipe(recipeId);
  if (!recipe) return null;
  const key = `recipe.${recipe.id}`;
  return (
    <>
      <Crumbs section="Recipes" />
      <header className="themehead">
        <span className="lab">
          {recipe.artist} · {recipe.track} · {recipe.album}
        </span>
        <h1>{recipe.title}</h1>
        <p className="lede dim">{recipe.summary}</p>
      </header>
      <div className="reader">
        <nav className="rail" aria-label="Recipes">
          {RECIPES.map((r) => (
            <Link key={r.id} to="/recipes/$recipeId" params={{ recipeId: r.id }} aria-current={r.id === recipe.id ? "page" : undefined}>
              <span className="n">{done[`recipe.${r.id}`] ? "✓" : "··"}</span>
              <span>{r.title}</span>
            </Link>
          ))}
        </nav>
        <article className="lesson">
          <recipe.Body />
          <div className="lessonfoot">
            <button type="button" className={done[key] ? "btn isdone" : "btn primary"} onClick={() => toggleDone(key)}>
              {done[key] ? "✓ Done" : "Mark recipe done"}
            </button>
            <Link className="btn" to="/">
              All themes and recipes
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
