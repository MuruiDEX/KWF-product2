// Компактная полоса KPI для Overview: одна строка ключевых чисел.
// Тон задаёт иерархию: обычное — нейтрально, warning — только при проблемах,
// readiness — усиленный operational state.

import { Stat } from "@/components/ui/Stat"

export interface KpiItem {
  label: string
  value: string
  tone?: "default" | "warn" | "strong"
  title?: string
}

export default function KpiStrip({ items, label = "Ключевые показатели" }: { items: KpiItem[]; label?: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Stat
          key={item.label}
          label={item.label}
          value={item.value}
          tone={item.tone}
          hint={item.title}
        />
      ))}
    </section>
  )
}
