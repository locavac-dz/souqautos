"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DAYS,
  type DayKey,
  type DaySchedule,
  type WeekSchedule,
  defaultWeekSchedule,
  parseHorairesSemaine,
} from "@/lib/horaires-semaine";

export function StructuredHoursEditor({
  initialJson,
  onChange,
}: {
  initialJson: string | null;
  onChange: (json: string) => void;
}) {
  const t = useTranslations("Pro");
  const [schedule, setSchedule] = useState<WeekSchedule>(
    () => parseHorairesSemaine(initialJson) ?? defaultWeekSchedule()
  );

  function updateDay(day: DayKey, patch: Partial<DaySchedule>) {
    setSchedule((prev) => {
      const next = { ...prev, [day]: { ...prev[day], ...patch } };
      onChange(JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-1.5">
      {DAYS.map((day) => {
        const entry = schedule[day];
        return (
          <div key={day} className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2 w-28 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={entry.open}
                onChange={(e) => updateDay(day, { open: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className={entry.open ? "text-slate-900" : "text-slate-400"}>{t(`day_${day}`)}</span>
            </label>
            {entry.open ? (
              <>
                <input
                  type="time"
                  value={entry.debut}
                  onChange={(e) => updateDay(day, { debut: e.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <span className="text-slate-400">–</span>
                <input
                  type="time"
                  value={entry.fin}
                  onChange={(e) => updateDay(day, { fin: e.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </>
            ) : (
              <span className="text-xs text-slate-400">{t("dayClosed")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
