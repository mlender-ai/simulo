import { NextRequest, NextResponse } from "next/server";

function parseFileKey(url: string): string | null {
  // Matches: figma.com/file/KEY/..., figma.com/design/KEY/...
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { figmaUrl, figmaToken } = await request.json();

    if (!figmaToken) {
      return NextResponse.json({ error: "Figma token is required" }, { status: 400 });
    }

    if (!figmaUrl) {
      return NextResponse.json({ error: "Figma URL is required" }, { status: 400 });
    }

    const fileKey = parseFileKey(figmaUrl);
    if (!fileKey) {
      return NextResponse.json(
        { error: "Invalid Figma URL. Use a URL like figma.com/file/KEY/..." },
        { status: 400 }
      );
    }

    // Fetch file info from Figma API
    const fileRes = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
      headers: { "X-Figma-Token": figmaToken },
    });

    if (!fileRes.ok) {
      const status = fileRes.status;
      if (status === 403) {
        return NextResponse.json({ error: "Invalid Figma token or no access to this file" }, { status: 403 });
      }
      if (status === 404) {
        return NextResponse.json({ error: "Figma file not found" }, { status: 404 });
      }
      return NextResponse.json({ error: `Figma API error (${status})` }, { status });
    }

    const fileData = await fileRes.json();
    const fileName = fileData.name || "Untitled";

    // Extract top-level frames (pages → children that are FRAME or COMPONENT)
    const frames: { id: string; name: string; pageName: string }[] = [];
    for (const page of fileData.document?.children ?? []) {
      for (const child of page.children ?? []) {
        if (child.type === "FRAME" || child.type === "COMPONENT" || child.type === "COMPONENT_SET") {
          frames.push({
            id: child.id,
            name: child.name,
            pageName: page.name,
          });
        }
      }
    }

    return NextResponse.json({
      fileKey,
      fileName,
      frames,
    });
  } catch (error) {
    console.error("[figma-validate] Error:", error);
    return NextResponse.json({ error: "Failed to validate Figma file" }, { status: 500 });
  }
}
