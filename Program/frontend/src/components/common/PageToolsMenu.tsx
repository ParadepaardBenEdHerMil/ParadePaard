import { useEffect, useRef, useState } from "react";
import { downloadCsv } from "../../utils/csvExport";
import PresetSendModal from "./PresetSendModal";

import "../../stylesheets/PageToolsMenu.css";

type MailConfig = {
    group: "USERS" | "SHIFTS" | "PROJECTS";
    recipientUserIds: string[];
    recipientLabel: string;
};

type PageToolsMenuProps = {
    /**
     * Builds the CSV rows lazily — only when Export is clicked, so heavy flattening never runs on
     * render. `filename` may omit the `.csv` extension.
     */
    exportAction: { filename: string; build: () => string[][] };
    /** When present and there is at least one recipient, a Mail option opens the preset send flow. */
    mail?: MailConfig;
    /** Disable the trigger, e.g. while the page's data is still loading. */
    disabled?: boolean;
    className?: string;
};

/**
 * The per-page "Tools" button. Opens a small menu of page actions — Export (always) and Mail
 * (only when the page can actually mail). Replaces the old standalone Email / Document-preview
 * buttons and is built to take on more tools later.
 */
export default function PageToolsMenu({ exportAction, mail, disabled, className }: PageToolsMenuProps) {
    const [open, setOpen] = useState(false);
    const [mailOpen, setMailOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (event: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const canMail = Boolean(mail && mail.recipientUserIds.some(Boolean));

    const handleExport = () => {
        setOpen(false);
        downloadCsv(exportAction.filename, exportAction.build());
    };

    return (
        <div className={`pageToolsMenu${className ? ` ${className}` : ""}`} ref={wrapRef}>
            <button
                type="button"
                className="button buttonSecondary pageToolsTrigger"
                onClick={() => setOpen((current) => !current)}
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                Tools
                <span className="pageToolsCaret" aria-hidden="true">▾</span>
            </button>

            {open ? (
                <div className="pageToolsDropdown" role="menu">
                    <button type="button" role="menuitem" className="pageToolsItem" onClick={handleExport}>
                        <span className="pageToolsItemIcon" aria-hidden="true">⬇</span>
                        <span className="pageToolsItemText">
                            <span className="pageToolsItemLabel">Export</span>
                            <span className="pageToolsItemHint">Download this page as CSV</span>
                        </span>
                    </button>
                    {canMail ? (
                        <button
                            type="button"
                            role="menuitem"
                            className="pageToolsItem"
                            onClick={() => {
                                setOpen(false);
                                setMailOpen(true);
                            }}
                        >
                            <span className="pageToolsItemIcon" aria-hidden="true">✉</span>
                            <span className="pageToolsItemText">
                                <span className="pageToolsItemLabel">Mail</span>
                                <span className="pageToolsItemHint">Send a preset email</span>
                            </span>
                        </button>
                    ) : null}
                </div>
            ) : null}

            {mail && mailOpen ? (
                <PresetSendModal
                    group={mail.group}
                    recipientUserIds={mail.recipientUserIds}
                    recipientLabel={mail.recipientLabel}
                    onClose={() => setMailOpen(false)}
                />
            ) : null}
        </div>
    );
}
