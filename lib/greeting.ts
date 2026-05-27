// lib/greeting.ts — 시간대별 인사 + 재방문 맥락

export function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 6) return "밤늦게까지 수고 많아요.";
  if (hour < 12) return "좋은 아침이에요.";
  if (hour < 14) return "점심은 드셨어요?";
  if (hour < 18) return "좋은 오후예요.";
  if (hour < 22) return "오늘 하루도 거의 끝났네요.";
  return "밤늦게까지 수고 많아요.";
}

export function getReturningGreeting(
  lastFrameName: string | null
): string {
  const base = getGreeting();
  if (lastFrameName) {
    return `${base} 지난번에 "${lastFrameName}" 보셨죠? 이어서 할까요, 새로 볼까요?`;
  }
  return `${base} 분석할 화면을 올려주세요.`;
}
