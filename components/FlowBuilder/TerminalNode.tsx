"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface StartNodeData {
  label: string;
}

export interface EndNodeData {
  label: string;
  onLabelChange?: (id: string, label: string) => void;
}

function StartNodeComponent({ data }: NodeProps<StartNodeData>) {
  return (
    <div
      className="rounded-2xl border-2 border-orange-400/60 bg-orange-400/5 flex items-center justify-center"
      style={{ width: 120, height: 48 }}
    >
      <span className="text-xs font-medium text-orange-300">{data.label}</span>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-orange-400/60 !border-orange-400/30"
      />
    </div>
  );
}

function EndNodeComponent({ id, data }: NodeProps<EndNodeData>) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      data.onLabelChange?.(id, e.target.value);
    },
    [id, data]
  );

  return (
    <div
      className="rounded-2xl border-2 border-orange-400/60 bg-orange-400/5 flex items-center justify-center px-3"
      style={{ minWidth: 120, height: 48 }}
    >
      <input
        value={data.label}
        onChange={handleChange}
        placeholder="종료"
        className="w-full bg-transparent text-xs font-medium text-orange-300 placeholder:text-orange-300/40 outline-none text-center"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-orange-400/60 !border-orange-400/30"
      />
    </div>
  );
}

export const StartNode = memo(StartNodeComponent);
export const EndNode = memo(EndNodeComponent);
