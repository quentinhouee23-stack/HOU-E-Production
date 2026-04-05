"use client";

import React from "react";
import { LayoutGroup } from "framer-motion";

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  return <LayoutGroup>{children}</LayoutGroup>;
}