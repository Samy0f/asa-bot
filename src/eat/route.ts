import Elysia, { t } from "elysia";

const eatQuery = t.Object({
  food: t.String(),
});

async function buildEatGif(
  food: string,
  set: { status?: number | string; headers: Record<string, string | number> }
) {
  let url: URL;

  try {
    url = new URL(food);
  } catch {
    set.status = 400;
    return {
      error: "Invalid URL",
    };
  }

  try {
    const { eatFood } = await import("./index");
    const gif = await eatFood(url.href);

    if (!gif) {
      set.status = 500;
      return {
        error: "Failed to generate GIF",
      };
    }

    set.headers["Content-Type"] = "image/gif";
    set.headers["Content-Disposition"] = 'inline; filename="asa-eat.gif"';
    set.headers["Cache-Control"] = "public, max-age=3600, no-transform";
    return gif;
  } catch (error) {
    console.error("Eat route error:", error);
    set.status = 500;
    return {
      error: "Failed to generate GIF",
    };
  }
}

const eat = new Elysia({ prefix: "/eat" })
  .get(
    "/",
    async ({ query, set }) => {
      return buildEatGif(query.food, set);
    },
    {
      query: eatQuery,
    }
  )
  .get(
    "/asa.gif",
    async ({ query, set }) => {
      return buildEatGif(query.food, set);
    },
    {
      query: eatQuery,
    }
  );

export default eat;
