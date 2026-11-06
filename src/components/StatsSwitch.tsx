"use client";

import { useState } from "react";
import { setStatsOff, statsOff } from "@/lib/webStats";

/** The site's version of the app's Settings > Share usage data. */
export function StatsSwitch() {
  const [off, setOff] = useState(false);
  const [checked, setChecked] = useState(false);
  const flip = () => {
    const next = checked ? !off : !statsOff();
    setStatsOff(next);
    setOff(next);
    setChecked(true);
  };
  return (
    <button type="button" onClick={flip} className="min-h-11 rounded-xl bg-white px-4 font-bold text-[#14532d] shadow-sm">
      {checked ? (off ? "الإحصاءات متوقفة / Stats are off" : "الإحصاءات مفعّلة / Stats are on") : "إيقاف أو تشغيل الإحصاءات / Turn stats off or on"}
    </button>
  );
}
