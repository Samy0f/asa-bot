import Elysia, { t } from "elysia";

const eat = new Elysia({ prefix: "/eat" }).get(
  "/",
  async ({ query, set }) => {
    let url: URL;

    try {
      url = new URL(query.food);
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
      return gif;
    } catch (error) {
      console.error("Eat route error:", error);
      set.status = 500;
      return {
        error: "Failed to generate GIF",
      };
    }
  },
  {
    query: t.Object({
      food: t.String(),
    }),
  }
);

export default eat;
