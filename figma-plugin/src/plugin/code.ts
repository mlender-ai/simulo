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

type PluginMessage =
  | { type: "get-selection" }
  | { type: "get-file-info" }
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
    const images: { name: string; base64: string }[] = [];

    for (const node of nodes) {
      try {
        // exportAsync is available on SceneNode with export support
        if ("exportAsync" in node) {
          const bytes = await (node as ExportMixin).exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 1.5 },
          });
          images.push({
            name: node.name,
            base64: uint8ToBase64(bytes),
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

  if (msg.type === "get-file-info") {
    figma.ui.postMessage({
      type: "file-info",
      fileName: figma.root.name,
      currentPage: figma.currentPage.name,
      selectionCount: figma.currentPage.selection.length,
      names: figma.currentPage.selection.map((n) => n.name),
    });
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
