import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { useTranslation } from 'react-i18next';

interface WysiwygEditorProps {
    value: string;
    onChange: (markdown: string) => void;
    placeholder?: string;
    minHeight?: number;
    borderColor?: string;
}

/** Convierte markdown básico (tablas, headings, párrafos, listas) a HTML.
 *  Necesario porque tiptap-markdown@0.9 no siempre parsea markdown en setContent. */
function markdownToHtml(md: string): string {
    if (!md) return '';
    const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (s: string) =>
        esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(?<!\*)\*([^\s*][^*]*?)\*(?!\*)/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Strip wrapping fenced code block: ```markdown ... ``` o ``` ... ```
    // (gpt-4o a veces envuelve toda la tabla en un fence).
    let src = md.trim();
    const fenceMatch = src.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/);
    if (fenceMatch) src = fenceMatch[1];

    // Split por celda en una fila markdown, respetando `\|` escapados.
    const splitRow = (row: string): string[] =>
        row.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());

    const lines = src.split(/\r?\n/);
    let html = '';
    let inTable = false;
    let headerDone = false;
    let inList = false;
    let listTag: 'ul' | 'ol' | null = null;

    const closeList = () => {
        if (inList && listTag) { html += `</${listTag}>`; inList = false; listTag = null; }
    };
    const closeTable = () => {
        if (inTable) { html += '</tbody></table>'; inTable = false; headerDone = false; }
    };

    for (const raw of lines) {
        const line = raw.trim();
        // Table row
        if (line.startsWith('|') && line.endsWith('|') && line.length > 1) {
            closeList();
            const cells = splitRow(line.slice(1, -1));
            if (cells.every(c => /^[-:]+$/.test(c))) {
                if (inTable && !headerDone) { html += '</thead><tbody>'; headerDone = true; }
                continue;
            }
            if (!inTable) { html += '<table><thead>'; inTable = true; headerDone = false; }
            const tag = headerDone ? 'td' : 'th';
            html += '<tr>' + cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
            continue;
        }
        closeTable();

        // Headings
        const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (hMatch) {
            closeList();
            const level = hMatch[1].length;
            html += `<h${level}>${inline(hMatch[2])}</h${level}>`;
            continue;
        }
        // Unordered list
        if (/^[-*+]\s+/.test(line)) {
            if (!inList || listTag !== 'ul') { closeList(); html += '<ul>'; inList = true; listTag = 'ul'; }
            html += `<li>${inline(line.replace(/^[-*+]\s+/, ''))}</li>`;
            continue;
        }
        // Ordered list
        if (/^\d+\.\s+/.test(line)) {
            if (!inList || listTag !== 'ol') { closeList(); html += '<ol>'; inList = true; listTag = 'ol'; }
            html += `<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`;
            continue;
        }
        closeList();

        // Paragraph / blank
        if (line === '') continue;
        html += `<p>${inline(line)}</p>`;
    }
    closeList();
    closeTable();
    return html;
}

/** Heurística: si el texto contiene una tabla markdown o headings/listas, lo tratamos como markdown. */
function looksLikeMarkdown(s: string): boolean {
    if (!s) return false;
    return (
        /^\s*\|.+\|\s*$/m.test(s) ||      // table row
        /^\s*#{1,6}\s+/m.test(s) ||       // heading
        /^\s*[-*+]\s+/m.test(s) ||        // bullet list
        /^\s*\d+\.\s+/m.test(s)           // ordered list
    );
}

export interface WysiwygEditorHandle {
    insertContent: (text: string) => void;
    replaceContent: (text: string) => void;
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

export const WysiwygEditor = forwardRef<WysiwygEditorHandle, WysiwygEditorProps>(function WysiwygEditor({ value, onChange, placeholder, minHeight = 280, borderColor = '#e2e8f0' }, ref) {
    const { t } = useTranslation('common');
    const isInternalChange = useRef(false);
    const resolvedPlaceholder = placeholder ?? t('editor.placeholder_default');

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: resolvedPlaceholder }),
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

    const setContentMarkdownAware = (text: string) => {
        if (!editor) return;
        const isMd = looksLikeMarkdown(text);
        const content = isMd ? markdownToHtml(text) : text;
        if (isMd) {
            const rows = (text.match(/^\s*\|.+\|\s*$/mg) || []).length;
            const tableRowsHtml = (content.match(/<tr>/g) || []).length;
            // eslint-disable-next-line no-console
            console.log('[WysiwygEditor] markdown detected | input rows:', rows, '| html <tr>:', tableRowsHtml, '| input chars:', text.length);
        }
        editor.commands.setContent(content);
    };

    useImperativeHandle(ref, () => ({
        insertContent: (text: string) => {
            if (!editor) return;
            const current = (editor.storage as any).markdown.getMarkdown();
            const newContent = current.trim() ? current + '\n\n' + text : text;
            isInternalChange.current = false;
            setContentMarkdownAware(newContent);
        },
        replaceContent: (text: string) => {
            if (!editor) return;
            isInternalChange.current = false;
            setContentMarkdownAware(text);
        }
    }), [editor]);

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
            setContentMarkdownAware(value);
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
                <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} title={t('editor.toolbar.bold')} active={editor.isActive('bold')}><strong>B</strong></ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} title={t('editor.toolbar.italic')} active={editor.isActive('italic')}><em>I</em></ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} title={t('editor.toolbar.strike')} active={editor.isActive('strike')}><s>S</s></ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title={t('editor.toolbar.h1')} active={editor.isActive('heading', { level: 1 })}>H1</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={t('editor.toolbar.h2')} active={editor.isActive('heading', { level: 2 })}>H2</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title={t('editor.toolbar.h3')} active={editor.isActive('heading', { level: 3 })}>H3</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} title={t('editor.toolbar.bullet_list')} active={editor.isActive('bulletList')}>≡ {t('editor.toolbar.list_label')}</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t('editor.toolbar.ordered_list')} active={editor.isActive('orderedList')}>{t('editor.toolbar.ordered_list_label')}</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t('editor.toolbar.blockquote')} active={editor.isActive('blockquote')}>❝</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} title={t('editor.toolbar.code')} active={editor.isActive('code')}>&lt;/&gt;</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title={t('editor.toolbar.undo')}>↩</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title={t('editor.toolbar.redo')}>↪</ToolbarButton>
                <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
                <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t('editor.toolbar.insert_table')}>⊞ {t('editor.toolbar.table_label')}</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title={t('editor.toolbar.add_column')}>{t('editor.toolbar.col_label')}</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title={t('editor.toolbar.add_row')}>{t('editor.toolbar.row_label')}</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title={t('editor.toolbar.delete_table')}>{t('editor.toolbar.delete_table_label')}</ToolbarButton>
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
});
