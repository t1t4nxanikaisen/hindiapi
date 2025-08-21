// src/utils/anilist.js
import axios from "axios";

const GRAPHQL_URL = "https://graphql.anilist.co";

/**
 * Convert slug to search title for AniList.
 */
export function slugToTitle(slug) {
  if (!slug || typeof slug !== "string") return slug;
  const trimmed = slug.split("?")[0].split("::")[0];
  const parts = trimmed.split("-").filter(Boolean);
  // drop trailing pure-numeric token used by your slugs
  if (parts.length && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  // drop trailing 'season N' tokens
  if (parts.length >= 2 && /^season$/i.test(parts[parts.length - 2])) parts.splice(parts.length - 2, 2);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Query AniList GraphQL to get anime id for a title.
 */
export async function getAniListIdByTitle(searchTitle) {
  if (!searchTitle) return null;
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
      }
    }
  `;
  try {
    const res = await axios.post(
      GRAPHQL_URL,
      { query, variables: { search: searchTitle } },
      { headers: { "Content-Type": "application/json" }, timeout: 7000 }
    );
    return res?.data?.data?.Media?.id ?? null;
  } catch (err) {
    console.warn("AniList lookup failed:", err?.message || err);
    return null;
  }
}
export default { slugToTitle, getAniListIdByTitle };
