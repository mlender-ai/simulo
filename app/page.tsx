"use client";

import { WebChatContainer } from "@/components/web-chat/WebChatContainer";

export default function HomePage() {
  return (
    <div className="h-[calc(100dvh-56px)] md:h-dvh">
      <WebChatContainer />
    </div>
  );
}
