/**
 * UX Writing Check 결과 localStorage 저장/조회
 */

export interface WritingIssue {
  location: string;
  original: string;
  suggestion: string;
  reason: string;
  severity: "critical" | "warning" | "info";
  principle: string;
}

export interface ScreenLevel {
  hasOneKeyMessage: boolean;
  hasWordRepetition: boolean;
  repeatedWords: string[];
  ctaCount: number;
  ctaClarity: string;
}

export interface WritingCheckFrame {
  frameName: string;
  summary: string;
  score: number;
  issues: WritingIssue[];
  strengths: string[];
  screenLevel?: ScreenLevel;
  figmaNodeId?: string;
}

export interface WritingCheckSession {
  id: string;
  createdAt: string;
  frames: WritingCheckFrame[];
  figmaFileKey?: string;
}

const STORAGE_KEY = "simulo_writing_checks";

function generateId(): string {
  return `wc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const writingStorage = {
  getAll(): WritingCheckSession[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  save(frames: WritingCheckFrame[], figmaFileKey?: string): WritingCheckSession {
    const sessions = writingStorage.getAll();
    const session: WritingCheckSession = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      frames,
      ...(figmaFileKey ? { figmaFileKey } : {}),
    };
    sessions.unshift(session);
    // 최대 50개 세션 유지
    if (sessions.length > 50) sessions.length = 50;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return session;
  },

  deleteById(id: string): void {
    const sessions = writingStorage.getAll().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};

/**
 * 세션 데이터를 CSV 문자열로 변환
 * 구글 시트에 바로 붙여넣기 가능한 형식
 */
export function writingCheckToCSV(sessions: WritingCheckSession[]): string {
  const BOM = "\uFEFF";
  const header = ["날짜", "프레임", "위치", "심각도", "원칙", "현재 문구 (Don't)", "제안 문구 (Do)", "사유"].join(",");

  const rows: string[] = [];
  for (const session of sessions) {
    const date = new Date(session.createdAt).toLocaleDateString("ko-KR");
    for (const frame of session.frames) {
      if (frame.issues.length === 0) {
        rows.push([date, csvEscape(frame.frameName), "", "", "", "", "", "이슈 없음"].join(","));
        continue;
      }
      for (const issue of frame.issues) {
        rows.push(
          [
            date,
            csvEscape(frame.frameName),
            csvEscape(issue.location),
            issue.severity === "critical" ? "심각" : issue.severity === "warning" ? "주의" : "참고",
            csvEscape(issue.principle),
            csvEscape(issue.original),
            csvEscape(issue.suggestion),
            csvEscape(issue.reason),
          ].join(",")
        );
      }
    }
  }

  return BOM + header + "\n" + rows.join("\n");
}

function csvEscape(value: string): string {
  if (!value) return "";
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
