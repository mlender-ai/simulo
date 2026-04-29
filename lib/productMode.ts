/**
 * Product mode toggle — switches between YafitMove-specific and general UX analysis.
 *
 * "yafit"   — Default. Includes 4060 targeting, desire map, YafitMove domain knowledge.
 * "general" — Generic UX analysis. No domain-specific modeling.
 */
export type ProductMode = "yafit" | "general";

const STORAGE_KEY = "simulo:productMode";

export function getProductMode(): ProductMode {
  if (typeof window === "undefined") return "yafit";
  return (localStorage.getItem(STORAGE_KEY) as ProductMode) || "yafit";
}

export function setProductMode(mode: ProductMode) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, mode);
  }
}
