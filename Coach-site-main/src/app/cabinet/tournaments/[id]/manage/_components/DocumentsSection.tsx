"use client"

import { DocumentsPanel, type DocumentPrefill } from "./DocumentsPanel"
import type { Tournament, TournamentCategory } from "@/lib/types"

export type { DocumentPrefill }

interface DocumentsSectionProps {
  tournament: Tournament
  categories: TournamentCategory[]
  prefill: DocumentPrefill | null
  onPrefillConsumed: () => void
}

/** Документы: тонкая обёртка — генератор и flows в DocumentsPanel. */
export function DocumentsSection(props: DocumentsSectionProps) {
  return <DocumentsPanel {...props} />
}
