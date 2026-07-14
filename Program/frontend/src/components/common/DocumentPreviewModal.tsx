import { useMemo, useRef } from "react";
import Modal from "./Modal";
import { documentToHtml, type DocumentModel } from "../../utils/documentPreview";
import "../../stylesheets/DocumentPreview.css";

type DocumentPreviewModalProps = {
    open: boolean;
    onClose: () => void;
    /** The document to render, or null while data is still loading. */
    document: DocumentModel | null;
    /** File name without extension, e.g. "application-jane-doe". */
    fileBaseName: string;
};

// A reusable preview dialog: it renders the document inside an isolated <iframe> so the
// on-screen preview is byte-identical to what prints and to what downloads as Word. The
// iframe isolation also means window.print() prints only the document, not the whole app.
export default function DocumentPreviewModal({
    open,
    onClose,
    document: model,
    fileBaseName,
}: DocumentPreviewModalProps) {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const html = useMemo(() => (model ? documentToHtml(model) : ""), [model]);

    const handlePrint = () => {
        const frameWindow = frameRef.current?.contentWindow;
        if (!frameWindow) return;
        // Focus first so the print dialog attaches to the iframe document (required by
        // some browsers) and only the document — not the surrounding app — is printed.
        frameWindow.focus();
        frameWindow.print();
    };

    const handleDownloadWord = () => {
        if (!html) return;
        // Word imports HTML natively; a leading BOM keeps accents/€ intact. The .doc
        // extension opens cleanly (a .docx extension on HTML bytes warns in Word).
        const blob = new Blob(["﻿", html], { type: "application/msword" });
        const url = URL.createObjectURL(blob);
        try {
            const anchor = window.document.createElement("a");
            anchor.href = url;
            anchor.download = `${fileBaseName}.doc`;
            anchor.rel = "noopener";
            window.document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        } finally {
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    };

    const footer = (
        <div className="docPreviewActions">
            <button type="button" className="button buttonSecondary" onClick={handleDownloadWord} disabled={!model}>
                Download Word
            </button>
            <button type="button" className="button" onClick={handlePrint} disabled={!model}>
                Save as PDF
            </button>
            <button type="button" className="button buttonSecondary docPreviewClose" onClick={onClose}>
                Close
            </button>
        </div>
    );

    return (
        <Modal
            open={open}
            title="Document preview"
            onClose={onClose}
            footer={footer}
            height="92dvh"
            maxHeight="92dvh"
        >
            {model ? (
                <iframe ref={frameRef} className="docPreviewFrame" title="Document preview" srcDoc={html} />
            ) : (
                <div className="docPreviewEmpty">Preparing document…</div>
            )}
        </Modal>
    );
}
