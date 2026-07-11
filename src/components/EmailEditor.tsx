import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

/**
 * WYSIWYG email body editor built directly on Quill 2 (no react-quill —
 * that wrapper is unmaintained, ships a second copy of Quill 1, and relies
 * on React's removed findDOMNode). Emits clean, email-friendly semantic HTML.
 */

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "link"],
  [{ align: [] }],
  [{ color: [] }, { background: [] }],
  ["clean"],
];

const EMPTY = "<p></p>";

export default function EmailEditor({
  value,
  onChange,
  placeholder = "Write your email…",
  minHeight = 220,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  const lastHtmlRef = useRef("");
  onChangeRef.current = onChange;

  // create the editor once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const editorEl = document.createElement("div");
    host.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: "snow",
      placeholder,
      modules: { toolbar: TOOLBAR, clipboard: { matchVisual: false } },
    });
    quillRef.current = quill;

    if (value && value !== EMPTY) {
      quill.clipboard.dangerouslyPasteHTML(value);
    }
    lastHtmlRef.current = readHtml(quill);

    quill.on("text-change", () => {
      const html = readHtml(quill);
      lastHtmlRef.current = html;
      onChangeRef.current(html);
    });

    return () => {
      quillRef.current = null;
      host.innerHTML = "";
    };
    // init once; value is synced by the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push external value changes (e.g. loading a saved draft) into the editor,
  // without clobbering what the user is actively typing
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    if (value === lastHtmlRef.current) return;
    const sel = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(value || "");
    lastHtmlRef.current = readHtml(quill);
    if (sel) {
      const len = quill.getLength();
      quill.setSelection(Math.min(sel.index, len - 1), 0);
    }
  }, [value]);

  return (
    <div
      className="email-editor rounded-xl border border-mist bg-white [&_.ql-container]:rounded-b-xl [&_.ql-container]:border-mist [&_.ql-editor]:min-h-[var(--editor-min-h)] [&_.ql-editor]:text-base [&_.ql-toolbar]:rounded-t-xl [&_.ql-toolbar]:border-mist"
      style={{ ["--editor-min-h" as string]: `${minHeight}px` }}
    >
      <div ref={hostRef} />
    </div>
  );
}

/** Quill's empty state is <p><br></p>; normalise it so "is empty" checks work. */
function readHtml(quill: Quill): string {
  if (quill.getText().trim().length === 0 && quill.getLength() <= 1) return EMPTY;
  return quill.getSemanticHTML();
}
