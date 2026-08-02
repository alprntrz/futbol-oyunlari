"use client";

import { PracticeMode } from "@/components/PracticeMode";
import { globalMatches } from "@/lib/daily";

export default function PracticePage() {
  return <PracticeMode pool={globalMatches()} navActive="practice" />;
}
