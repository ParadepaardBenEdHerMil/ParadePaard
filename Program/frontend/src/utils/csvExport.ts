// Framework-free CSV helpers for the page "Export" tool. A CSV is modelled as rows of string
// cells (string[][]); callers build those rows however they like (directly, or by flattening a
// DocumentModel). Kept out of any component so it is easy to unit test.

import type { DocumentModel } from "./documentPreview";

// RFC 4180: a field is quoted only when it contains a comma, double quote, CR or LF; embedded
// quotes are doubled. Everything else is written as-is.
function escapeCsvField(value: string): string {
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

/** Rows of string cells → one CSV string with CRLF line endings (RFC 4180). */
export function toCsv(rows: string[][]): string {
    return rows
        .map((row) => row.map((cell) => escapeCsvField(cell ?? "")).join(","))
        .join("\r\n");
}

/**
 * Download `rows` as a UTF-8 .csv file. A leading BOM makes Excel read accents/€ correctly,
 * matching how the Word export already prepends a BOM.
 */
export function downloadCsv(filename: string, rows: string[][]): void {
    const csv = toCsv(rows);
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    try {
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
        anchor.rel = "noopener";
        window.document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

/**
 * Flatten a DocumentModel (the label/value document already built for the account/application/
 * onboarding records) into `Section, Field, Value` rows. Meta facts come first under a blank
 * section; free-text sections become a single row with an empty field.
 */
export function documentModelToCsv(model: DocumentModel): string[][] {
    const rows: string[][] = [["Section", "Field", "Value"]];
    if (model.meta) {
        for (const row of model.meta) {
            rows.push(["", row.label, row.value]);
        }
    }
    for (const section of model.sections) {
        if ("text" in section) {
            rows.push([section.heading, "", section.text]);
        } else {
            for (const row of section.rows) {
                rows.push([section.heading, row.label, row.value]);
            }
        }
    }
    return rows;
}
