import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';

interface WysiwygEditorProps {
    value: string;
    onChange: (markdown: string) => void;
    placeholder?: string;
    minHeight?: number;
    borderColor?: string;
}

const ToolbarButton = ({
    onClick, title, children, active
}: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        style={{
            padding: '3px 7px',
            fontSize: '0.8rem',
            borderRadius: 4,
            border: '1px solid #e2e8f0',
            background: active ? '#e0e7ff' : '#f8fafc',
            color: active ? '#3730a3' : '#475569',
            cursor: 'pointer',
            fontWeight: active ? 700 : 400,
            lineHeight: 1.4
        }}
    >
        {children}
    </button>
);

export function WysiwygEditor({ value, onChange, placeholder = 'Escribe aquí...', minHeight = 280, borderColor = '#e2e8f0' }: WysiwygEditorProps) {
    const isInternalChange = useRef(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder }),
            Markdown.configure({ transformPastedText: true, transformCopiedText: false }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value,
        onUpdate: ({ editor }) => {
            isInternalChange.current = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const md = (editor.storage as any).markdown.getMarkdown();
            onChange(md);
        }
    });

    // Sync external value changes (e.g. GPT response arriving)
    useEffect(() => {
        if (!editor) return;
        if (isInternalChange.current) {
            isInternalChange.current = false;
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const current = (editor.storage as any).markdown.getMarkdown();
        if (current !== value) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    if (!editor) return null;

    return (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px',
                borderBottom: `1px solid ${borderColor}`, background: '#f8fafc'
            }}>
                <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita (Ctrl+B)" active={editor.isActive('bold')}><strong>B</strong></ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva (Ctrl+I)" active={editor.isActive('italic')}><em>I</em></ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado" active={editor.isActive('strike')}><s>S</s></ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1" active={editor.isActive('heading', { level: 1 })}>H1</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2" active={editor.isActive('heading', { level: 2 })}>H2</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3" active={editor.isActive('heading', { level: 3 })}>H3</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista" active={editor.isActive('bulletList')}>≡ Lista</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada" active={editor.isActive('orderedList')}>1. Lista</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita" active={editor.isActive('blockquote')}>❝</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} title="Código" active={editor.isActive('code')}>&lt;/&gt;</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer">↩</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer">↪</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insertar tabla">⊞ Tabla</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Añadir columna">+Col</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Añadir fila">+Fila</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Eliminar tabla">✕ Tabla</ToolbarButton>
            </div>

            {/* Editor area */}
            <EditorContent
                editor={editor}
                style={{ minHeight, padding: '12px 16px', fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.7 }}
            />

            <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          float: left;
          height: 0;
          font-style: italic;
        }
        .tiptap:focus { outline: none; }
        .tiptap h1 { font-size: 1.6rem; font-weight: 700; margin: 0.8rem 0 0.4rem; }
        .tiptap h2 { font-size: 1.3rem; font-weight: 600; margin: 0.8rem 0 0.4rem; }
        .tiptap h3 { font-size: 1.1rem; font-weight: 600; margin: 0.6rem 0 0.3rem; }
        .tiptap ul, .tiptap ol { padding-left: 1.5rem; margin: 0.4rem 0; }
        .tiptap li { margin: 0.2rem 0; }
        .tiptap blockquote { border-left: 3px solid #c4b5fd; padding-left: 1rem; color: #64748b; margin: 0.5rem 0; }
        .tiptap code { background: #f1f5f9; padding: 2px 5px; border-radius: 3px; font-family: monospace; font-size: 0.88em; }
        .tiptap pre { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; }
        .tiptap table { width: 100%; border-collapse: collapse; margin: 0.8rem 0; }
        .tiptap th { background: #f1f5f9; font-weight: 600; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; }
        .tiptap td { padding: 8px 12px; border: 1px solid #cbd5e1; }
        .tiptap tr:nth-child(even) td { background: #f8fafc; }
        .tiptap strong { font-weight: 700; }
      `}</style>
        </div>
    );
}
