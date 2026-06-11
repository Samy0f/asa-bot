import { and, eq, gte, ilike, lte, sql } from "drizzle-orm";
import db from "../db";
import { bookmarks } from "../db/schema";
import { Type } from "@google/genai";
import { getImageDataFromUrl } from "../lib/utils";
import { uploadToR2 } from "../lib/r2";

export const searchBookmarks = {
  execute: async (
    userId: string,
    query: string,
    dateRange?: { start?: string; end?: string }
  ) => {
    try {
      const whereClause = [
        eq(bookmarks.userId, userId),
        sql`to_tsvector('english', ${bookmarks.name}) @@ plainto_tsquery('english', ${query})`,
      ];
      if (dateRange?.start) {
        whereClause.push(gte(bookmarks.createdAt, new Date(dateRange.start)));
      }
      if (dateRange?.end) {
        whereClause.push(lte(bookmarks.createdAt, new Date(dateRange.end)));
      }

      const bookmarksData = await db
        .select({
          id: bookmarks.id,
          name: bookmarks.name,
          imageUrl: bookmarks.imageUrl,
          createdAt: bookmarks.createdAt,
        })
        .from(bookmarks)
        .where(and(...whereClause));

      return bookmarksData;
    } catch (error) {
      console.error("Error searching bookmarks:", error);
      return [];
    }
  },
  tool: {
    name: "searchBookmarks",
    description:
      "Search for a user's saved images bookmarks, try to simplify the query if possible. e.g. 'shark meme' -> 'shark' (no need to mention the word 'meme')",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The query to search for",
        },
        dateRange: {
          type: Type.OBJECT,
          description: "The date range to search for",
          properties: {
            start: {
              type: Type.STRING,
              description:
                "The start date to search for (javascript date string)",
            },
            end: {
              type: Type.STRING,
              description:
                "The end date to search for (javascript date string)",
            },
          },
        },
      },
      required: ["query"],
    },
  },
};

export const saveBookmark = {
  execute: async ({
    userId,
    guildId,
    name,
    imageUrl,
    contentType,
  }: {
    userId: string;
    guildId?: string;
    name: string;
    imageUrl: string;
    contentType?: string;
  }) => {
    try {
      if (!contentType) {
        contentType = imageUrl.split(".").pop()?.toLowerCase() || "image/png";
      }
      const { buffer, r2Key } = await getImageDataFromUrl(
        imageUrl,
        contentType,
        userId
      );
      const savedUrl = await uploadToR2(buffer, r2Key, contentType);
      await db.insert(bookmarks).values({
        userId,
        guildId: guildId || "DM",
        name,
        imageUrl: savedUrl,
        r2Key,
      });
      return savedUrl;
    } catch (error) {
      console.error("Error saving bookmark:", error);
    }
  },
  tool: {
    name: "saveBookmark",
    description: "Save a bookmark for a user",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "The name of the bookmark",
        },
        imageUrl: {
          type: Type.STRING,
          description: "The URL of the image to save as a bookmark",
        },
        contentType: {
          type: Type.STRING,
          description: "The content type of the image",
        },
      },
      required: ["name", "imageUrl"],
    },
  },
};
