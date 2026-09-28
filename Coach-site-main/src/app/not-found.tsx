import Link from "next/link"
import { Trophy } from "lucide-react"
import EmptyState from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border">
        <EmptyState
          icon={<Trophy size={26} />}
          title="Страница не найдена"
          hint="Похоже, такой страницы нет или она была перемещена"
          action={
            <Link href="/">
              <Button>На главную</Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
