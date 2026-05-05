import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useState, useEffect } from 'react';
import { 
  Eraser, 
  ListBullets, 
  ListNumbers, 
  TextBolder, 
  TextItalic, 
  TextUnderline,
  IconContext
} from 'phosphor-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
}

export const RichTextEditor = ({ 
  content, 
  onChange, 
  disabled, 
  minHeight = '200px' 
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      Link.configure({ openOnClick: false }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !disabled,
  });

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick(prev => prev + 1);
    editor.on('transaction', handler);
    return () => {
      editor.off('transaction', handler);
    };
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="rich-text-editor-wrapper">
      <IconContext.Provider value={{ size: 20, weight: "regular", color: "currentColor" }}>
        <div className="rich-text-toolbar">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rich-tool-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
            title="Negrito"
          >
            <TextBolder weight={editor.isActive('bold') ? "bold" : "regular"} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rich-tool-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
            title="Itálico"
          >
            <TextItalic weight={editor.isActive('italic') ? "bold" : "regular"} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`rich-tool-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
            title="Sublinhado"
          >
            <TextUnderline weight={editor.isActive('underline') ? "bold" : "regular"} />
          </button>

          <div className="toolbar-divider" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`rich-tool-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
            title="Lista"
          >
            <ListBullets weight={editor.isActive('bulletList') ? "bold" : "regular"} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`rich-tool-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            title="Lista Numerada"
          >
            <ListNumbers weight={editor.isActive('orderedList') ? "bold" : "regular"} />
          </button>

          <div className="toolbar-divider" />

          <button
            type="button"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="rich-tool-btn"
            title="Limpar Formatação"
          >
            <Eraser />
          </button>
        </div>
      </IconContext.Provider>

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
          gap: 0.25rem;
          padding: 0.6rem;
          background: var(--surface-1);
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
          min-height: 48px;
        }
        .toolbar-divider {
          width: 1px;
          height: 20px;
          background: var(--border-color);
          margin: 0 0.5rem;
        }
        .rich-tool-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-color);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rich-tool-btn:hover {
          background: var(--surface-2);
          border-color: var(--border-color);
        }
        .rich-tool-btn.is-active {
          background: var(--primary-color);
          color: white;
        }
        .rich-tool-btn svg {
          display: block;
          flex-shrink: 0;
        }
        .rich-text-content {
          padding: 1rem;
          color: var(--text-color);
          outline: none;
        }
        .rich-text-content .ProseMirror {
          min-height: inherit;
          outline: none;
        }
        .rich-text-content .ProseMirror p {
          margin-bottom: 0.75rem;
        }
        .rich-text-content ul {
          padding-left: 1.5rem;
          margin: 1rem 0;
          list-style-type: disc;
        }
        .rich-text-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
          list-style-type: decimal;
        }
        .rich-text-content li {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
};
