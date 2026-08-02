"use client";

import { PracticeMode } from "@/components/PracticeMode";
import { turkishMatches } from "@/lib/daily";
import { useI18n } from "@/lib/i18n";

export default function TurkiyePage() {
  const { t } = useI18n();
  return (
    <PracticeMode
      pool={turkishMatches()}
      navActive="turkiye"
      emptyText={t("noMatches")}
    />
  );
}
