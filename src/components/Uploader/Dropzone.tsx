import { useRef, useState, useEffect, useCallback, type FC } from "react";
import clsx from "clsx";
import type { UploadData } from "@/types/uploads";

interface DropzoneProps {
  onUpload: (data: UploadData) => void;
  error?: string | null;
}

const Dropzone: FC<DropzoneProps> = ({ onUpload, error }) => {
  const [isActive, setIsActive] = useState(false);
  const [flash, setFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    (file: File, source: "drop" | "dialog") => {
      if (file.type === "application/pdf") onUpload({ source, file });
    },
    [onUpload]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const txt = e.clipboardData?.getData("text") ?? "";
      if (!txt) return;
      setFlash(true);
      setTimeout(() => setFlash(false), 300);

      try {
        const url = new URL(txt);
        onUpload({ source: "paste", url: url.href });
      } catch {
        onUpload({ source: "paste", text: txt });
      }
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsActive(false);
      const [file] = e.dataTransfer?.files ?? [];
      if (file) handleUpload(file, "drop");
    },
    [handleUpload]
  );

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    window.addEventListener("drop", handleDrop);
    window.addEventListener(
      "dragover",
      (e) => (e.preventDefault(), setIsActive(true))
    );
    window.addEventListener("dragleave", () => setIsActive(false));
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", () => {});
      window.removeEventListener("dragleave", () => {});
    };
  }, [handlePaste, handleDrop]);

  const classes = clsx(
    "cursor-pointer transition-all duration-300 ease-in-out border rounded-4xl",
    "w-[calc(100vmin-10rem)] aspect-square flex items-center justify-center",
    isActive || flash
      ? "scale-105 bg-accent/20 border-dashed border-2 border-brand"
      : "hover:scale-105 hover:border-dashed hover:border-2 hover:border-brand bg-neutral-dark/10 border-neutral-dark"
  );

  return (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      className={classes}
      aria-label="Upload privacy policy via drag, drop, paste, or file upload"
    >
      <div className="w-3/4 text-center space-y-4">
        <h1 className="font-hyper font-bold text-neutral-dark/75 text-4xl">
          Drop or Paste
        </h1>
        <h3 className="font-hyper text-neutral-dark">PDF • Text • URL</h3>
        {error && <p className="text-sm text-error">{error}</p>}
      </div>

      {/* hidden native file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const [file] = e.target.files ?? [];
          if (file) handleUpload(file, "dialog");
        }}
      />
    </button>
  );
};

export default Dropzone;
