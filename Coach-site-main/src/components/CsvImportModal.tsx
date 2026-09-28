// Phase 5: обратная совместимость — старый CSV-путь теперь ImportWizard
// (тот же контракт пропсов; CSV dry-run/commit на backend не менялся).

"use client"

import { ImportWizard, type ImportWizardProps } from "@/components/ImportWizard"

export type CsvImportModalProps = ImportWizardProps

/** @deprecated Используйте ImportWizard. Оставлен для существующих импортов. */
export function CsvImportModal(props: CsvImportModalProps) {
  return <ImportWizard {...props} />
}
