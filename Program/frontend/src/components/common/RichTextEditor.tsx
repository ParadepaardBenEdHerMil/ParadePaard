import { useEffect, useRef, useState } from "react";
import { EMAIL_MERGE_FIELDS, type EmailMergeField } from "../../utils/emailMergeFields";

import "../../stylesheets/RichTextEditor.css";

type RichTextEditorProps = {
    value: string;
    onChange: (html: string) => void;
    /** Changing this re-seeds the editor from `value` (e.g. when switching between presets). */
    resetKey?: string;
    disabled?: boolean;
    /** Insert-menu fields; defaults to the shared catalogue. Pass a context-specific list to add or
     * hide fields (e.g. acceptance-only username / temporary password). */
    mergeFields?: EmailMergeField[];
};

const FONT_SIZES = [
    { label: "Small", value: "2" },
    { label: "Normal", value: "3" },
    { label: "Large", value: "5" },
    { label: "Huge", value: "7" },
];

const COLORS = ["#111827", "#b91c1c", "#1565c0", "#13795b", "#a16207", "#6b21a8"];

/**
 * Lightweight, dependency-free rich text editor (contentEditable + execCommand) for composing HTML
 * email bodies. Uncontrolled after seeding, so the cursor is never yanked mid-typing; `resetKey`
 * re-seeds it when the parent switches to a different document.
 */
export default function RichTextEditor({ value, onChange, resetKey, disabled, mergeFields = EMAIL_MERGE_FIELDS }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [fieldMenuOpen, setFieldMenuOpen] = useState(false);
    const [colorMenuOpen, setColorMenuOpen] = useState(false);
    const menuWrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value ?? "";
        }
        // Re-seed only when the target document changes, not on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey]);

    useEffect(() => {
        if (!fieldMenuOpen && !colorMenuOpen) return;
        const onClick = (event: MouseEvent) => {
            if (menuWrapRef.current && !menuWrapRef.current.contains(event.target as Node)) {
                setFieldMenuOpen(false);
                setColorMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [fieldMenuOpen, colorMenuOpen]);

    const emitChange = () => {
        if (editorRef.current) onChange(editorRef.current.innerHTML);
    };

    const exec = (command: string, arg?: string) => {
        if (disabled) return;
        editorRef.current?.focus();
        document.execCommand(command, false, arg);
        emitChange();
    };

    const insertHtml = (html: string) => {
        if (disabled) return;
        editorRef.current?.focus();
        document.execCommand("insertHTML", false, html);
        emitChange();
    };

    const handleInsertLink = () => {
        const url = window.prompt("Link URL (https://…)");
        if (!url) return;
        const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            exec("createLink", safe);
        } else {
            insertHtml(`<a href="${escapeAttr(safe)}">${escapeHtml(safe)}</a>`);
        }
    };

    return (
        <div className={`richEditor${disabled ? " richEditor--disabled" : ""}`}>
            <div className="richEditorToolbar" ref={menuWrapRef}>
                <button type="button" className="richEditorBtn" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><b>B</b></button>
                <button type="button" className="richEditorBtn" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><i>I</i></button>
                <button type="button" className="richEditorBtn" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><u>U</u></button>
                <select
                    className="richEditorSelect"
                    title="Font size"
                    defaultValue=""
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        if (e.target.value) exec("fontSize", e.target.value);
                        e.target.value = "";
                    }}
                >
                    <option value="" disabled>Size</option>
                    {FONT_SIZES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
                <div className="richEditorMenuWrap">
                    <button type="button" className="richEditorBtn" title="Text colour" onMouseDown={(e) => e.preventDefault()} onClick={() => { setColorMenuOpen((o) => !o); setFieldMenuOpen(false); }}>A<span className="richEditorColorBar" /></button>
                    {colorMenuOpen ? (
                        <div className="richEditorMenu richEditorColorMenu">
                            {COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className="richEditorSwatch"
                                    style={{ background: c }}
                                    title={c}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { exec("foreColor", c); setColorMenuOpen(false); }}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
                <button type="button" className="richEditorBtn" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>•</button>
                <button type="button" className="richEditorBtn" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>1.</button>
                <button type="button" className="richEditorBtn" title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={handleInsertLink}>🔗</button>
                <div className="richEditorMenuWrap">
                    <button type="button" className="richEditorBtn richEditorInsertBtn" onMouseDown={(e) => e.preventDefault()} onClick={() => { setFieldMenuOpen((o) => !o); setColorMenuOpen(false); }}>Insert ▾</button>
                    {fieldMenuOpen ? (
                        <div className="richEditorMenu richEditorFieldMenu">
                            {mergeFields.map((field) => (
                                <button
                                    key={field.token}
                                    type="button"
                                    className="richEditorMenuItem"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        if (field.kind === "link") {
                                            insertHtml(`<a href="${field.token}">${escapeHtml(field.linkText ?? field.label)}</a>&nbsp;`);
                                        } else {
                                            insertHtml(field.token);
                                        }
                                        setFieldMenuOpen(false);
                                    }}
                                >
                                    {field.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
            <div
                ref={editorRef}
                className="richEditorArea"
                contentEditable={!disabled}
                role="textbox"
                aria-multiline="true"
                onInput={emitChange}
                onBlur={emitChange}
                // Let a dropped file bubble to the surrounding form (for attaching) instead of the
                // browser inserting it into the editor. Text/HTML drops are left to normal editing.
                onDragOver={(event) => {
                    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
                }}
                onDrop={(event) => {
                    if (event.dataTransfer?.files?.length) event.preventDefault();
                }}
                suppressContentEditableWarning
            />
        </div>
    );
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
    return escapeHtml(value).replace(/"/g, "&quot;");
}
