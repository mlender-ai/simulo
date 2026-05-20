export interface FigmaCommentParams {
  fileKey: string;
  nodeId: string;
  message: string;
  accessToken: string;
}

export async function postFigmaComment(params: FigmaCommentParams): Promise<unknown> {
  const response = await fetch(
    `https://api.figma.com/v1/files/${params.fileKey}/comments`,
    {
      method: "POST",
      headers: {
        "X-Figma-Token": params.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: params.message,
        comment_pin: {
          node_id: params.nodeId,
          node_offset: { x: 0, y: 0 },
        },
      }),
    }
  );
  return response.json();
}

export function formatFindingAsComment(
  finding: {
    severity: number;
    finding: string;
    location: string;
    suggestion: string;
    criterionId?: string;
  },
  frameworkName: string
): string {
  const severityEmoji = ["✅", "💡", "⚠️", "🔴", "🚨"][finding.severity] ?? "⚠️";
  return `${severityEmoji} [Simulo/${frameworkName}]
발견: ${finding.finding}
위치: ${finding.location}
개선 제안: ${finding.suggestion}
심각도: ${finding.severity}/4`;
}
