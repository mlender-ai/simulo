// ──────────────────────────────────────────────────────────────────────────────
// lib/figma/artifacts.ts
// Generates Figma artifacts: 4 SVG pages + Figma Variables API calls
// ──────────────────────────────────────────────────────────────────────────────

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface DesignTokens {
  colors?: Record<string, string>;
  typography?: { fontFamily?: string; sizes?: Record<string, number> };
  spacing?: number[];
  borderRadius?: Record<string, number>;
}

export interface Component {
  name: string;
  variants?: string[];
  props?: string[];
  usedIn?: string[];
}

export interface Screen {
  route: string;
  name: string;
  components?: string[];
}

export interface UserFlow {
  from: string;
  to: string;
  trigger: string;
}

export interface EventTaxonomyItem {
  screen: string;
  events: string[];
  nextScreens: string[];
}

export interface DesignSpec {
  designTokens?: DesignTokens;
  components?: Component[];
  screens?: Screen[];
  userFlow?: UserFlow[];
  eventTaxonomy?: EventTaxonomyItem[];
}

export interface ArtifactResult {
  variables: { created: number; errors: string[] };
  svgs: {
    tokens: string;
    components: string;
    flow: string;
    taxonomy: string;
  };
}

// ─── SVG primitives ───────────────────────────────────────────────────────────

const SANS = 'Inter, -apple-system, "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace';
const BG = "#0a0a0a";
const SURFACE = "#111111";
const BORDER = "#222222";
const TEXT = "#ededed";
const MUTED = "#666666";
const ACCENT = "#ffffff";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgDoc(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${BG}"/>
  ${body}
</svg>`;
}

function rect(
  x: number, y: number, w: number, h: number,
  { fill = SURFACE, stroke = BORDER, rx = 8, opacity = 1 }: {
    fill?: string; stroke?: string; rx?: number; opacity?: number;
  } = {}
): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1" rx="${rx}" opacity="${opacity}"/>`;
}

function text(
  x: number, y: number, content: string,
  { size = 13, color = TEXT, weight = "normal", family = SANS, anchor = "start" }: {
    size?: number; color?: string; weight?: string; family?: string; anchor?: string;
  } = {}
): string {
  return `<text x="${x}" y="${y}" font-family="${esc(family)}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" dominant-baseline="auto">${esc(content)}</text>`;
}

function line(
  x1: number, y1: number, x2: number, y2: number,
  { color = BORDER, width = 1, dashed = false }: {
    color?: string; width?: number; dashed?: boolean;
  } = {}
): string {
  const dash = dashed ? ' stroke-dasharray="4 4"' : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${dash}/>`;
}

/** Arrow marker def (call once per SVG, include in <defs>) */
function arrowDef(id = "arrow", color = MUTED): string {
  return `<defs>
    <marker id="${id}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="${color}"/>
    </marker>
  </defs>`;
}

function arrow(
  x1: number, y1: number, x2: number, y2: number,
  { color = MUTED, markerId = "arrow" }: { color?: string; markerId?: string } = {}
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5" marker-end="url(#${markerId})"/>`;
}

// ─── Section header helper ────────────────────────────────────────────────────

function sectionHeader(x: number, y: number, label: string, w: number): string {
  return [
    rect(x, y, w, 28, { fill: "#161616", stroke: BORDER, rx: 6 }),
    text(x + 12, y + 18, label, { size: 11, color: MUTED, weight: "600" }),
  ].join("\n  ");
}

// ─── 1. Design Tokens SVG ────────────────────────────────────────────────────

