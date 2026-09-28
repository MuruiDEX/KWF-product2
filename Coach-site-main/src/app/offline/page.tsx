import Link from "next/link"
import { WifiOff } from "lucide-react"

/** F3: статическая офлайн-страница (пререндер, без API-запросов). */
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-light-gray px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-border p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-dark-blue">
          <WifiOff size={22} className="text-gold" />
        </div>
        <h1 className="text-2xl font-extrabold text-dark-text">
          Нет соединения
        </h1>
        <p className="text-sm text-secondary-text mt-2 mb-6">
          Проверьте интернет и попробуйте снова. Табло и кабинет обновятся
          автоматически, когда сеть вернётся.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-dark-blue text-white text-sm font-bold hover:bg-primary-blue transition-colors"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}
