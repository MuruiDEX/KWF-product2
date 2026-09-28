"use client"

import { SettingsPanel } from "./SettingsPanel"
import type { Tournament } from "@/lib/types"

interface SettingsSectionProps {
  tournament: Tournament
  onPublishToggle: () => void
  onFinish: () => void
  onDelete: () => void
  onSaveMatsCount: (n: number) => Promise<void>
  onOpenTemplate: () => void
}

/** Настройки: тонкая обёртка — группы и поведение в SettingsPanel. */
export function SettingsSection(props: SettingsSectionProps) {
  return <SettingsPanel {...props} />
}