export function generateTokensSVG(designTokens: DesignTokens): string {
  const W = 880;
  const PAD = 40;
  const parts: string[] = [];
  let y = 64;

  // Page title
  parts.push(text(PAD, y, "🎨 Design Tokens", { size: 22, weight: "700", color: ACCENT }));
  y += 48;

  // ── Colors ─────────────────────────────────────────────────────────────────
  const colors = Object.entries(designTokens.colors ?? {});
  if (colors.length > 0) {
    parts.push(sectionHeader(PAD, y, "COLORS", W - PAD * 2));
    y += 44;

    const SWATCH = 80;
    const GAP = 16;
    const COLS = 6;
    const LABEL_H = 36;

    colors.forEach(([name, hex], i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = PAD + col * (SWATCH + GAP);
      const sy = y + row * (SWATCH + LABEL_H + GAP);

      // Swatch rect
      const isLight = isLightColor(String(hex));
      parts.push(`<rect x="${sx}" y="${sy}" width="${SWATCH}" height="${SWATCH}" fill="${esc(hex)}" rx="6" stroke="${BORDER}" stroke-width="1"/>`);
      // Hex label
      parts.push(text(sx + SWATCH / 2, sy + SWATCH + 14, String(hex).toUpperCase(), {
        size: 10, color: MUTED, family: MONO, anchor: "middle",
      }));
      // Name label
      parts.push(text(sx + SWATCH / 2, sy + SWATCH + 28, name, {
        size: 10, color: MUTED, anchor: "middle",
      }));

      void isLight;
    });

    const rowCount = Math.ceil(colors.length / COLS);
    y += rowCount * (SWATCH + LABEL_H + GAP) + 24;
  }

  // ── Typography ─────────────────────────────────────────────────────────────
  const sizes = Object.entries(designTokens.typography?.sizes ?? {});
  if (sizes.length > 0) {
    parts.push(sectionHeader(PAD, y, "TYPOGRAPHY", W - PAD * 2));
    y += 44;

    const fontFamily = designTokens.typography?.fontFamily ?? "Inter";
    parts.push(text(PAD, y, `Font: ${fontFamily}`, { size: 12, color: MUTED }));
    y += 28;

    sizes.forEach(([key, size]) => {
      const numSize = Number(size);
      parts.push(text(PAD, y + numSize * 0.8, `가나다라 Aa 123`, {
        size: numSize, color: TEXT, family: SANS,
      }));
      parts.push(text(PAD + 360, y + numSize * 0.8, `${key} · ${numSize}px`, {
        size: 11, color: MUTED, family: MONO,
      }));
      y += Math.max(numSize + 16, 32);
    });
    y += 16;
  }

  // ── Spacing ────────────────────────────────────────────────────────────────
  const spacing = designTokens.spacing ?? [];
  if (spacing.length > 0) {
    parts.push(sectionHeader(PAD, y, "SPACING", W - PAD * 2));
    y += 44;

    spacing.forEach((sp) => {
      const barW = Math.min(Number(sp) * 3, 400);
      parts.push(rect(PAD, y, barW, 20, { fill: "#1e3a5f", stroke: "#2563eb", rx: 3 }));
      parts.push(text(PAD + barW + 12, y + 14, `${sp}px`, { size: 11, color: MUTED, family: MONO }));
      y += 32;
    });
    y += 8;
  }

  // ── Border Radius ──────────────────────────────────────────────────────────
  const radii = Object.entries(designTokens.borderRadius ?? {});
  if (radii.length > 0) {
    parts.push(sectionHeader(PAD, y, "BORDER RADIUS", W - PAD * 2));
    y += 44;

    const BOX = 56;
    const HGAP = 24;
    radii.forEach(([key, val], i) => {
      const bx = PAD + i * (BOX + HGAP + 48);
      parts.push(rect(bx, y, BOX, BOX, { fill: SURFACE, stroke: "#555", rx: Number(val) }));
      parts.push(text(bx + BOX / 2, y + BOX + 14, key, { size: 10, color: MUTED, anchor: "middle" }));
      parts.push(text(bx + BOX / 2, y + BOX + 26, `${val}px`, { size: 10, color: MUTED, family: MONO, anchor: "middle" }));
    });
    y += BOX + 48;
  }

  y += PAD;
  return svgDoc(W, y, parts.join("\n  "));
}

function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 128;
}

// ─── 2. Components SVG ───────────────────────────────────────────────────────

