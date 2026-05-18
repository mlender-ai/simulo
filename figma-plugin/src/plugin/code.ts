// Simulo Figma Plugin — sandbox-side logic
// Runs in Figma's plugin sandbox. Communicates with UI via postMessage.

figma.showUI(__html__, { width: 380, height: 640, title: "Simulo" });

// Helper — Uint8Array → base64 (no Buffer available in Figma sandbox)
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // figma.base64Encode is available in the plugin API (v1+)
  if (typeof figma.base64Encode === "function") {
    return figma.base64Encode(bytes);
  }
  // Fallback: btoa exists in the sandbox
  return btoa(binary);
}

interface ExtractedText {
  text: string;
  parentName: string;
  fontSize: number | null;
  fontWeight: string | null;
}

function findAllTextNodes(node: SceneNode): TextNode[] {
  const results: TextNode[] = [];
  if (node.type === "TEXT") {
    results.push(node);
  }
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      results.push(...findAllTextNodes(child as SceneNode));
    }
  }
  return results;
}

function extractTextNodes(node: SceneNode): ExtractedText[] {
  const results: ExtractedText[] = [];

  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    if (textNode.characters.trim()) {
      let fontSize: number | null = null;
      let fontWeight: string | null = null;
      try {
        const fs = textNode.fontSize;
        if (typeof fs === "number") fontSize = fs;
        const fw = textNode.fontWeight;
        if (typeof fw === "number") fontWeight = fw >= 600 ? "bold" : "normal";
      } catch { /* mixed styles */ }
      results.push({
        text: textNode.characters.trim(),
        parentName: node.parent?.name ?? "",
        fontSize,
        fontWeight,
      });
    }
  }

  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      results.push(...extractTextNodes(child as SceneNode));
    }
  }

  return results;
}

type WritingFix = {
  original: string;
  suggestion: string;
};

