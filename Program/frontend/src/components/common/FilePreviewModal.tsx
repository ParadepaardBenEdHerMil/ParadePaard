import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { detectPreviewKind } from "../../utils/filePreview";
import "../../stylesheets/FilePreview.css";

type FilePreviewModalProps = {
    open: boolean;
    onClose: () => void;
    fileName?: string | null;
    contentType?: string | null;
    /** Fetches the file bytes. Memoize it in the caller so the preview loads once. */
    load: () => Promise<Blob>;
    /** Optional download action for the same file. */
    onDownload?: () => void;
    downloading?: boolean;
};

// Previews an uploaded file inline: PDFs render natively in an <iframe>, .docx is rendered
// with docx-preview (loaded on demand so it stays out of the main bundle). Anything else
// (legacy .doc, unknown types) shows a short note and relies on the download action.
export default function FilePreviewModal({
    open,
    onClose,
    fileName,
    contentType,
    load,
    onDownload,
    downloading = false,
}: FilePreviewModalProps) {
    const kind = detectPreviewKind(fileName, contentType);
    const docxContainerRef = useRef<HTMLDivElement | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return undefined;

        let cancelled = false;
        let objectUrl: string | null = null;
        const container = docxContainerRef.current;

        setError(null);
        setPdfUrl(null);
        if (container) container.innerHTML = "";

        if (kind === "unsupported") {
            return undefined;
        }

        const run = async () => {
            try {
                setLoading(true);
                const blob = await load();
                if (cancelled) return;

                if (kind === "pdf") {
                    objectUrl = URL.createObjectURL(blob);
                    setPdfUrl(objectUrl);
                } else if (kind === "docx" && container) {
                    // Dynamic import keeps docx-preview (and its jszip dependency) in a
                    // separate chunk that only loads when a .docx is actually previewed.
                    const { renderAsync } = await import("docx-preview");
                    if (cancelled) return;
                    container.innerHTML = "";
                    await renderAsync(blob, container, undefined, {
                        inWrapper: true,
                        breakPages: true,
                        useBase64URL: true,
                        className: "docxPreview",
                    });
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load preview.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void run();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (container) container.innerHTML = "";
        };
    }, [open, kind, load]);

    const footer = (
        <div className="filePreviewActions">
            {onDownload ? (
                <button type="button" className="button buttonSecondary" onClick={onDownload} disabled={downloading}>
                    {downloading ? "Preparing…" : "Download"}
                </button>
            ) : null}
            <button type="button" className="button buttonSecondary" onClick={onClose}>
                Close
            </button>
        </div>
    );

    return (
        <Modal
            open={open}
            title={fileName || "File preview"}
            onClose={onClose}
            footer={footer}
            height="92dvh"
            maxHeight="92dvh"
        >
            <div className="filePreviewBody">
                {loading ? <div className="filePreviewState">Loading preview…</div> : null}
                {error ? <div className="filePreviewState filePreviewError">{error}</div> : null}
                {!loading && !error && kind === "unsupported" ? (
                    <div className="filePreviewState">
                        In-browser preview isn’t available for this file type. Use Download to open it.
                    </div>
                ) : null}
                {kind === "pdf" && pdfUrl ? (
                    <iframe className="filePreviewFrame" title={`Preview of ${fileName ?? "file"}`} src={pdfUrl} />
                ) : null}
                {/* Always mounted for docx so the ref exists when the effect renders into it. */}
                {kind === "docx" ? <div ref={docxContainerRef} className="filePreviewDocx" /> : null}
            </div>
        </Modal>
    );
}
