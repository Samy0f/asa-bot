import Elysia, { t } from "elysia";
import { eatFood } from ".";

const eat = new Elysia({ prefix: "/eat" }).get(
  "/",
  async ({ query, set }) => {
    try {
      const url = new URL(query.food);
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
      set.status = 400;
      return {
        error: "Invalid URL",
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
