"use client"

import { CommunicationPanel } from "./CommunicationPanel"

interface CommunicationSectionProps {
  tournamentId: string | number
}

/** Связь: тонкая обёртка — компоновщик и история в CommunicationPanel. */
export function CommunicationSection(props: CommunicationSectionProps) {
  return <CommunicationPanel {...props} />
}