export function generateComponentsSVG(components: Component[]): string {
  const W = 880;
  const PAD = 40;
  const CARD_W = (W - PAD * 2 - 24) / 2;
  const parts: string[] = [];
  let y = 64;

  parts.push(text(PAD, y, "📦 Components", { size: 22, weight: "700", color: ACCENT }));
  parts.push(text(PAD, y + 28, `${components.length}개 컴포넌트`, { size: 13, color: MUTED }));
  y += 72;

  components.forEach((comp, i) => {
    const col = i % 2;
    const cardX = PAD + col * (CARD_W + 24);

    if (col === 0 && i > 0) y += estimateCardHeight(comp);

    const startY = y;
    let cardY = startY + 20;

    // Card title
    parts.push(text(cardX + 16, cardY, comp.name, { size: 15, weight: "700", color: ACCENT }));
    cardY += 24;

    // Variants
    if (comp.variants && comp.variants.length > 0) {
      parts.push(text(cardX + 16, cardY, "Variants", { size: 10, color: MUTED }));
      cardY += 18;
      let tagX = cardX + 16;
      comp.variants.forEach((v) => {
        const tagW = v.length * 6.5 + 16;
        if (tagX + tagW > cardX + CARD_W - 16) { tagX = cardX + 16; cardY += 26; }
        parts.push(rect(tagX, cardY - 12, tagW, 20, { fill: "#1e2a3a", stroke: "#2a4a6a", rx: 4 }));
        parts.push(text(tagX + 8, cardY + 2, v, { size: 10, color: "#7eb8f7" }));
        tagX += tagW + 6;
      });
      cardY += 28;
    }

    // Props
    if (comp.props && comp.props.length > 0) {
      parts.push(text(cardX + 16, cardY, "Props", { size: 10, color: MUTED }));
      cardY += 18;
      parts.push(text(cardX + 16, cardY, comp.props.join(", "), { size: 11, color: MUTED, family: MONO }));
      cardY += 20;
    }

    // Used in
    if (comp.usedIn && comp.usedIn.length > 0) {
      parts.push(text(cardX + 16, cardY, `사용: ${comp.usedIn.join(", ")}`, { size: 10, color: MUTED }));
      cardY += 18;
    }

    const cardH = cardY - startY + 16;
    // Draw card behind content
    parts.unshift(rect(cardX, startY, CARD_W, cardH, { fill: SURFACE, stroke: BORDER, rx: 10 }));

    if (col === 1 || i === components.length - 1) {
      y += cardH + 16;
    }
  });

  y += PAD;
  return svgDoc(W, Math.max(y, 400), parts.join("\n  "));
}

function estimateCardHeight(comp: Component): number {
  let h = 56; // title + padding
  if (comp.variants?.length) h += Math.ceil(comp.variants.length / 5) * 26 + 36;
  if (comp.props?.length) h += 38;
  if (comp.usedIn?.length) h += 18;
  return h + 32;
}

// ─── 3. User Flow SVG ────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 72;
const H_GAP = 80;
const V_GAP = 60;

export function generateFlowSVG(userFlow: UserFlow[], screens: Screen[]): string {
  // Build graph
  const allNodes = new Set<string>();
  const outEdges = new Map<string, { to: string; trigger: string }[]>();
  const inDegree = new Map<string, number>();

  userFlow.forEach(({ from, to, trigger }) => {
    allNodes.add(from);
    allNodes.add(to);
    if (!outEdges.has(from)) outEdges.set(from, []);
    outEdges.get(from)!.push({ to, trigger });
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  });

  // Add screens not in flow
  screens.forEach((s) => allNodes.add(s.name));

  // Layered BFS
  const layers: string[][] = [];
  const visited = new Set<string>();
  let current = Array.from(allNodes).filter((n) => !inDegree.get(n));
  if (current.length === 0 && allNodes.size > 0) current = [Array.from(allNodes)[0]];

  while (current.length > 0) {
    const deduped = Array.from(new Set(current)).filter((n) => !visited.has(n));
    if (deduped.length === 0) break;
    layers.push(deduped);
    deduped.forEach((n) => visited.add(n));
    const next: string[] = [];
    deduped.forEach((n) => {
      (outEdges.get(n) ?? []).forEach(({ to }) => {
        if (!visited.has(to)) next.push(to);
      });
    });
    current = next;
  }

  // Any unvisited nodes
  const unvisited = Array.from(allNodes).filter((n) => !visited.has(n));
  if (unvisited.length > 0) layers.push(unvisited);

  // Compute canvas size
  const maxCols = Math.max(...layers.map((l) => l.length), 1);
  const totalW = Math.max(maxCols * (NODE_W + H_GAP) + 80, 600);
  const totalH = layers.length * (NODE_H + V_GAP) + 160;
  const W = totalW;

  // Assign positions
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, layerIdx) => {
    const rowW = layer.length * NODE_W + (layer.length - 1) * H_GAP;
    const startX = (W - rowW) / 2;
    layer.forEach((name, nodeIdx) => {
      pos.set(name, {
        x: startX + nodeIdx * (NODE_W + H_GAP),
        y: 120 + layerIdx * (NODE_H + V_GAP),
      });
    });
  });

  const parts: string[] = [arrowDef("arrow-flow", "#555")];

  // Title
  parts.push(text(40, 52, "🗺️ User Flow", { size: 22, weight: "700", color: ACCENT }));
  parts.push(text(40, 76, `${allNodes.size}개 화면 · ${userFlow.length}개 전환`, { size: 12, color: MUTED }));

  // Edges first (drawn under nodes)
  userFlow.forEach(({ from, to, trigger }) => {
    const fp = pos.get(from);
    const tp = pos.get(to);
    if (!fp || !tp) return;

    const x1 = fp.x + NODE_W / 2;
    const y1 = fp.y + NODE_H;
    const x2 = tp.x + NODE_W / 2;
    const y2 = tp.y;

    // Curved path
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    parts.push(`<path d="M${x1},${y1} Q${mx},${my + 20} ${x2},${y2}" fill="none" stroke="#444" stroke-width="1.5" marker-end="url(#arrow-flow)"/>`);

    // Trigger label on midpoint
    if (trigger) {
      const lx = (x1 + x2) / 2;
      const ly = (y1 + y2) / 2 + 10;
      parts.push(rect(lx - (trigger.length * 3.5), ly - 10, trigger.length * 7, 16, {
        fill: "#1a1a1a", stroke: BORDER, rx: 4,
      }));
      parts.push(text(lx, ly + 2, trigger, { size: 9, color: MUTED, anchor: "middle" }));
    }
  });

  // Nodes
  Array.from(allNodes).forEach((name) => {
    const p = pos.get(name);
    if (!p) return;

    const screen = screens.find((s) => s.name === name);
    parts.push(rect(p.x, p.y, NODE_W, NODE_H, { fill: "#151515", stroke: "#333", rx: 8 }));
    parts.push(text(p.x + NODE_W / 2, p.y + 28, name, {
      size: 13, weight: "600", color: TEXT, anchor: "middle",
    }));
    if (screen?.route) {
      parts.push(text(p.x + NODE_W / 2, p.y + 48, screen.route, {
        size: 10, color: MUTED, family: MONO, anchor: "middle",
      }));
    }
  });

  return svgDoc(W, totalH, parts.join("\n  "));
}

