import { useEffect, useMemo, useState } from "react";
import { UserServices } from "../../services/user-service/UserServices";
import type { EmailPresetResponseDTO } from "../../services/user-service/EmailPresets";

import "../../stylesheets/PresetSendControl.css";

type PresetSendControlProps = {
    /** Which preset group to offer (SHIFTS on a shift, PROJECTS on a project, USERS on an account). */
    group: "SHIFTS" | "PROJECTS" | "USERS";
    /** Resolved recipient user ids — e.g. everyone assigned to the shift/project, or the one account. */
    recipientUserIds: string[];
    /** Human phrase for the confirm + result copy, e.g. "everyone in this shift" or "this user". */
    recipientLabel: string;
    className?: string;
};

/**
 * A compact "pick a preset and send it" control. Sends one email per recipient via the preset send
 * endpoint. Application/onboarding presets are intentionally not offered here — those are sent as
 * part of a review decision so reject and request-changes can never be crossed.
 */
export default function PresetSendControl({
    group,
    recipientUserIds,
    recipientLabel,
    className,
}: PresetSendControlProps) {
    const [presets, setPresets] = useState<EmailPresetResponseDTO[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        UserServices.getEmailPresets()
            .then((all) => {
                if (!cancelled) setPresets(all.filter((preset) => preset.groupType === group));
            })
            .catch(() => {
                if (!cancelled) setPresets([]);
            });
        return () => {
            cancelled = true;
        };
    }, [group]);

    const uniqueRecipients = useMemo(
        () => Array.from(new Set(recipientUserIds.filter(Boolean))),
        [recipientUserIds]
    );

    const selectedPreset = presets.find((preset) => preset.id === selectedId) ?? null;

    const handleSend = async () => {
        if (!selectedPreset || uniqueRecipients.length === 0) return;
        const ok = window.confirm(
            `Send "${selectedPreset.name}" to ${recipientLabel} (${uniqueRecipients.length} recipient${uniqueRecipients.length === 1 ? "" : "s"})?`
        );
        if (!ok) return;
        try {
            setSending(true);
            setError(null);
            setResult(null);
            const response = await UserServices.sendEmailPreset(selectedPreset.id, uniqueRecipients);
            setResult(`Sent to ${response.sent} of ${response.requested} recipient${response.requested === 1 ? "" : "s"}.`);
            setSelectedId("");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to send the preset email.");
        } finally {
            setSending(false);
        }
    };

    if (presets.length === 0) {
        return null;
    }

    return (
        <div className={`presetSendControl${className ? ` ${className}` : ""}`}>
            <div className="presetSendRow">
                <select
                    className="presetSendSelect"
                    value={selectedId}
                    onChange={(event) => {
                        setSelectedId(event.target.value);
                        setResult(null);
                        setError(null);
                    }}
                    aria-label="Choose an email preset"
                >
                    <option value="">Send a preset email…</option>
                    {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                            {preset.name}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="button buttonSecondary presetSendButton"
                    onClick={() => void handleSend()}
                    disabled={!selectedPreset || uniqueRecipients.length === 0 || sending}
                >
                    {sending ? "Sending…" : "Send"}
                </button>
            </div>
            {result ? <div className="presetSendResult">{result}</div> : null}
            {error ? <div className="presetSendError">{error}</div> : null}
        </div>
    );
}
