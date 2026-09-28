import Link from "next/link"
import { Fragment } from "react"

export interface Crumb {
  label: string
  href?: string
}

/** Хлебные крошки — только глубокие страницы (новость, турнир, админка, кабинет).
 * Последний пункт — текущая страница (aria-current). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Хлебные крошки">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((crumb, i) => {
          const last = i === items.length - 1
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && (
                <li aria-hidden="true" className="text-secondary-text/50 select-none">
                  /
                </li>
              )}
              <li className="min-w-0">
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="font-semibold text-secondary-text hover:text-primary-blue transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={last ? "font-bold text-dark-text truncate block max-w-[40vw] sm:max-w-none" : "text-secondary-text"}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
