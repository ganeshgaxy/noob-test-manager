import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useEffect, useRef } from 'react'
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  ListBullets,
  ListNumbers,
  CheckSquare,
  Code,
  Quotes,
  ArrowCounterClockwise,
  ArrowClockwise,
  Minus,
} from '@phosphor-icons/react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RichEditorProps {
  value: string // HTML string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  autoFocus?: boolean
  disabled?: boolean
}

// ─── Toolbar ───────────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault() // keep editor focus
        onClick()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 5,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--t-bg-elevated)' : 'transparent',
        color: active ? 'var(--t-text-primary)' : 'var(--t-text-muted)',
        transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--t-bg-surface)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 16,
        background: 'var(--t-border-subtle)',
        flexShrink: 0,
        margin: '0 2px',
      }}
    />
  )
}

// ─── RichEditor ────────────────────────────────────────────────────────────────

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  autoFocus = false,
  disabled = false,
}: RichEditorProps) {
  // Track whether the next onChange comes from external value sync vs user input
  const internalChange = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate({ editor }) {
      internalChange.current = true
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
    },
    autofocus: autoFocus ? 'end' : false,
  })

  // Sync external value changes (e.g. loading a test) without clobbering cursor
  useEffect(() => {
    if (!editor) return
    if (internalChange.current) {
      internalChange.current = false
      return
    }
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  // Toggle editable when disabled changes
  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  if (!editor) return null

  return (
    <div
      style={{
        border: '1px solid var(--t-border-subtle)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--t-bg-base)',
        transition: 'border-color 0.1s',
      }}
      onFocusCapture={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
      }}
      onBlurCapture={(e) => {
        // only reset if focus left the whole container
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-subtle)'
        }
      }}
    >
      {/* Toolbar */}
      {!disabled && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '5px 8px',
            borderBottom: '1px solid var(--t-border-subtle)',
            flexWrap: 'wrap',
            background: 'var(--t-bg-panel)',
          }}
        >
          <ToolbarBtn
            title="Bold (⌘B)"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <TextB size={13} weight="bold" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Italic (⌘I)"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <TextItalic size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Underline (⌘U)"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <TextUnderline size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Strikethrough"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <TextStrikethrough size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Inline code"
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code size={13} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            title="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <ListBullets size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Numbered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListNumbers size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Task list"
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <CheckSquare size={13} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            title="Blockquote"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quotes size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Horizontal rule"
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus size={13} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            title="Undo (⌘Z)"
            active={false}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <ArrowCounterClockwise size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Redo (⌘⇧Z)"
            active={false}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <ArrowClockwise size={13} />
          </ToolbarBtn>
        </div>
      )}

      {/* Editor area */}
      <div style={{ minHeight, padding: '10px 12px' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Styles scoped to this component */}
      <style>{`
        .tiptap {
          outline: none;
          font-size: 13px;
          line-height: 1.7;
          color: var(--t-text-primary);
          font-family: inherit;
        }
        .tiptap p { margin: 0 0 6px; }
        .tiptap p:last-child { margin-bottom: 0; }
        .tiptap h1 { font-size: 18px; font-weight: 700; margin: 10px 0 6px; }
        .tiptap h2 { font-size: 15px; font-weight: 600; margin: 8px 0 4px; }
        .tiptap h3 { font-size: 13px; font-weight: 600; margin: 6px 0 4px; }
        .tiptap ul, .tiptap ol { padding-left: 22px; margin: 4px 0; }
        .tiptap li { margin: 2px 0; }
        .tiptap ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
        .tiptap ul[data-type="taskList"] li {
          display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;
        }
        .tiptap ul[data-type="taskList"] li label { margin-top: 2px; }
        .tiptap ul[data-type="taskList"] li > div { flex: 1; }
        .tiptap code {
          font-family: 'Menlo', 'Monaco', monospace;
          font-size: 12px;
          background: var(--t-bg-surface);
          border: 1px solid var(--t-border-subtle);
          border-radius: 4px;
          padding: 1px 5px;
        }
        .tiptap pre {
          background: var(--t-bg-surface);
          border: 1px solid var(--t-border-subtle);
          border-radius: 6px;
          padding: 12px 14px;
          overflow-x: auto;
          margin: 6px 0;
        }
        .tiptap pre code {
          background: none; border: none; padding: 0; font-size: 12px;
        }
        .tiptap blockquote {
          border-left: 3px solid var(--t-border-default);
          margin: 6px 0;
          padding-left: 14px;
          color: var(--t-text-secondary);
        }
        .tiptap hr {
          border: none;
          border-top: 1px solid var(--t-border-subtle);
          margin: 10px 0;
        }
        .tiptap strong { font-weight: 600; }
        .tiptap em { font-style: italic; }
        .tiptap u { text-decoration: underline; }
        .tiptap s { text-decoration: line-through; }
        .tiptap p.is-editor-empty:first-child::before {
          color: var(--t-text-muted);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
