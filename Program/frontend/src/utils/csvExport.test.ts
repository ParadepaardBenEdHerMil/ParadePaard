import { describe, expect, it } from "vitest";
import { toCsv, documentModelToCsv } from "./csvExport";
import type { DocumentModel } from "./documentPreview";

describe("toCsv", () => {
    it("joins plain rows with commas and CRLF", () => {
        expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
    });

    it("quotes fields containing a comma", () => {
        expect(toCsv([["Doe, Jane", "x"]])).toBe('"Doe, Jane",x');
    });

    it("doubles and wraps embedded quotes", () => {
        expect(toCsv([['say "hi"']])).toBe('"say ""hi"""');
    });

    it("quotes fields containing newlines", () => {
        expect(toCsv([["line1\nline2"]])).toBe('"line1\nline2"');
    });

    it("treats null/undefined cells as empty", () => {
        // @ts-expect-error exercising the runtime guard for loose cell values
        expect(toCsv([["a", null, undefined]])).toBe("a,,");
    });
});

describe("documentModelToCsv", () => {
    const model: DocumentModel = {
        title: "Employee account",
        subtitle: "Jane Doe",
        meta: [{ label: "Status", value: "Active" }],
        sections: [
            { heading: "Personal", rows: [{ label: "Full name", value: "Jane Doe" }] },
            { heading: "Note", text: "Line one\nLine two" },
        ],
    };

    it("emits a header row then meta, section rows and text sections", () => {
        expect(documentModelToCsv(model)).toEqual([
            ["Section", "Field", "Value"],
            ["", "Status", "Active"],
            ["Personal", "Full name", "Jane Doe"],
            ["Note", "", "Line one\nLine two"],
        ]);
    });

    it("round-trips through toCsv with the multi-line note quoted", () => {
        const csv = toCsv(documentModelToCsv(model));
        expect(csv).toContain('Note,,"Line one\nLine two"');
    });
});