// ─── 4. Event Taxonomy SVG ───────────────────────────────────────────────────

export function generateTaxonomySVG(eventTaxonomy: EventTaxonomyItem[]): string {
  const W = 920;
  const PAD = 40;
  const COL1 = 180; // screen name col width
  const COL2 = 380; // events col width
  const COL3 = 240; // next screens col width
  const ROW_H_BASE = 48;
  const parts: string[] = [];
  let y = 64;

  parts.push(text(PAD, y, "📊 Event Taxonomy", { size: 22, weight: "700", color: ACCENT }));
  parts.push(text(PAD, y + 28, `${eventTaxonomy.length}개 화면`, { size: 13, color: MUTED }));
  y += 64;

  // Table header
  const headerY = y;
  parts.push(rect(PAD, headerY, W - PAD * 2, 32, { fill: "#161616", stroke: BORDER, rx: 6 }));
  parts.push(text(PAD + 16, headerY + 20, "화면", { size: 11, weight: "600", color: MUTED }));
  parts.push(text(PAD + 16 + COL1, headerY + 20, "이벤트", { size: 11, weight: "600", color: MUTED }));
  parts.push(text(PAD + 16 + COL1 + COL2, headerY + 20, "다음 화면", { size: 11, weight: "600", color: MUTED }));
  y += 40;

  eventTaxonomy.forEach((item, idx) => {
    const eventsPerLine = 4;
    const eventLines = Math.ceil((item.events?.length ?? 0) / eventsPerLine);
    const rowH = Math.max(ROW_H_BASE, eventLines * 22 + 26);

    // Alternating row background
    if (idx % 2 === 0) {
      parts.push(rect(PAD, y, W - PAD * 2, rowH, { fill: "#0d0d0d", stroke: BORDER, rx: 0 }));
    }

    // Screen name
    parts.push(text(PAD + 16, y + 22, item.screen, {
      size: 12, color: TEXT, family: MONO, weight: "500",
    }));

    // Events as pills
    const events = item.events ?? [];
    let ex = PAD + 16 + COL1;
    let ey = y + 14;
    events.forEach((ev, i) => {
      if (i > 0 && i % eventsPerLine === 0) { ex = PAD + 16 + COL1; ey += 22; }
      const tw = ev.length * 6.2 + 14;
      parts.push(rect(ex, ey, tw, 18, { fill: "#1a2a1a", stroke: "#2d4a2d", rx: 4 }));
      parts.push(text(ex + 7, ey + 12, ev, { size: 9, color: "#7ecf7e", family: MONO }));
      ex += tw + 6;
    });

    // Next screens
    const nextScreens = item.nextScreens ?? [];
    parts.push(text(PAD + 16 + COL1 + COL2, y + 22, nextScreens.join(", "), {
      size: 11, color: MUTED,
    }));

    // Separator line
    parts.push(line(PAD, y + rowH, PAD + W - PAD * 2, y + rowH, { color: BORDER }));

    y += rowH;
  });

  // Table border (outer)
  const tableH = y - (headerY);
  parts.push(`<rect x="${PAD}" y="${headerY}" width="${W - PAD * 2}" height="${tableH}" fill="none" stroke="${BORDER}" stroke-width="1" rx="6"/>`);

  // Column dividers
  parts.push(line(PAD + 16 + COL1 - 16, headerY, PAD + 16 + COL1 - 16, y, { color: BORDER }));
  parts.push(line(PAD + 16 + COL1 + COL2 - 16, headerY, PAD + 16 + COL1 + COL2 - 16, y, { color: BORDER }));

  y += PAD;
  return svgDoc(W, Math.max(y, 300), parts.join("\n  "));
}

