import axios from "axios";

const GRAPHQL_URL = "https://graphql.anilist.co";

export async function getAniListIdByTitle(searchTitle) {
  if (!searchTitle) return null;
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
      }
    }`;
  try {
    const res = await axios.post(
      GRAPHQL_URL,
      { query, variables: { search: searchTitle } },
      { headers: { "Content-Type": "application/json" } }
    );
    return res.data.data.Media?.id ?? null;
  } catch (e) {
    console.warn("AniList lookup failed:", e.message);
    return null;
  }
}

export function slugToTitle(slug) {
  if (!slug) return slug;
  const trimmed = slug.split("?")[0];
  const parts = trimmed.split("-").filter(Boolean);
  if (/^\d+$/.test(parts[parts.length - 1])) parts.pop();
  if (/^season$/i.test(parts[parts.length - 2] || "")) parts.splice(-2);
  return parts.join(" ").trim();
}
