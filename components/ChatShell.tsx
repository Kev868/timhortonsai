"use client";

import { useState } from "react";
import { BrandHeader } from "./BrandHeader";
import { ChatContainer } from "./ChatContainer";

export function ChatShell() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <BrandHeader onReset={() => setResetKey((k) => k + 1)} />
      <ChatContainer key={resetKey} />
    </>
  );
}
