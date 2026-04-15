import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
} from "docx";
import type { AnalysisResult } from "@/lib/storage";

function verdictLabel(v: string): string {
  if (v === "Pass") return "Pass (통과)";
  if (v === "Partial") return "Partial (부분 통과)";
  if (v === "Fail") return "Fail (실패)";
  return v;
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, color: "FFFFFF" })],
      }),
    ],
    shading: { fill: "282828" },
    width: { size: 25, type: WidthType.PERCENTAGE },
  });
}

function cell(text: string, width = 25): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18 })],
      }),
    ],
    width: { size: width, type: WidthType.PERCENTAGE },
  });
}

export function generateDOCX(data: AnalysisResult): Document {
  const children: Paragraph[] = [];
  const tables: (Paragraph | Table)[] = [];

  // ─── Title ───
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Simulo UX 분석 리포트", size: 48, bold: true }),
      ],
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: data.hypothesis, size: 28, italics: true }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${new Date(data.createdAt).toLocaleString()} | ${data.inputType.toUpperCase()}${data.projectTag ? ` | ${data.projectTag}` : ""}`,
          size: 18,
          color: "666666",
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // ─── Overview ───
  tables.push(
    new Paragraph({
      text: "Overview",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  tables.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${data.score}점 — `, size: 36, bold: true }),
        new TextRun({ text: verdictLabel(data.verdict), size: 28, bold: true }),
      ],
      spacing: { after: 100 },
    })
  );

  if (data.taskSuccessLikelihood) {
    tables.push(
      new Paragraph({
        children: [
          new TextRun({ text: "태스크 성공 가능성: ", size: 20, color: "666666" }),
          new TextRun({ text: data.taskSuccessLikelihood, size: 20, bold: true }),
        ],
        spacing: { after: 50 },
      })
    );
  }

  tables.push(
    new Paragraph({
      children: [new TextRun({ text: data.summary, size: 20 })],
      spacing: { after: 200 },
    })
  );

  // Score Breakdown table
  if (data.scoreBreakdown) {
    tables.push(
      new Paragraph({
        text: "점수 분류",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 100 },
      })
    );

    const sb = data.scoreBreakdown;
    tables.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [headerCell("항목"), headerCell("점수"), headerCell("/25"), headerCell("근거")],
          }),
          new TableRow({
            children: [cell("Clarity"), cell(`${sb.clarity.score}`), cell("/25"), cell(sb.clarity.reason)],
          }),
          new TableRow({
            children: [cell("Flow"), cell(`${sb.flow.score}`), cell("/25"), cell(sb.flow.reason)],
          }),
          new TableRow({
            children: [cell("Feedback"), cell(`${sb.feedback.score}`), cell("/25"), cell(sb.feedback.reason)],
          }),
          new TableRow({
            children: [cell("Efficiency"), cell(`${sb.efficiency.score}`), cell("/25"), cell(sb.efficiency.reason)],
          }),
        ],
      })
    );
    tables.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Desire Alignment
  if (data.desireAlignment) {
    tables.push(
      new Paragraph({
        text: "욕망 충족도",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 100 },
      })
    );

    const da = data.desireAlignment;
    tables.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [headerCell("욕망"), headerCell("점수"), headerCell("코멘트")],
          }),
          new TableRow({
            children: [cell("효능감 (Utility)", 20), cell(`${da.utility.score}/10`, 15), cell(da.utility.comment, 65)],
          }),
          new TableRow({
            children: [cell("건강과시 (Health & Pride)", 20), cell(`${da.healthPride.score}/10`, 15), cell(da.healthPride.comment, 65)],
          }),
          new TableRow({
            children: [cell("손실회피 (Loss Aversion)", 20), cell(`${da.lossAversion.score}/10`, 15), cell(da.lossAversion.comment, 65)],
          }),
        ],
      })
    );
    tables.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Retention Risk
  if (data.retentionRisk) {
    tables.push(
      new Paragraph({
        text: "리텐션 리스크",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 100 },
      })
    );
    tables.push(
      new Paragraph({
        children: [
          new TextRun({ text: `D1: ${data.retentionRisk.d1Risk}  /  D7: ${data.retentionRisk.d7Risk}`, size: 20, bold: true }),
        ],
        spacing: { after: 50 },
      })
    );
    tables.push(
      new Paragraph({
        children: [new TextRun({ text: data.retentionRisk.mainRiskReason, size: 20, color: "666666" })],
        spacing: { after: 200 },
      })
    );
  }

  // Strengths
  if (data.strengths?.length) {
    tables.push(
      new Paragraph({
        text: "강점",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 100 },
      })
    );
    for (const s of data.strengths) {
      tables.push(
        new Paragraph({
          children: [new TextRun({ text: `+ ${s}`, size: 20 })],
          spacing: { after: 50 },
        })
      );
    }
    tables.push(new Paragraph({ spacing: { after: 150 } }));
  }

  // Top Priorities
  if (data.topPriorities?.length) {
    tables.push(
      new Paragraph({
        text: "개선 우선순위",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 100 },
      })
    );
    data.topPriorities.forEach((p, i) => {
      tables.push(
        new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${p}`, size: 20 })],
          spacing: { after: 50 },
        })
      );
    });
    tables.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ─── Think Aloud ───
  if (data.thinkAloud?.length) {
    tables.push(
      new Paragraph({
        text: "Think Aloud",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    );

    for (const ta of data.thinkAloud) {
      tables.push(
        new Paragraph({
          children: [new TextRun({ text: ta.screen, size: 20, bold: true })],
          spacing: { after: 50 },
        })
      );
      tables.push(
        new Paragraph({
          children: [new TextRun({ text: `"${ta.thought}"`, size: 20, italics: true, color: "666666" })],
          spacing: { after: 150 },
        })
      );
    }
  }

  // ─── Issues ───
  if (data.issues?.length) {
    tables.push(
      new Paragraph({
        text: `Issues (${data.issues.length})`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    );

    const sorted = [...data.issues].sort((a, b) => {
      const order = { Critical: 0, Medium: 1, Low: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

    tables.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              headerCell("심각도"),
              headerCell("화면"),
              headerCell("욕망"),
              headerCell("이슈"),
              headerCell("개선 권고"),
            ],
          }),
          ...sorted.map(
            (issue) =>
              new TableRow({
                children: [
                  cell(issue.severity, 12),
                  cell(issue.screen, 15),
                  cell(issue.desireType ?? "-", 13),
                  cell(issue.issue, 30),
                  cell(issue.recommendation, 30),
                ],
              })
          ),
        ],
      })
    );
  }

  // ─── Footer ───
  tables.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Generated by Simulo — AI UX Testing Tool", size: 16, color: "AAAAAA" }),
      ],
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
    })
  );

  return new Document({
    sections: [
      {
        children: [...children, ...tables],
      },
    ],
  });
}

export async function generateDOCXBuffer(data: AnalysisResult): Promise<Buffer> {
  const doc = generateDOCX(data);
  return Packer.toBuffer(doc) as Promise<Buffer>;
}
