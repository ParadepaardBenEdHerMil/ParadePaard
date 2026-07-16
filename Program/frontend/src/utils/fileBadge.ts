export type FileBadge = { label: string; kind: string };

/**
 * Small type badge for an attachment chip: a colour "kind" plus a short label derived from the
 * file extension. `kind` maps to the `--pdf` / `--doc` / `--xls` / `--img` / `--generic` icon
 * colour classes used by the preset compose chips and the send-preview chips.
 */
export function fileBadge(fileName: string): FileBadge {
    const ext = (fileName.split(".").pop() ?? "").toLowerCase();
    if (ext === "pdf") return { label: "PDF", kind: "pdf" };
    if (ext === "doc" || ext === "docx") return { label: "DOC", kind: "doc" };
    if (ext === "xls" || ext === "xlsx" || ext === "csv") return { label: "XLS", kind: "xls" };
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) {
        return { label: ext.toUpperCase().slice(0, 4), kind: "img" };
    }
    return { label: (ext || "file").toUpperCase().slice(0, 4), kind: "generic" };
}
