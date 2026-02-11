import { useState, useEffect, useCallback } from "react";
import type { Candidate } from "../types";

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// Map local image assets in `src/images/candidates/...` to their Vite-resolved URLs
// This allows using images placed in `src/` (like `src/images/candidates/male/C1.png`)
const localImageMap: Record<string, string | { default: string }> = import.meta.glob(
  "../images/candidates/**/*.{png,jpg,jpeg}",
  { query: "?url", import: "default", eager: true } as any,
);
// Fetch all available sheet names (categories) from the spreadsheet
export async function fetchSheetNames(): Promise<string[]> {
  if (!SHEET_ID || !API_KEY) {
    console.error(
      "Missing Configuration: VITE_GOOGLE_SHEET_ID or VITE_GOOGLE_API_KEY",
    );
    return [];
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}&fields=sheets.properties.title`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      return [];
    }
    const data = await response.json();
    const sheetNames =
      data.sheets?.map(
        (sheet: { properties: { title: string } }) => sheet.properties.title,
      ) || [];
    return sheetNames;
  } catch (err) {
    console.error(
      `Error fetching sheet names: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

export function useScores(selectedCategory: string = "") {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch available categories (sheet names) on mount
  useEffect(() => {
    fetchSheetNames().then((names) => {
      setCategories(names);
    });
  }, []);

  const fetchScores = useCallback(
    async (sheetName?: string) => {
      const targetSheet = sheetName || selectedCategory;

      // Skip fetch if no category is selected yet
      if (!targetSheet) {
        setLoading(false);
        return [];
      }

      if (!SHEET_ID || !API_KEY) {
        const msg =
          "Missing Configuration: VITE_GOOGLE_SHEET_ID or VITE_GOOGLE_API_KEY in .env file.";
        setError(msg);
        setLoading(false);
        return [];
      }

      // Encode sheet name for URL - handle spaces and special characters
      // Sheet names with spaces need to be wrapped in single quotes
      const encodedSheetName =
        targetSheet.includes(" ") || targetSheet.includes("'")
          ? `'${targetSheet.replace(/'/g, "''")}'`
          : targetSheet;
      const range = encodeURIComponent(`${encodedSheetName}!A1:Z100`);

      try {
        // Fetch a larger range to accommodate dynamic sections
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

        const response = await fetch(url);
        if (!response.ok) {
          setError(`API Error: ${response.status} ${response.statusText}`);
          setLoading(false);
          return [];
        }

        const data = await response.json();
        const rows = data.values;

        if (!rows || rows.length === 0) {
          if (candidates.length === 0) {
            setError("No data found in Sheet.");
          }
          setLoading(false);
          return [];
        }

        setError(null);

        // --- DYNAMIC PARSING LOGIC ---
        const parsedCandidates: Candidate[] = [];
        let currentCategory = "General";

        // Temporary storage for the current block being parsed
        let currentBlockCandidates: {
          index: number;
          name: string;
          scores: number[];
        }[] = [];

        // Helper to check if a public URL exists (HEAD request)
        const urlExists = async (url: string) => {
          try {
            const res = await fetch(url, { method: "HEAD" });
            return res.ok;
          } catch (e) {
            return false;
          }
        };

        // Helper function to get local image path for a candidate (async)
        const getCandidateImageUrl = async (
          candidateName: string,
          candidateCategory?: string,
        ): Promise<string> => {
          const cat = (candidateCategory || "").toLowerCase();
          const isMale = /\bmale\b/.test(cat);
          const isFemale = /\bfemale\b/.test(cat);
          // Extract candidate number from name (e.g., "CANDIDATE 1" -> "1")
          const match = candidateName.match(/(\d+)/);
          if (match) {
            const candidateNumber = match[1];

            // 1) Prefer images bundled in `src/images` (resolved by Vite via import.meta.glob)
            // Some Vite setups return keys with different prefixes, so scan the
            // available `localImageMap` keys and match by filename ending.
            const localKeys = Object.keys(localImageMap);
            let variants: string[] = [];
            if (isMale) {
              // Male section: only consider male images from src (no mix fallback)
              variants = [`/male/C${candidateNumber}.png`, `/male/C${candidateNumber}.jpg`];
            } else if (isFemale) {
              // Female sections can use female or mix
              variants = [
                `/female/C${candidateNumber}.png`,
                `/female/C${candidateNumber}.jpg`,
                `/mix/C${candidateNumber}.png`,
                `/mix/C${candidateNumber}.jpg`,
              ];
            } else {
              variants = [
                `/mix/C${candidateNumber}.png`,
                `/mix/C${candidateNumber}.jpg`,
                `/male/C${candidateNumber}.png`,
                `/male/C${candidateNumber}.jpg`,
                `/female/C${candidateNumber}.png`,
                `/female/C${candidateNumber}.jpg`,
              ];
            }

            // Check preferred variants in order, then look for a matching local key
            for (const v of variants) {
              const foundKey = localKeys.find((k) => k.endsWith(v));
              if (foundKey) return (localImageMap as any)[foundKey];
            }

            // 2) Fall back to public folder paths, but obey the same gender-folder restrictions.
            const publicOrder: string[] = [];
            if (isMale) {
              publicOrder.push(
                `/images/candidates/male/C${candidateNumber}.png`,
                `/images/candidates/male/C${candidateNumber}.jpg`,
              );
            } else if (isFemale) {
              publicOrder.push(
                `/images/candidates/female/C${candidateNumber}.png`,
                `/images/candidates/female/C${candidateNumber}.jpg`,
              );
            } else {
              publicOrder.push(
                `/images/candidates/mix/C${candidateNumber}.jpg`,
                `/images/candidates/mix/C${candidateNumber}.png`,
              );
            }

            // Check public paths in order and return the first that exists
            for (const p of publicOrder) {
              if (await urlExists(p)) return p;
            }
            // If male section and nothing found, return avatar (user will add male images later)
            if (isMale) {
              return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=random&color=fff`;
            }
            // Otherwise return first public path as a fallback (previous behavior)
            return publicOrder[0];
          }
          // Fallback to UI avatars if no number found
          return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=random&color=fff`;
        };

        // Helper to finalize current block (async so we can await image resolution)
        const finalizeBlock = async () => {
          if (currentBlockCandidates.length > 0) {
            for (const c of currentBlockCandidates) {
              const total = c.scores.reduce((sum, s) => sum + s, 0);
              const avg = c.scores.length > 0 ? total / c.scores.length : 0;
              const photoUrl = await getCandidateImageUrl(
                c.name,
                currentCategory,
              );
              parsedCandidates.push({
                name: c.name,
                category: currentCategory,
                photoUrl,
                scores: c.scores,
                totalPercentage: avg,
              });
            }
            currentBlockCandidates = [];
          }
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const firstCell = (row[0] || "").toString().trim().toUpperCase();

          // 1. Detect Header Row (Contains "CANDIDATE")
          const isHeaderRow = row.some((cell: string) =>
            (cell || "").toString().toUpperCase().includes("CANDIDATE"),
          );

          if (isHeaderRow) {
            // If we were parsing a previous block, finalize it
            await finalizeBlock();

            // Attempt to find Category from previous row(s)
            let foundCategory = false;
            for (let j = i - 1; j >= 0; j--) {
              const prevRowText = (rows[j][0] || "").toString().trim();
              if (prevRowText) {
                if (!prevRowText.toUpperCase().startsWith("JUDGE")) {
                  currentCategory = prevRowText;
                  foundCategory = true;
                }
                break;
              }
            }
            if (!foundCategory) currentCategory = "General";

            // Initialize candidates for this block
            row.forEach((cell: string, colIndex: number) => {
              if ((cell || "").toString().toUpperCase().includes("CANDIDATE")) {
                currentBlockCandidates.push({
                  index: colIndex,
                  name: cell.trim(), // e.g. "CANDIDATE 1"
                  scores: [],
                });
              }
            });
            continue;
          }

          // 2. Detect Judge Row
          if (currentBlockCandidates.length > 0) {
            if (
              firstCell &&
              !firstCell.startsWith("JUDGE") &&
              isNaN(parseFloat(firstCell))
            ) {
              // Likely next section header, ignored here
            }

            if (firstCell.startsWith("JUDGE")) {
              currentBlockCandidates.forEach((cand) => {
                const cellValue = row[cand.index];
                if (cellValue !== undefined && cellValue !== "") {
                  const val = parseFloat(cellValue);
                  if (!isNaN(val)) {
                    cand.scores.push(val);
                  }
                }
              });
            }
          }
        }

        // Finalize the last block
        await finalizeBlock();

        // Expose parsed candidates to window for quick debugging in browser console
        try {
          (window as any).__candidates = parsedCandidates;
          console.info(
            "useScores: exported parsed candidates to window.__candidates",
            parsedCandidates.length,
          );
        } catch (err) {
          // ignore in non-browser environments
        }

        // Only update if data changed to avoid re-renders (deep comp could be expensive, just check length or basic)
        // For now just set it.
        setCandidates(parsedCandidates);
        setLoading(false);
        return parsedCandidates;
      } catch (err) {
        setError(
          `Network/Fetch Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        setLoading(false);
        return [];
      }
    },
    [candidates.length, selectedCategory],
  );

  useEffect(() => {
    fetchScores();
  }, [selectedCategory]); // Re-fetch when category changes

  const refresh = async (sheetName?: string) => {
    setLoading(true);
    const newCandidates = await fetchScores(sheetName);
    return newCandidates;
  };

  return { candidates, loading, error, refresh, categories };
}
