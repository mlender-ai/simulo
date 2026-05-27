"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { WebChatMessage, type ChatMsg } from "./WebChatMessage";
import { WebChatInput } from "./WebChatInput";
import { type MiniReportData } from "./WebMiniReport";
import { getGreeting } from "@/lib/greeting";

// ── Loading messages per intent ─────────────────────────────────────────────

const LOADING_MESSAGES: Record<string, string[]> = {
  "full-scan": [
    "화면을 살펴보고 있어요...",
    "4축 관점으로 집중 분석 중...",
    "개선 포인트를 정리하고 있어요...",
  ],
  "analyze-axis": [
    "해당 축을 집중적으로 보는 중...",
    "경쟁사 기준으로 비교하는 중...",
    "발견 사항을 정리하고 있어요...",
  ],
  "copy-rewrite": [
    "현재 카피를 분석하고 있어요...",
    "여러 톤으로 변형을 만드는 중...",
    "가장 효과적인 카피를 고르고 있어요...",
  ],
  "ab-variant": [
    "현재 화면의 이슈를 파악하고...",
    "가설 기반으로 변형을 설계하는 중...",
    "예상 효과를 추정하고 있어요...",
  ],
  "competitor-compare": [
    "야핏무브 화면을 먼저 분석하고...",
    "경쟁사 화면과 나란히 비교하는 중...",
    "격차를 정리하고 있어요...",
  ],
  "suggestion": [
    "이슈를 우선순위대로 정리하는 중...",
    "Quick Win 위주로 제안을 준비하고 있어요...",
  ],
  "state-audit": [
    "화면 상태들을 점검하고 있어요...",
    "에러·빈·로딩 상태 누락 여부 확인 중...",
    "커버리지 결과를 정리하고 있어요...",
  ],
};

function getLoadingMessage(intent: string, elapsed: number): string {
  const msgs = LOADING_MESSAGES[intent] ?? ["분석하고 있어요..."];
  const idx = Math.min(Math.floor(elapsed / 3500), msgs.length - 1);
  return msgs[idx];
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface FrameInfo {
  nodeId: string;
  nodeName: string;
  imageBase64: string;
}

interface Label {
  id: string;
  name: string;
}

// ── Intent Router (keyword matching) ───────────────────────────────────────────

const KEYWORD_INTENT_MAP = [
  { keywords: ["전체", "전반", "봐줘", "검토", "분석해", "뭐가 문제", "어때", "어떤지", "살펴", "전반적"], intent: "full-scan" },
  { keywords: ["광고", "배너", "리워드 광고"], intent: "analyze-axis", axis: "ad-buffer" },
  { keywords: ["적립", "포인트", "체감", "쌓이", "마일리지 체감"], intent: "analyze-axis", axis: "earning-motivation" },
  { keywords: ["재방문", "리텐션", "스트릭", "푸시", "재접속", "다시 와"], intent: "analyze-axis", axis: "retention-trigger" },
  { keywords: ["교환", "출금", "기프티콘", "환전", "마일리지샵"], intent: "analyze-axis", axis: "exchange-trust" },
  { keywords: ["카피", "문구", "워딩", "다듬", "텍스트 고쳐", "바꿔줘", "라이팅", "문장 고쳐"], intent: "copy-rewrite" },
  { keywords: ["A/B", "a/b", "ab", "변형", "테스트", "실험안"], intent: "ab-variant" },
  { keywords: ["비교", "경쟁사", "머니워크", "돈이돼지", "타사", "competitor"], intent: "competitor-compare" },
  { keywords: ["개선안", "개선해줘", "어떻게 고치", "솔루션", "제안해줘"], intent: "suggestion" },
  { keywords: ["상태 누락", "빈 화면", "empty state", "에러 상태", "로딩 상태", "상태 커버리지", "빠진 상태", "상태 감사", "상태 점검"], intent: "state-audit" },
];

const INTENT_LABELS: Record<string, string> = {
  "full-scan": "전체 스캔",
  "analyze-axis": "축 분석",
  "copy-rewrite": "카피 다듬기",
  "ab-variant": "A/B 변형",
  "competitor-compare": "경쟁사 비교",
  "suggestion": "개선안",
  "usability": "사용성 검증",
  "visual": "시각 분석",
  "cta": "CTA 분석",
  "state-audit": "상태 점검",
};

// ── Persona detection ─────────────────────────────────────────────────────────

const PERSONA_KEYWORDS: Array<{ keywords: string[]; persona: string }> = [
  { keywords: ["시니어", "노인", "어르신", "60대", "고령", "어르신 관점"], persona: "시니어(60대 이상). 기술 친숙도 낮음, 작은 글씨 읽기 어려움, 복잡한 단계 혼란 유발." },
  { keywords: ["초보", "비친숙", "처음 쓰는", "입문자", "뉴비"], persona: "기술 비친숙 사용자. 스마트폰 기본 조작만 가능, 전문 용어 이해 불가, 실수 시 당황." },
  { keywords: ["글로벌", "외국인", "비원어민", "영어 사용자"], persona: "글로벌 비원어민 사용자. 한국어 읽기 불가, 아이콘/시각 단서에 의존, 문화적 맥락 차이." },
  { keywords: ["시각장애", "저시력", "접근성"], persona: "저시력/시각장애 사용자. 스크린 리더 사용, 고대비 필요, 색상만으로 정보 전달 불가." },
];

function detectPersona(text: string): string | null {
  const lower = text.toLowerCase();
  for (const entry of PERSONA_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.persona;
    }
  }
  return null;
}