// ─── Figma Variables API ──────────────────────────────────────────────────────

export interface VariablesResult {
  created: number;
  errors: string[];
}

function hexToFigmaColor(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace("#", "").padEnd(6, "0");
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
    a: 1,
  };
}

export async function createFigmaVariables(
  fileKey: string,
  token: string,
  designTokens: DesignTokens,
): Promise<VariablesResult> {
  const errors: string[] = [];
  const headers = { "X-Figma-Token": token, "Content-Type": "application/json" };

  // ── Build color variables ──────────────────────────────────────────────────
  const colorEntries = Object.entries(designTokens.colors ?? {}).filter(
    ([, hex]) => String(hex).startsWith("#"),
  );

  // ── Build number variables (spacing + typography) ─────────────────────────
  const numberEntries: { name: string; value: number }[] = [];
  (designTokens.spacing ?? []).forEach((sp) => {
    numberEntries.push({ name: `spacing/${sp}`, value: Number(sp) });
  });
  Object.entries(designTokens.typography?.sizes ?? {}).forEach(([key, size]) => {
    numberEntries.push({ name: `typography/${key}`, value: Number(size) });
  });
  Object.entries(designTokens.borderRadius ?? {}).forEach(([key, val]) => {
    numberEntries.push({ name: `radius/${key}`, value: Number(val) });
  });

  if (colorEntries.length === 0 && numberEntries.length === 0) {
    return { created: 0, errors: ["생성할 변수가 없습니다."] };
  }

  const COLL_ID = "simulo_collection";
  const MODE_ID = "simulo_mode";

  // Build variable IDs
  const colorVars = colorEntries.map(([name], i) => ({
    localId: `color_${i}`,
    name: `colors/${name}`,
    hex: colorEntries[i][1],
  }));
  const numberVars = numberEntries.map((e, i) => ({
    localId: `num_${i}`,
    name: e.name,
    value: e.value,
  }));

  const payload = {
    variableCollections: [
      { action: "CREATE", id: COLL_ID, name: "Simulo Design Tokens" },
    ],
    variableModes: [
      { action: "CREATE", id: MODE_ID, name: "Default", variableCollectionId: COLL_ID },
    ],
    variables: [
      ...colorVars.map(({ localId, name }) => ({
        action: "CREATE",
        id: localId,
        name,
        resolvedType: "COLOR",
        variableCollectionId: COLL_ID,
      })),
      ...numberVars.map(({ localId, name }) => ({
        action: "CREATE",
        id: localId,
        name,
        resolvedType: "FLOAT",
        variableCollectionId: COLL_ID,
      })),
    ],
    variableModeValues: [
      ...colorVars.map(({ localId, hex }) => ({
        action: "CREATE",
        variableId: localId,
        modeId: MODE_ID,
        value: hexToFigmaColor(hex),
      })),
      ...numberVars.map(({ localId, value }) => ({
        action: "CREATE",
        variableId: localId,
        modeId: MODE_ID,
        value,
      })),
    ],
  };

  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      errors.push(`Variables API ${res.status}: ${body.slice(0, 300)}`);
      return { created: 0, errors };
    }

    return {
      created: colorVars.length + numberVars.length,
      errors: [],
    };
  } catch (e) {
    errors.push(`Fetch error: ${(e as Error).message}`);
    return { created: 0, errors };
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function generateArtifacts(
  spec: DesignSpec,
  figmaFileKey?: string,
  figmaToken?: string,
): Promise<ArtifactResult> {
  // Generate SVGs (always)
  const svgs = {
    tokens: generateTokensSVG(spec.designTokens ?? {}),
    components: generateComponentsSVG(spec.components ?? []),
    flow: generateFlowSVG(spec.userFlow ?? [], spec.screens ?? []),
    taxonomy: generateTaxonomySVG(spec.eventTaxonomy ?? []),
  };

  // Figma variables (only if credentials provided)
  let variables: VariablesResult = { created: 0, errors: [] };
  if (figmaFileKey && figmaToken && spec.designTokens) {
    variables = await createFigmaVariables(figmaFileKey, figmaToken, spec.designTokens);
  }

  return { svgs, variables };
}
