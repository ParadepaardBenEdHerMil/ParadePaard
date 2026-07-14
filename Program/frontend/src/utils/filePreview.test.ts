import { describe, expect, it } from "vitest";
import { detectPreviewKind } from "./filePreview";

describe("detectPreviewKind", () => {
    it("detects PDF by mime or extension", () => {
        expect(detectPreviewKind("cv.pdf", null)).toBe("pdf");
        expect(detectPreviewKind(null, "application/pdf")).toBe("pdf");
        expect(detectPreviewKind("CV.PDF", "")).toBe("pdf");
    });

    it("detects docx by mime or extension", () => {
        expect(detectPreviewKind("cv.docx", null)).toBe("docx");
        expect(
            detectPreviewKind(null, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        ).toBe("docx");
    });

    it("treats legacy .doc and unknown types as unsupported", () => {
        expect(detectPreviewKind("cv.doc", "application/msword")).toBe("unsupported");
        expect(detectPreviewKind("cv.rtf", "application/rtf")).toBe("unsupported");
        expect(detectPreviewKind(null, null)).toBe("unsupported");
    });

    it("prefers mime over a mismatched extension", () => {
        expect(detectPreviewKind("cv.doc", "application/pdf")).toBe("pdf");
    });
});
