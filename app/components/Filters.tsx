'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

export default function Filters({ countries }: { countries: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          From
        </label>
        <input
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(e) => update('from', e.target.value)}
          className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          To
        </label>
        <input
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(e) => update('to', e.target.value)}
          className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Country
        </label>
        <select
          defaultValue={searchParams.get('country') ?? ''}
          onChange={(e) => update('country', e.target.value)}
          className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-400 min-w-[160px]"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
