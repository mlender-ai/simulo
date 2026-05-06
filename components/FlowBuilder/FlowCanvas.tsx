"use client";

import { useCallback, useRef, useMemo, useState } from "react";
import ReactFlow, {
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { ScreenNode } from "./ScreenNode";
import { StartNode, EndNode } from "./TerminalNode";
import { DropOffEdge } from "./DropOffEdge";

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onAddNodeAtPosition: (type: string, x: number, y: number) => void;
  onImagesDropped: (images: { name: string; base64: string }[]) => void;
  onInit: (instance: ReactFlowInstance) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddNodeAtPosition,
  onImagesDropped,
  onInit,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [dragOverImages, setDragOverImages] = useState(false);

  const nodeTypes = useMemo(
    () => ({
      screen: ScreenNode,
      start: StartNode,
      end: EndNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      dropoff: DropOffEdge,
    }),
    []
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      rfInstanceRef.current = instance;
      onInit(instance);
    },
    [onInit]
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      onConnect(params);
    },
    [onConnect]
  );

  const hasImageFiles = (dt: DataTransfer): boolean => {
    if (dt.types.includes("Files")) {
      for (let i = 0; i < dt.items.length; i++) {
        if (dt.items[i].type.startsWith("image/")) return true;
      }
    }
    return false;
  };

  // Drop from palette OR image files
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (hasImageFiles(e.dataTransfer)) {
      e.dataTransfer.dropEffect = "copy";
      setDragOverImages(true);
    } else {
      e.dataTransfer.dropEffect = "move";
      setDragOverImages(false);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverImages(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverImages(false);

      // Check for image files first
      if (hasImageFiles(e.dataTransfer)) {
        const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length > 0) {
          const results: { name: string; base64: string }[] = [];
          let loaded = 0;
          files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
              results.push({
                name: file.name.replace(/\.[^.]+$/, ""),
                base64: reader.result as string,
              });
              loaded++;
              if (loaded === files.length) {
                results.sort((a, b) => a.name.localeCompare(b.name, "ko"));
                onImagesDropped(results);
              }
            };
            reader.readAsDataURL(file);
          });
          return;
        }
      }

      // Fallback: node palette drop
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type || !rfInstanceRef.current || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstanceRef.current.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      onAddNodeAtPosition(type, position.x, position.y);
    },
    [onAddNodeAtPosition, onImagesDropped]
  );

  // Double-click to add screen node
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!rfInstanceRef.current || !reactFlowWrapper.current) return;
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstanceRef.current.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      onAddNodeAtPosition("screen", position.x, position.y);
    },
    [onAddNodeAtPosition]
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full relative">
      {/* Image drop overlay */}
      {dragOverImages && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 border-2 border-dashed border-white/40 rounded-lg pointer-events-none">
          <div className="text-center">
            <p className="text-white text-sm font-medium">이미지를 놓으면 플로우가 자동 생성됩니다</p>
            <p className="text-white/40 text-xs mt-1">시작 → 화면1 → 화면2 → ... → 종료</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {nodes.length === 0 && !dragOverImages && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-white/20 text-sm">이미지를 여기에 드래그하거나</p>
            <p className="text-white/20 text-sm">왼쪽 패널에서 &quot;이미지로 플로우 만들기&quot;를 클릭하세요</p>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={handleInit}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
        onDoubleClick={handleDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "dropoff",
          animated: true,
        }}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1a1a1a" gap={20} />
        <Controls
          className="!bg-[#111] !border-[#222] !rounded-lg [&>button]:!bg-[#111] [&>button]:!border-[#222] [&>button]:!fill-white/40 [&>button:hover]:!fill-white/80"
        />
      </ReactFlow>
    </div>
  );
}
