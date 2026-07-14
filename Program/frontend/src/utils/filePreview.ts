// Decides how an uploaded file (e.g. an applicant CV) can be previewed in the browser:
//   - "pdf"  → rendered natively in an <iframe> (no library),
//   - "docx" → rendered client-side with docx-preview (OOXML only),
//   - "unsupported" → no in-browser preview (legacy .doc, images-as-doc, unknown);
//     the caller should offer a download instead.
// Both the filename extension and the MIME type are consulted because uploads carry one,
// the other, or a mismatched pair depending on the browser/OS that produced them.

export type FilePreviewKind = "pdf" | "docx" | "unsupported";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function detectPreviewKind(fileName?: string | null, contentType?: string | null): FilePreviewKind {
    const name = (fileName ?? "").trim().toLowerCase();
    const type = (contentType ?? "").trim().toLowerCase();

    if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
    // OOXML .docx only — the legacy binary .doc format has no reliable in-browser renderer.
    if (type === DOCX_MIME || type.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
    return "unsupported";
}
