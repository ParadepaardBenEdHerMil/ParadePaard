import { useEffect, useRef, useState } from "react";
import { downloadCsv } from "../../utils/csvExport";
import { UserServices } from "../../services/user-service/UserServices";
import type { EmailPresetResponseDTO } from "../../services/user-service/EmailPresets";
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
    /** When present and there is at least one recipient, a Mail submenu lists the section's templates. */
    mail?: MailConfig;
    /** Disable the trigger, e.g. while the page's data is still loading. */
    disabled?: boolean;
    className?: string;
};

/**
 * The per-page "Tools" button. Opens a small menu of page actions — Export (always) and Mail
 * (only where the page can mail). Mail flies out a scrollable submenu of email templates; picking
 * one opens the send preview. Replaces the old standalone Email / Document-preview buttons.
 */
export default function PageToolsMenu({ exportAction, mail, disabled, className }: PageToolsMenuProps) {
    const [open, setOpen] = useState(false);
    const [mailOpen, setMailOpen] = useState(false);
    const [presets, setPresets] = useState<EmailPresetResponseDTO[] | null>(null);
    const [loadingPresets, setLoadingPresets] = useState(false);
    const [chosenPreset, setChosenPreset] = useState<EmailPresetResponseDTO | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const closeMenu = () => {
        setOpen(false);
        setMailOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        const onDown = (event: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) closeMenu();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeMenu();
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
        closeMenu();
        downloadCsv(exportAction.filename, exportAction.build());
    };

    const toggleMailSubmenu = () => {
        const next = !mailOpen;
        setMailOpen(next);
        // Load the group's templates the first time the submenu is opened.
        if (next && mail && presets === null && !loadingPresets) {
            setLoadingPresets(true);
            UserServices.getEmailPresets()
                .then((all) => setPresets(all.filter((preset) => preset.groupType === mail.group)))
                .catch(() => setPresets([]))
                .finally(() => setLoadingPresets(false));
        }
    };

    const pickPreset = (preset: EmailPresetResponseDTO) => {
        closeMenu();
        setChosenPreset(preset);
    };

    return (
        <div className={`pageToolsMenu${className ? ` ${className}` : ""}`} ref={wrapRef}>
            <button
                type="button"
                className="button buttonSecondary pageToolsTrigger"
                onClick={() => {
                    setMailOpen(false);
                    setOpen((current) => !current);
                }}
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
                        <div className="pageToolsMailWrap">
                            <button
                                type="button"
                                className={`pageToolsItem${mailOpen ? " pageToolsItem--active" : ""}`}
                                onClick={toggleMailSubmenu}
                                aria-haspopup="menu"
                                aria-expanded={mailOpen}
                            >
                                <span className="pageToolsItemIcon" aria-hidden="true">✉</span>
                                <span className="pageToolsItemText">
                                    <span className="pageToolsItemLabel">Mail</span>
                                    <span className="pageToolsItemHint">Pick an email template</span>
                                </span>
                                <span className="pageToolsSubCaret" aria-hidden="true">‹</span>
                            </button>
                            {mailOpen ? (
                                <div className="pageToolsSubmenu" role="menu">
                                    {loadingPresets ? (
                                        <div className="pageToolsSubmenuState">Loading templates…</div>
                                    ) : presets && presets.length > 0 ? (
                                        presets.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                role="menuitem"
                                                className="pageToolsSubmenuItem"
                                                onClick={() => pickPreset(preset)}
                                                title={preset.subject || preset.name}
                                            >
                                                {preset.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="pageToolsSubmenuState">No templates for this section.</div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {mail && chosenPreset ? (
                <PresetSendModal
                    preset={chosenPreset}
                    recipientUserIds={mail.recipientUserIds}
                    recipientLabel={mail.recipientLabel}
                    onClose={() => setChosenPreset(null)}
                />
            ) : null}
        </div>
    );
}
