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

type PluginMessage =
  | { type: "get-selection" }
  | { type: "get-selection-for-writing" }
  | { type: "get-file-info" }
  | { type: "save-api-key"; key: string }
  | { type: "load-api-key" }
  | { type: "save-simulo-url"; url: string }
  | { type: "load-simulo-url" }
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
    const frames: { name: string; base64: string; texts: ExtractedText[] }[] = [];

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