type PluginMessage =
  | { type: "get-selection" }
  | { type: "get-selection-for-writing" }
  | { type: "get-selection-for-flow" }
  | { type: "get-file-info" }
  | { type: "save-api-key"; key: string }
  | { type: "load-api-key" }
  | { type: "save-simulo-url"; url: string }
  | { type: "load-simulo-url" }
  | { type: "open-external"; url: string }
  | { type: "apply-writing-fixes"; nodeId: string; fixes: WritingFix[] }
  | { type: "save-model"; model: string }
  | { type: "load-model" }
  | { type: "save-google-tokens"; tokens: string }
  | { type: "load-google-tokens" }
  | { type: "save-spreadsheet-id"; spreadsheetId: string }
  | { type: "load-spreadsheet-id" }
  | { type: "close" };

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === "get-selection") {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "분석할 프레임이나 레이어를 선택해주세요.",
      });
      return;
    }

    const nodes = selection.slice(0, 8);
    const images: { name: string; base64: string; texts: ExtractedText[] }[] = [];

    for (const node of nodes) {
      try {
        // exportAsync is available on SceneNode with export support
        if ("exportAsync" in node) {
          const bytes = await (node as ExportMixin).exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 1.5 },
          });
          const texts = extractTextNodes(node);
          images.push({
            name: node.name,
            base64: uint8ToBase64(bytes),
            texts,
          });
        }
      } catch (e) {
        console.error("이미지 추출 실패:", node.name, e);
      }
    }

    if (images.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "선택한 항목에서 이미지를 추출할 수 없습니다.",
      });
      return;
    }

    figma.ui.postMessage({
      type: "selection-ready",
      images,
      count: images.length,
    });
  }

  if (msg.type === "get-selection-for-flow") {
    const selection = figma.currentPage.selection;

    if (selection.length < 2) {
      figma.ui.postMessage({
        type: "error",
        message: "플로우 분석에는 2개 이상의 화면을 선택해주세요.",
      });
      return;
    }

    const nodes = selection.slice(0, 8);
    const flowSteps: { stepNumber: number; stepName: string; base64: string }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      try {
        if ("exportAsync" in node) {
          const bytes = await (node as ExportMixin).exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 1.5 },
          });
          flowSteps.push({
            stepNumber: i + 1,
            stepName: node.name,
            base64: uint8ToBase64(bytes),
          });
        }
      } catch (e) {
        console.error("플로우 이미지 추출 실패:", node.name, e);
      }
    }

    if (flowSteps.length < 2) {
      figma.ui.postMessage({
        type: "error",
        message: "플로우 이미지 추출에 실패했습니다.",
      });
      return;
    }

    figma.ui.postMessage({
      type: "flow-selection-ready",
      flowSteps,
      count: flowSteps.length,
    });
  }

  if (msg.type === "get-selection-for-writing") {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "분석할 프레임이나 레이어를 선택해주세요.",
      });
      return;
    }

    const nodes = selection.slice(0, 8);
    const frames: { name: string; nodeId: string; base64: string; texts: ExtractedText[] }[] = [];

    for (const node of nodes) {
      try {
        if ("exportAsync" in node) {
          const bytes = await (node as ExportMixin).exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 2 },
          });
          const texts = extractTextNodes(node);
          frames.push({
            name: node.name,
            nodeId: node.id,
            base64: uint8ToBase64(bytes),
            texts,
          });
        }
      } catch (e) {
        console.error("이미지 추출 실패:", node.name, e);
      }
    }

    if (frames.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "선택한 항목에서 이미지를 추출할 수 없습니다.",
      });
      return;
    }

    figma.ui.postMessage({
      type: "writing-selection-ready",
      frames,
      count: frames.length,
      fileKey: figma.fileKey,
    });
  }

  if (msg.type === "get-file-info") {
    figma.ui.postMessage({
      type: "file-info",
      fileName: figma.root.name,
      currentPage: figma.currentPage.name,
      selectionCount: figma.currentPage.selection.length,
      names: figma.currentPage.selection.map((n) => n.name),
    });
  }

  if (msg.type === "save-api-key") {
    await figma.clientStorage.setAsync("simulo_api_key", msg.key);
  }

  if (msg.type === "load-api-key") {
    const key = await figma.clientStorage.getAsync("simulo_api_key");
    figma.ui.postMessage({ type: "api-key-loaded", key: key || "" });
  }

  if (msg.type === "save-simulo-url") {
    await figma.clientStorage.setAsync("simulo_url", msg.url);
  }

  if (msg.type === "load-simulo-url") {
    const url = await figma.clientStorage.getAsync("simulo_url");
    figma.ui.postMessage({ type: "simulo-url-loaded", url: url || "" });
  }

  if (msg.type === "save-model") {
    await figma.clientStorage.setAsync("simulo_model", msg.model);
  }

  if (msg.type === "load-model") {
    const model = await figma.clientStorage.getAsync("simulo_model");
    figma.ui.postMessage({ type: "model-loaded", model: model || "haiku" });
  }

  if (msg.type === "save-google-tokens") {
    await figma.clientStorage.setAsync("simulo_google_tokens", msg.tokens);
  }

  if (msg.type === "load-google-tokens") {
    const tokens = await figma.clientStorage.getAsync("simulo_google_tokens");
    figma.ui.postMessage({ type: "google-tokens-loaded", tokens: tokens || "" });
  }

  if (msg.type === "save-spreadsheet-id") {
    await figma.clientStorage.setAsync("simulo_spreadsheet_id", msg.spreadsheetId);
  }

  if (msg.type === "load-spreadsheet-id") {
    const id = await figma.clientStorage.getAsync("simulo_spreadsheet_id");
    figma.ui.postMessage({ type: "spreadsheet-id-loaded", spreadsheetId: id || "" });
  }

  if (msg.type === "open-external") {
    figma.openExternal(msg.url);
  }

  if (msg.type === "apply-writing-fixes") {
    try {
      const original = figma.getNodeById(msg.nodeId) as SceneNode | null;
      if (!original || !("clone" in original)) {
        figma.ui.postMessage({ type: "fix-result", success: false, error: "프레임을 찾을 수 없습니다." });
        return;
      }

      // 프레임 복제
      const clone = (original as FrameNode).clone();

      // 복제본 이름 설정
      clone.name = `${original.name} — Fixed`;

      // 복제본을 원본 오른쪽에 배치 (간격 100px)
      if ("x" in original && "width" in original && "x" in clone) {
        (clone as SceneNode & { x: number }).x = (original as SceneNode & { x: number; width: number }).x + (original as SceneNode & { width: number }).width + 100;
      }

      // 텍스트 노드 수정 적용
      let appliedCount = 0;
      const textNodes = findAllTextNodes(clone as SceneNode);

      for (const fix of msg.fixes) {
        for (const textNode of textNodes) {
          if (textNode.characters.includes(fix.original)) {
            // 폰트 로드 후 텍스트 교체
            await Promise.all(
              textNode.getRangeAllFontNames(0, textNode.characters.length).map((font) =>
                figma.loadFontAsync(font)
              )
            );
            const newText = textNode.characters.replace(fix.original, fix.suggestion);
            // 오토레이아웃 대응: 텍스트가 길어져도 프레임을 벗어나지 않도록 설정
            if (textNode.textAutoResize !== "WIDTH_AND_HEIGHT") {
              textNode.textAutoResize = "HEIGHT";
            }
            textNode.characters = newText;
            appliedCount++;
            break; // 같은 fix는 첫 매칭에만 적용
          }
        }
      }

      // 복제본 선택 + 뷰포트 이동
      figma.currentPage.selection = [clone as SceneNode];
      figma.viewport.scrollAndZoomIntoView([original as SceneNode, clone as SceneNode]);

      figma.ui.postMessage({
        type: "fix-result",
        success: true,
        appliedCount,
        totalFixes: msg.fixes.length,
        cloneNodeId: clone.id,
      });
    } catch (e) {
      figma.ui.postMessage({
        type: "fix-result",
        success: false,
        error: e instanceof Error ? e.message : "수정 적용 실패",
      });
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};

figma.on("selectionchange", () => {
  figma.ui.postMessage({
    type: "selection-changed",
    count: figma.currentPage.selection.length,
    names: figma.currentPage.selection.map((n) => n.name),
  });
});
