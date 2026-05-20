export interface StoreData {
  appId: string;
  platform: "ios" | "android";
  rating: number;
  ratingCount: number;
  recentReviews: Review[];
  recentUpdates: UpdateNote[];
  fetchedAt: Date;
}

export interface Review {
  id: string;
  rating: number;
  text: string;
  date: Date;
  language: string;
}

export interface UpdateNote {
  version: string;
  date: Date;
  notes: string;
}

/**
 * Parse CSV-formatted review data (MVP approach — manual upload)
 * Expected CSV format: id,rating,text,date,language
 */
export function parseReviewCSV(csvText: string): Review[] {
  const lines = csvText.trim().split("\n");
  const header = lines[0].split(",");
  const idxMap = {
    id: header.indexOf("id"),
    rating: header.indexOf("rating"),
    text: header.indexOf("text"),
    date: header.indexOf("date"),
    language: header.indexOf("language"),
  };

  return lines.slice(1).map((line, i) => {
    const cols = line.split(",");
    return {
      id: idxMap.id >= 0 ? cols[idxMap.id] : String(i),
      rating: idxMap.rating >= 0 ? Number(cols[idxMap.rating]) : 3,
      text: idxMap.text >= 0 ? cols[idxMap.text] : line,
      date: idxMap.date >= 0 ? new Date(cols[idxMap.date]) : new Date(),
      language: idxMap.language >= 0 ? cols[idxMap.language] : "ko",
    };
  });
}
