import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { type ReactNode, useEffect, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  toolbarMode?: 'full' | 'list';
}

type ToolbarButtonProps = {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

const ToolbarButton = ({ title, active, disabled, onClick, children }: ToolbarButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`rich-tool-btn ${active ? 'is-active' : ''}`}
    title={title}
    aria-label={title}
    disabled={disabled}
  >
    {children}
  </button>
);

function getInitialContent(content: string) {
  return content?.trim() ? content : '<p></p>';
}

export const RichTextEditor = ({
  content,
  onChange,
  disabled,
  placeholder = 'Digite o conteúdo...',
  minHeight = '200px',
  toolbarMode = 'full',
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: getInitialContent(content),
    editorProps: {
      attributes: {
        'aria-label': 'Editor de texto formatado',
        'data-placeholder': placeholder,
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !disabled,
  });

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick((prev) => prev + 1);
    editor.on('transaction', handler);
    return () => {
      editor.off('transaction', handler);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(getInitialContent(content));
    }
  }, [content, editor]);

  if (!editor) return null;

  const isDisabled = !!disabled;

  return (
    <div className="rich-text-editor-wrapper">
      <div className="rich-text-toolbar" aria-label="Ferramentas de formatação">
        {toolbarMode === 'full' && (
          <>
            <div className="toolbar-group toolbar-group-block" aria-label="Estilos de bloco">
              <ToolbarButton title="Parágrafo" active={editor.isActive('paragraph')} disabled={isDisabled} onClick={() => editor.chain().focus().setParagraph().run()}>
                <Pilcrow size={18} />
              </ToolbarButton>
              <ToolbarButton title="Título 1" active={editor.isActive('heading', { level: 1 })} disabled={isDisabled} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 size={18} />
              </ToolbarButton>
              <ToolbarButton title="Título 2" active={editor.isActive('heading', { level: 2 })} disabled={isDisabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 size={18} />
              </ToolbarButton>
              <ToolbarButton title="Título 3" active={editor.isActive('heading', { level: 3 })} disabled={isDisabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                <Heading3 size={18} />
              </ToolbarButton>
            </div>

            <div className="toolbar-group toolbar-group-text" aria-label="Estilos de texto">
              <ToolbarButton title="Negrito" active={editor.isActive('bold')} disabled={isDisabled} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold size={18} />
              </ToolbarButton>
              <ToolbarButton title="Itálico" active={editor.isActive('italic')} disabled={isDisabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic size={18} />
              </ToolbarButton>
              <ToolbarButton title="Sublinhado" active={editor.isActive('underline')} disabled={isDisabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <Underline size={18} />
              </ToolbarButton>
            </div>

            <div className="toolbar-group toolbar-group-align" aria-label="Alinhamento">
              <ToolbarButton title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} disabled={isDisabled} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                <AlignLeft size={18} />
              </ToolbarButton>
              <ToolbarButton title="Centralizar" active={editor.isActive({ textAlign: 'center' })} disabled={isDisabled} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                <AlignCenter size={18} />
              </ToolbarButton>
              <ToolbarButton title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} disabled={isDisabled} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                <AlignRight size={18} />
              </ToolbarButton>
              <ToolbarButton title="Justificar" active={editor.isActive({ textAlign: 'justify' })} disabled={isDisabled} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
                <AlignJustify size={18} />
              </ToolbarButton>
            </div>
          </>
        )}

        <div className="toolbar-group toolbar-group-lists" aria-label="Listas">
          <ToolbarButton
            title="Lista com marcadores"
            active={editor.isActive('bulletList')}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={18} />
          </ToolbarButton>
          <ToolbarButton
            title="Lista numerada"
            active={editor.isActive('orderedList')}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={18} />
          </ToolbarButton>
        </div>

        {toolbarMode === 'full' && (
          <>
            <div className="toolbar-group toolbar-group-history" aria-label="Histórico e limpeza">
              <ToolbarButton title="Desfazer" disabled={isDisabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
                <Undo2 size={18} />
              </ToolbarButton>
              <ToolbarButton title="Refazer" disabled={isDisabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
                <Redo2 size={18} />
              </ToolbarButton>
              <ToolbarButton title="Limpar formatação" disabled={isDisabled} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
                <Eraser size={18} />
              </ToolbarButton>
            </div>
          </>
        )}

      </div>

      <EditorContent editor={editor} className="rich-text-content" style={{ minHeight }} />

      <style>{`
        .rich-text-editor-wrapper {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg-color);
          box-shadow: var(--shadow-sm);
        }

        .rich-text-toolbar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem;
          background: var(--surface-1);
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
          min-height: 52px;
        }

        .toolbar-group {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding-right: 0.5rem;
          border-right: 1px solid var(--border-color);
        }

        .toolbar-group:last-child {
          border-right: 0;
          padding-right: 0;
        }

        .rich-tool-btn {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-color);
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        .rich-tool-btn:hover:not(:disabled) {
          background: var(--surface-2);
          border-color: var(--border-color);
        }

        .rich-tool-btn.is-active {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: white;
        }

        .rich-tool-btn:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .rich-tool-btn svg {
          display: block;
          flex-shrink: 0;
        }

        .rich-text-content {
          padding: 1rem;
          color: var(--text-color);
          outline: none;
          background: var(--bg-color);
        }

        .rich-text-content .ProseMirror {
          min-height: inherit;
          outline: none;
        }

        .rich-text-content .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--muted-color);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .rich-text-content .ProseMirror p {
          margin: 0 0 0.75rem;
          line-height: 1.65;
        }

        .rich-text-content h1,
        .rich-text-content h2,
        .rich-text-content h3 {
          color: var(--text-color);
          line-height: 1.2;
          margin: 1rem 0 0.65rem;
        }

        .rich-text-content h1 {
          font-size: 1.65rem;
          font-weight: 800;
        }

        .rich-text-content h2 {
          font-size: 1.35rem;
          font-weight: 800;
        }

        .rich-text-content h3 {
          font-size: 1.1rem;
          font-weight: 700;
        }

        .rich-text-content ul,
        .rich-text-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }

        .rich-text-content ul {
          list-style-type: disc;
        }

        .rich-text-content ol {
          list-style-type: decimal;
        }

        .rich-text-content li {
          margin-bottom: 0.5rem;
          line-height: 1.55;
        }

        .rich-text-content a {
          color: var(--primary-color);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 640px) {
          .rich-text-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: nowrap;
            gap: 0.2rem;
            min-height: auto;
            padding: 0.45rem;
          }

          .toolbar-group {
            width: auto;
            justify-content: center;
            border-right: 0;
            border-bottom: 0;
            padding: 0;
            border-radius: 10px;
            background: transparent;
          }

          .toolbar-group:last-child {
            padding-right: 0;
          }

          .toolbar-group-block {
            display: none;
          }

          .toolbar-group-text {
            display: inline-flex;
          }

          .toolbar-group-lists {
            display: inline-flex;
          }

          .toolbar-group-align {
            display: none;
          }

          .toolbar-group-history {
            display: inline-flex;
          }

          .rich-tool-btn {
            width: 29px;
            height: 32px;
          }
        }
      `}</style>
    </div>
  );
};
