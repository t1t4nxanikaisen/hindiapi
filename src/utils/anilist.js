// src/utils/anilist.js
import axios from "axios";

const GRAPHQL_URL = "https://graphql.anilist.co";

/**
 * Convert slug to reasonable search title.
 */
export function slugToTitle(slug) {
  if (!slug || typeof slug !== "string") return slug;
  const trimmed = slug.split("?")[0].split("::")[0];
  const parts = trimmed.split("-").filter(Boolean);
  if (parts.length && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Query AniList GraphQL to get numeric Anime id by title.
 * Returns number or null.
 */
export async function getAniListIdByTitle(searchTitle) {
  if (!searchTitle) return null;
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
        title { romaji english native }
      }
    }
  `;
  try {
    const res = await axios.post(
      GRAPHQL_URL,
      { query, variables: { search: searchTitle } },
      { headers: { "Content-Type": "application/json" }, timeout: 8000 }
    );
    return res?.data?.data?.Media?.id ?? null;
  } catch (err) {
    console.warn("AniList lookup failed:", err?.message || err);
    return null;
  }
}