function detectIntent(text: string): { intent: string; axis?: string; persona?: string } | null {
  const lower = text.toLowerCase();
  const persona = detectPersona(text) ?? undefined;

  for (const entry of KEYWORD_INTENT_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { intent: entry.intent, axis: entry.axis, persona };
    }
  }

  // Persona detected but no specific intent → default to full-scan with persona
  if (persona) {
    return { intent: "full-scan", persona };
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

let msgCounter = 0;
function chatId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getInitialLabels(): Label[] {
  return [
    { id: "full-scan", name: "전체 스캔" },
    { id: "usability", name: "사용성 검증" },
    { id: "state-audit", name: "상태 점검" },
    { id: "copy-rewrite", name: "카피 다듬기" },
    { id: "ab-variant", name: "A/B 변형" },
    { id: "competitor-compare", name: "경쟁사 비교" },
  ];
}

function getPostResultLabels(): Label[] {
  return [
    { id: "suggestion", name: "개선안 보기" },
    { id: "copy-rewrite", name: "카피도 봐줘" },
    { id: "competitor-compare", name: "경쟁사 비교" },
    { id: "ab-variant", name: "A/B 변형" },
  ];
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function WebChatContainer() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [frames, setFrames] = useState<FrameInfo[]>([]);
  const [intent, setIntent] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [dragOverArea, setDragOverArea] = useState(false);
  const [recentSessions, setRecentSessions] = useState<
    Array<{ frameName: string; intent: string | null }>
  >([]);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // ── Smart scroll ───────────────────────────────────────────────────────────

  const isAtBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      setUserScrolledUp(false);
      setHasNewBelow(false);
    });
  }, []);

  const handleScroll = useCallback(() => {
    const atBottom = isAtBottom();
    setUserScrolledUp(!atBottom);
    if (atBottom) setHasNewBelow(false);
  }, [isAtBottom]);

  const addMsg = useCallback(
    (msg: ChatMsg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        if (isAtBottom()) {
          scrollToBottom();
        } else {
          setHasNewBelow(true);
        }
      }, 50);
    },
    [scrollToBottom, isAtBottom]
  );

  const updateMsg = useCallback(
    (id: string, patch: Partial<ChatMsg>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
      setTimeout(() => {
        if (isAtBottom()) scrollToBottom();
      }, 50);
    },
    [scrollToBottom, isAtBottom]
  );

  // ── Image upload handler ──────────────────────────────────────────────────────

  const handleImagesUploaded = useCallback(
    (files: File[]) => {
      if (analyzing) return;

      const readFiles = files.map(
        (f, i) =>
          new Promise<FrameInfo>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).replace(
                /^data:image\/[^;]+;base64,/,
                ""
              );
              resolve({
                nodeId: `upload-${Date.now()}-${i}`,
                nodeName: f.name.replace(/\.[^.]+$/, ""),
                imageBase64: base64,
              });
            };
            reader.readAsDataURL(f);
          })
      );

      Promise.all(readFiles).then((newFrames) => {
        setFrames(newFrames);
        setIntent(null);
        setConversationHistory([]);

        const names = newFrames.map((f) => f.nodeName).join(", ");
        addMsg({
          id: chatId(),
          role: "system",
          content: `${newFrames.length}개 이미지 업로드됨: ${names}`,
        });
        addMsg({
          id: chatId(),
          role: "bot",
          content: "이 화면에서 뭘 해볼까요?",
          labels: getInitialLabels(),
        });
      });
    },
    [analyzing, addMsg]
  );

  // ── Analysis execution ────────────────────────────────────────────────────────

  const startAnalysis = useCallback(
    async (intentId: string, subContext: string, axis?: string, persona?: string) => {
      if (!frames.length || analyzing) return;
      setAnalyzing(true);
      setIntent(intentId);

      // Typing indicator (no content yet)
      const msgId = chatId();
      addMsg({ id: msgId, role: "bot", content: "", streaming: true });

      // Artificial delay: 400~700ms for "thinking" feel
      await delay(400 + Math.random() * 300);

      const ac = new AbortController();
      abortRef.current = ac;
      const timeout = setTimeout(() => ac.abort(), 60_000);

      const apiKey = localStorage.getItem("simulo_anthropic_key") || undefined;
      const resolvedSubCtx = axis
        ? `axis:${axis}${subContext ? ` ${subContext}` : ""}`
        : subContext;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            frames: frames.map((f) => ({
              nodeId: f.nodeId,
              nodeName: f.nodeName,
              imageBase64: f.imageBase64,
            })),
            intent: intentId,
            subContext: resolvedSubCtx,
            persona: persona || undefined,
            conversationHistory:
              conversationHistory.length > 10
                ? [
                    ...conversationHistory.slice(0, 2),
                    {
                      role: "user",
                      content: `[이전 대화 요약: ${Math.floor((conversationHistory.length - 10) / 2)}번의 분석 생략됨]`,
                    },
                    ...conversationHistory.slice(-8),
                  ]
                : conversationHistory,
            userMessage: subContext || "",
            apiKey,
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          const errMsg =
            res.status === 401
              ? "API 키가 유효하지 않아요. 설정에서 확인해주세요."
              : res.status === 429
                ? "요청이 너무 많아요. 잠시 후 다시 시도해주세요."
                : err?.error ?? "분석 중 오류가 발생했습니다.";
          updateMsg(msgId, {
            content: errMsg,
            streaming: false,
            actions: [{ id: "retry", label: "다시 시도" }],
          });
          setAnalyzing(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        const streamStart = Date.now();

        // Loading message rotation interval
        const loadingInterval = setInterval(() => {
          if (!accumulated) {
            const elapsed = Date.now() - streamStart;
            updateMsg(msgId, {
              content: getLoadingMessage(intentId, elapsed),
              streaming: true,
            });
          }
        }, 3500);

        // Show first loading message immediately
        updateMsg(msgId, {
          content: getLoadingMessage(intentId, 0),
          streaming: true,
        });

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data) as {
                text?: string;
                error?: string;
              };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulated += parsed.text;
              }
            } catch {
              /* partial JSON */
            }
          }
        }

        clearInterval(loadingInterval);

        let miniReport: MiniReportData | null = null;
        try {
          const m = accumulated.match(/\{[\s\S]*\}/);
          if (m) miniReport = JSON.parse(m[0]) as MiniReportData;
        } catch {
          /* parse error */
        }

        updateMsg(msgId, {
          content: miniReport?.quickSummary ?? accumulated.slice(0, 80),
          streaming: false,
          miniReport: miniReport ?? undefined,
          actions: [
            { id: "copy", label: "결과 복사", primary: true },
            { id: "rescan", label: "다시 분석" },
          ],
          labels: getPostResultLabels(),
        });

        setConversationHistory((prev) => [
          ...prev,
          {
            role: "user",
            content: `${frames[0]?.nodeName ?? "화면"} — ${intentId} 분석`,
          },
          { role: "assistant", content: accumulated },
        ]);

        // Fire-and-forget: save session
        if (miniReport && frames[0]) {
          fetch("/api/chat/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frameId: frames[0].nodeId,
              frameName: frames[0].nodeName,
              intent: intentId,
              quickSummary: miniReport.quickSummary,
              findings: miniReport.findings,
            }),
          }).catch(() => {});
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          updateMsg(msgId, {
            content: "응답이 너무 오래 걸려요.",
            streaming: false,
            actions: [{ id: "retry", label: "다시 시도" }],
          });
          return;
        }
        updateMsg(msgId, {
          content: "오류: " + String(err),
          streaming: false,
          actions: [{ id: "retry", label: "다시 시도" }],
        });
      } finally {
        clearTimeout(timeout);
        setAnalyzing(false);
      }
    },
    [frames, analyzing, conversationHistory, addMsg, updateMsg]
  );

  // ── Label click ───────────────────────────────────────────────────────────────

  const handleLabelClick = useCallback(
    (labelId: string) => {
      if (analyzing || !frames.length) return;
      const name = INTENT_LABELS[labelId] ?? labelId;
      addMsg({ id: chatId(), role: "user", content: name });

      const entry = KEYWORD_INTENT_MAP.find((e) => e.intent === labelId);
      startAnalysis(labelId, "", entry?.axis);
    },
    [analyzing, frames, addMsg, startAnalysis]
  );

  // ── Action click ──────────────────────────────────────────────────────────────

  const handleAction = useCallback(
    (actionId: string) => {
      if (actionId === "retry") {
        if (!frames.length || !intent) return;
        setMessages((prev) =>
          prev.filter(
            (m) => !(m.actions?.some((a) => a.id === "retry"))
          )
        );
        startAnalysis(intent, "");
        return;
      }
      if (actionId === "copy") {
        const lastReport = [...messages]
          .reverse()
          .find((m) => m.miniReport);
        if (!lastReport?.miniReport) return;
        const r = lastReport.miniReport;
        const sevEmoji = ["OK", "INFO", "WARN", "ERR", "CRIT"];
        const text = r.findings
          .map(
            (f) =>
              `[${sevEmoji[Math.min(4, f.severity)]}] ${f.criterion}: ${f.oneLineFinding}\n  -> ${f.fix}`
          )
          .join("\n\n");
        navigator.clipboard
          .writeText(`Simulo - ${r.quickSummary}\n\n${text}`)
          .catch(() => {});
      }
      if (actionId === "rescan") {
        setIntent(null);
        setConversationHistory([]);
        addMsg({
          id: chatId(),
          role: "bot",
          content: "이 화면에서 뭘 해볼까요?",
          labels: getInitialLabels(),
        });
      }
    },
    [frames, intent, messages, addMsg, startAnalysis]
  );

  // ── Text input ────────────────────────────────────────────────────────────────

  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || analyzing) return;
      if (!frames.length) {
        addMsg({ id: chatId(), role: "user", content: text });
        addMsg({
          id: chatId(),
          role: "bot",
          content:
            "분석할 화면이 필요해요. 이미지를 드래그하거나 업로드해주세요.",
        });
        return;
      }

      addMsg({ id: chatId(), role: "user", content: text });

      const detected = detectIntent(text);
      if (detected) {
        startAnalysis(detected.intent, text, detected.axis, detected.persona);
      } else {
        startAnalysis("full-scan", text);
      }
    },
    [analyzing, frames, addMsg, startAnalysis]
  );

  // ── Fetch recent sessions for dynamic suggestions ─────────────────────────

  useEffect(() => {
    fetch("/api/chat/sessions")
      .then((r) => r.json())
      .then((data: Array<{ frameName: string; intent: string | null }>) => {
        if (Array.isArray(data)) setRecentSessions(data.slice(0, 5));
      })
      .catch(() => {});
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Dynamic suggestions ──────────────────────────────────────────────────────

  const dynamicSuggestions = (() => {
    const suggestions: string[] = [];
    const lastFrame = recentSessions[0]?.frameName;
    if (lastFrame) suggestions.push(`${lastFrame} 이어서 보기`);
    const hasCompetitor = recentSessions.some((s) => s.intent === "competitor-compare");
    if (!hasCompetitor) suggestions.push("경쟁사 최근 업데이트 확인해볼까요?");
    suggestions.push("홈 화면 전체 스캔해줘", "A/B 테스트 가설 잡아줘");
    return suggestions.slice(0, 4);
  })();

  // ── Render ────────────────────────────────────────────────────────────────────

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={(e) => { e.preventDefault(); setDragOverArea(true); }}
      onDragLeave={(e) => {
        // Only if leaving the container itself
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOverArea(false);
        }
      }}
      onDrop={(e) => { e.preventDefault(); setDragOverArea(false); }}
    >
      {/* Drag overlay */}
      {dragOverArea && (
        <div className="chat-dropzone-overlay">
          <div className="chat-dropzone-label">여기에 놓으면 분석할게요</div>
        </div>
      )}

      {/* Message area */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto relative"
        onScroll={handleScroll}
      >
        {!hasMessages ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="text-4xl opacity-20 mb-4">S</div>
            <h2 className="text-lg font-semibold text-white/80 mb-2">
              {getGreeting()}
            </h2>
            <p className="text-sm text-white/40 mb-8 max-w-sm">
              분석할 화면을 드래그하거나 업로드하세요.
              <br />
              또는 바로 질문을 입력해도 돼요.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {dynamicSuggestions.map((prompt, i) => (
                <button
                  key={prompt}
                  onClick={() => handleTextSubmit(prompt)}
                  className="chat-label-enter px-3 py-1.5 text-xs text-white/50 border border-white/10 rounded-full hover:text-white/80 hover:border-white/25 hover:-translate-y-px active:scale-[0.97] transition-all duration-150"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <WebChatMessage
                key={msg.id}
                msg={msg}
                onLabelClick={handleLabelClick}
                onActionClick={handleAction}
              />
            ))}
            <div ref={endRef} />
          </div>
        )}

        {/* Scroll-to-bottom button */}
        {userScrolledUp && hasNewBelow && (
          <div className="flex justify-center pointer-events-none sticky bottom-2">
            <button
              onClick={scrollToBottom}
              className="scroll-to-bottom-btn pointer-events-auto"
            >
              ↓ 새 메시지
            </button>
          </div>
        )}
      </div>

      {/* Input bar */}
      <WebChatInput
        onSubmit={handleTextSubmit}
        onImagesUploaded={handleImagesUploaded}
        disabled={analyzing}
        onReset={() => {
          abortRef.current?.abort();
          setMessages([]);
          setFrames([]);
          setIntent(null);
          setConversationHistory([]);
          setAnalyzing(false);
        }}
        hasMessages={hasMessages}
      />
    </div>
  );
}
