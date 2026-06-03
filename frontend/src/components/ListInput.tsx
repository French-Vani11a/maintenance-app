import { useState } from 'react'
import { Plus, X } from 'lucide-react'

export function parseListField(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {}
  return [value]
}

export function serializeListField(items: string[]): string | null {
  const filtered = items.filter((s) => s.trim())
  return filtered.length > 0 ? JSON.stringify(filtered) : null
}

export default function ListInput({
  items,
  onChange,
  placeholder = 'Add item…',
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const val = draft.trim()
    if (!val) return
    onChange([...items, val])
    setDraft('')
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
            >
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1 text-sm"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="btn-secondary btn-sm px-3"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
