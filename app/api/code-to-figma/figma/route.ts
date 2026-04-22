import { NextRequest, NextResponse } from "next/server";
import { generateDesign } from "@/lib/figma/claudeDesignBridge";
import type { DesignSpec } from "@/lib/figma/artifacts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spec, figmaFileUrl, figmaToken } = body as {
      spec: DesignSpec;
      figmaFileUrl?: string;
      figmaToken?: string;
    };

    if (!spec) {
      return NextResponse.json({ error: "spec이 필요합니다." }, { status: 400 });
    }

    console.log(
      "[code-to-figma/figma] provider:", process.env.DESIGN_PROVIDER ?? "rest-api",
      "| components:", spec.components?.length ?? 0,
      "| screens:", spec.screens?.length ?? 0,
    );

    const result = await generateDesign({
      spec,
      figmaFileUrl,
      figmaToken,
      outputFormat: "figma",
    });

    console.log(
      "[code-to-figma/figma] Done | provider:", result.provider,
      "| variables created:", result.variables?.created ?? 0,
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[code-to-figma/figma] Error:", error);
    const message = error instanceof Error ? error.message : "Figma 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
