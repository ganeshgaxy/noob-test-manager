import { createContext, useContext, useState, type ReactNode } from 'react'

export type ClipboardKind = 'test' | 'folder'
export type ClipboardMode = 'copy' | 'cut'

export interface ClipboardItem {
  kind: ClipboardKind
  mode: ClipboardMode
  ids: number[]
  sourceFolderId?: number
  sourceSpaceId?: number
  sourceParentFolderId?: number | null
}

interface ClipboardContextValue {
  clipboard: ClipboardItem | null
  copy: (item: Omit<ClipboardItem, 'mode'>) => void
  cut: (item: Omit<ClipboardItem, 'mode'>) => void
  clear: () => void
}

const ClipboardContext = createContext<ClipboardContextValue>({
  clipboard: null,
  copy: () => {},
  cut: () => {},
  clear: () => {},
})

export function ClipboardProvider({ children }: { children: ReactNode }) {
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null)

  const copy = (item: Omit<ClipboardItem, 'mode'>) => setClipboard({ ...item, mode: 'copy' })
  const cut = (item: Omit<ClipboardItem, 'mode'>) => setClipboard({ ...item, mode: 'cut' })
  const clear = () => setClipboard(null)

  return (
    <ClipboardContext.Provider value={{ clipboard, copy, cut, clear }}>
      {children}
    </ClipboardContext.Provider>
  )
}

export function useClipboard() {
  return useContext(ClipboardContext)
}
