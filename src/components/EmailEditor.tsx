import { useMemo, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link"],
  [{ color: [] }, { background: [] }],
  ["clean"],
];

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
  const quillRef = useRef<ReactQuill>(null);

  const modules = useMemo(
    () => ({
      toolbar: TOOLBAR,
      clipboard: { matchVisual: false },
    }),
    []
  );

  return (
    <div className="email-editor rounded-xl border border-mist bg-white [&_.ql-toolbar]:rounded-t-xl [&_.ql-toolbar]:border-mist [&_.ql-container]:rounded-b-xl [&_.ql-container]:border-mist [&_.ql-editor]:min-h-[var(--editor-min-h)]">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
        style={{ ["--editor-min-h" as string]: `${minHeight}px` }}
      />
    </div>
  );
}
