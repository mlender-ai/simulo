"use client";

import { useState, useCallback, useRef } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from "reactflow";
import { v4 as uuidv4 } from "uuid";
import { type Locale, t } from "@/lib/i18n";
import { type ScreenNodeData } from "./ScreenNode";
import { FlowCanvas } from "./FlowCanvas";
import { NodePanel } from "./NodePanel";
import { FlowToolbar } from "./FlowToolbar";

const STORAGE_KEY = "simulo_flow_builder";

interface SavedFlow {
  id: string;
  name: string;
  hypothesis: string;
  targetUser: string;
  nodes: Node[];
  edges: Edge[];
  savedAt: string;
}

interface FlowSummary {
  totalDropOffRisk: string;
  estimatedCompletionRate: number;
  biggestDropOffNode: string | null;
  criticalPath: string[];
  overallSummary: string;
}

interface PathResult {
  path: string[];
  pathName: string;
  estimatedCompletionRate: number;
}

// Strip image data before saving to localStorage
function stripNodeImages(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (n.type === "screen" && n.data?.imageBase64) {
      return { ...n, data: { ...n.data, imageBase64: null } };
    }
    return n;
  });
}

interface FlowBuilderProps {
  locale: Locale;
}

export function FlowBuilder({ locale }: FlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hypothesis, setHypothesis] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [flowName, setFlowName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>([]);
  const [flowSummary, setFlowSummary] = useState<FlowSummary | null>(null);
  const [paths, setPaths] = useState<PathResult[]>([]);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  const hasStartNode = nodes.some((n) => n.type === "start");

  // --- Node data callbacks (passed into node data) ---

  const handleNameChange = useCallback(
    (nodeId: string, name: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, name } } : n
        )
      );
    },
    [setNodes]
  );

  const handleImageUpload = useCallback(
    (nodeId: string, base64: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, imageBase64: base64 } }
            : n
        )
      );
    },
    [setNodes]
  );

  const handleEndLabelChange = useCallback(
    (nodeId: string, label: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
        )
      );
    },
    [setNodes]
  );

  // --- Add node ---

  const addNode = useCallback(
    (type: string, x?: number, y?: number) => {
      if (type === "start" && hasStartNode) return;

      const id = uuidv4();
      const posX = x ?? 100 + nodes.length * 250;
      const posY = y ?? 200;

      let newNode: Node;
      if (type === "start") {
        newNode = {
          id,
          type: "start",
          position: { x: posX, y: posY },
          data: { label: t("fbStart", locale) },
        };
      } else if (type === "end") {
        newNode = {
          id,
          type: "end",
          position: { x: posX, y: posY },
          data: {
            label: t("fbEndLabel", locale),
            onLabelChange: handleEndLabelChange,
          },
        };
      } else {
        newNode = {
          id,
          type: "screen",
          position: { x: posX, y: posY },
          data: {
            name: "",
            imageBase64: null,
            analysisResult: null,
            onNameChange: handleNameChange,
            onImageUpload: handleImageUpload,
          } as ScreenNodeData,
        };
      }

      setNodes((nds) => [...nds, newNode]);
    },
    [nodes.length, hasStartNode, locale, setNodes, handleNameChange, handleImageUpload, handleEndLabelChange]
  );

  const handleAddNode = useCallback(
    (type: "start" | "screen" | "end") => addNode(type),
    [addNode]
  );

  const handleAddNodeAtPosition = useCallback(
    (type: string, x: number, y: number) => addNode(type, x, y),
    [addNode]
  );

  // --- Edge connect ---

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, type: "dropoff", animated: true }, eds)
      );
    },
    [setEdges]
  );

  // --- Save / Load / Reset ---

  const handleSave = useCallback(() => {
    const flow: SavedFlow = {
      id: uuidv4(),
      name: flowName || `Flow ${new Date().toLocaleDateString()}`,
      hypothesis,
      targetUser,
      nodes: stripNodeImages(nodes),
      edges,
      savedAt: new Date().toISOString(),
    };

    const existing: SavedFlow[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    existing.unshift(flow);
    if (existing.length > 20) existing.length = 20;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }, [flowName, hypothesis, targetUser, nodes, edges]);

  const handleLoad = useCallback(() => {
    const flows: SavedFlow[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    setSavedFlows(flows);
    setShowLoadModal(true);
  }, []);

  const loadFlow = useCallback(
    (flow: SavedFlow) => {
      const restoredNodes = flow.nodes.map((n) => {
        if (n.type === "screen") {
          return {
            ...n,
            data: {
              ...n.data,
              onNameChange: handleNameChange,
              onImageUpload: handleImageUpload,
            },
          };
        }
        if (n.type === "end") {
          return {
            ...n,
            data: { ...n.data, onLabelChange: handleEndLabelChange },
          };
        }
        return n;
      });
      setNodes(restoredNodes);
      setEdges(flow.edges);
      setHypothesis(flow.hypothesis);
      setTargetUser(flow.targetUser);
      setFlowName(flow.name);
      setShowLoadModal(false);
      setFlowSummary(null);
      setPaths([]);
    },
    [setNodes, setEdges, handleNameChange, handleImageUpload, handleEndLabelChange]
  );

  const handleReset = useCallback(() => {
    if (!confirm(t("fbResetConfirm", locale))) return;
    setNodes([]);
    setEdges([]);
    setHypothesis("");
    setTargetUser("");
    setFlowName("");
    setFlowSummary(null);
    setPaths([]);
  }, [locale, setNodes, setEdges]);

  // --- Analysis (3-phase pipeline) ---

  const handleAnalyze = useCallback(async () => {
    const screenNodes = nodes.filter((n) => n.type === "screen");
    if (screenNodes.length === 0) return;

    setAnalyzing(true);
    setFlowSummary(null);
    setPaths([]);

    try {
      // Send full node+edge graph to the 3-phase API
      const apiNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.data.name || n.data.label || "",
        imageBase64: n.data.imageBase64 || null,
        position: n.position,
      }));

      const apiEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle ?? undefined,
        target: e.target,
      }));

      const response = await fetch("/api/analyze-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: apiNodes,
          edges: apiEdges,
          hypothesis,
          targetUser,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "Analysis failed");
      }

      const result = await response.json();

      const nodeResults: Record<string, {
        dropOffRisk: string;
        dropOffPercent: number;
        stayPercent: number;
        mainReason: string;
        frictionPoints: string[];
        desireScore: { utility: number; healthPride: number; lossAversion: number };
      }> = result.nodeResults ?? {};

      const edgeResults: Record<string, {
        transitionSmooth: boolean;
        dropOffAtTransition: number;
        reason: string;
        recommendation: string;
      }> = result.edgeResults ?? {};

      // Apply node results
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== "screen") return n;
          const nr = nodeResults[n.id];
          if (!nr) return n;

          return {
            ...n,
            data: {
              ...n.data,
              analysisResult: {
                dropOffRisk: nr.dropOffRisk as "높음" | "보통" | "낮음",
                dropOffPercent: nr.dropOffPercent,
                stayPercent: nr.stayPercent,
                mainReason: nr.mainReason,
                frictionPoints: nr.frictionPoints ?? [],
                desireScore: nr.desireScore,
              },
            },
          };
        })
      );

      // Apply edge results
      setEdges((eds) =>
        eds.map((e) => {
          const er = edgeResults[e.id];
          if (!er) return e;

          return {
            ...e,
            animated: false,
            data: {
              ...e.data,
              transitionSmooth: er.transitionSmooth,
              dropOffAtTransition: er.dropOffAtTransition,
              reason: er.reason,
              recommendation: er.recommendation,
            },
          };
        })
      );

      // Set flow summary
      if (result.flowSummary) {
        setFlowSummary(result.flowSummary);
      }
      if (result.paths) {
        setPaths(result.paths);
      }
    } catch (err) {
      console.error("[FlowBuilder] Analysis error:", err);
    } finally {
      setAnalyzing(false);
    }
  }, [nodes, edges, hypothesis, targetUser, setNodes, setEdges]);

  const RISK_COLORS: Record<string, string> = {
    "높음": "text-red-400",
    "보통": "text-amber-400",
    "낮음": "text-emerald-400",
  };

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      <FlowToolbar
        locale={locale}
        flowName={flowName}
        onFlowNameChange={setFlowName}
        onSave={handleSave}
        onLoad={handleLoad}
        onReset={handleReset}
      />
      <div className="flex flex-1 overflow-hidden">
        <NodePanel
          locale={locale}
          hypothesis={hypothesis}
          targetUser={targetUser}
          analyzing={analyzing}
          hasStartNode={hasStartNode}
          onHypothesisChange={setHypothesis}
          onTargetUserChange={setTargetUser}
          onAddNode={handleAddNode}
          onAnalyze={handleAnalyze}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onAddNodeAtPosition={handleAddNodeAtPosition}
            onInit={(inst) => { rfInstance.current = inst; }}
          />

          {/* Flow summary panel (shown after analysis) */}
          {flowSummary && (
            <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shrink-0">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-[var(--muted)]">전체 이탈 위험 </span>
                  <span className={`font-medium ${RISK_COLORS[flowSummary.totalDropOffRisk] ?? "text-white"}`}>
                    {flowSummary.totalDropOffRisk}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted)]">완료율 </span>
                  <span className="font-medium mono">{flowSummary.estimatedCompletionRate}%</span>
                </div>
                {paths.length > 0 && (
                  <div>
                    <span className="text-[var(--muted)]">경로 </span>
                    {paths.map((p, i) => (
                      <span key={i} className="mr-2">
                        <span className="text-white/60">{p.pathName}</span>
                        <span className="mono ml-1 text-white/40">({p.estimatedCompletionRate}%)</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {flowSummary.overallSummary && (
                <p className="text-[11px] text-white/50 mt-1.5">{flowSummary.overallSummary}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Load modal */}
      {showLoadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowLoadModal(false)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-96 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-4">
              {t("fbSavedFlows", locale)}
            </h3>
            {savedFlows.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                {t("fbNoSavedFlows", locale)}
              </p>
            ) : (
              <div className="space-y-2">
                {savedFlows.map((flow) => (
                  <button
                    key={flow.id}
                    onClick={() => loadFlow(flow)}
                    className="w-full text-left p-3 rounded-lg border border-[var(--border)] hover:border-white/20 transition-colors"
                  >
                    <p className="text-xs font-medium">{flow.name}</p>
                    <p className="text-[10px] text-[var(--muted)] mt-1">
                      {new Date(flow.savedAt).toLocaleString()} ·{" "}
                      {flow.nodes.filter((n) => n.type === "screen").length}{" "}
                      {t("fbScreen", locale)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
