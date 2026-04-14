"use client";

import { useCallback, useRef, useMemo } from "react";
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
  onInit: (instance: ReactFlowInstance) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddNodeAtPosition,
  onInit,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

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

  // Drop from palette
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type || !rfInstanceRef.current || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstanceRef.current.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      onAddNodeAtPosition(type, position.x, position.y);
    },
    [onAddNodeAtPosition]
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
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={handleInit}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
