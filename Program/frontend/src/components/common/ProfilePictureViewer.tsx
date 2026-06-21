import { useEffect } from "react";
import "../../stylesheets/common/ProfilePictureViewer.css";

type ProfilePictureViewerProps = {
    open: boolean;
    src: string | null;
    alt?: string;
    /** Filename used when the user clicks Download. */
    downloadName?: string;
    onClose: () => void;
};

export default function ProfilePictureViewer({
    open,
    src,
    alt = "Profile picture",
    downloadName = "profile-picture",
    onClose,
}: ProfilePictureViewerProps) {
    useEffect(() => {
        if (!open) return undefined;

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose]);

    if (!open || !src) return null;

    const handleDownload = () => {
        const link = document.createElement("a");
        link.href = src;
        // Ensure a filename extension; default to .jpg if the blob URL has none.
        link.download = /\.[a-z0-9]+$/i.test(downloadName) ? downloadName : `${downloadName}.jpg`;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <div
            className="profilePictureViewerOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="Profile picture viewer"
            onClick={onClose}
        >
            <div
                className="profilePictureViewerBox"
                onClick={(event) => event.stopPropagation()}
            >
                <img className="profilePictureViewerImage" src={src} alt={alt} />
                <div className="profilePictureViewerActions">
                    <button
                        type="button"
                        className="profilePictureViewerButton profilePictureViewerButton--primary"
                        onClick={handleDownload}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 4v12" />
                            <path d="m6 12 6 6 6-6" />
                            <path d="M5 20h14" />
                        </svg>
                        Download
                    </button>
                    <button
                        type="button"
                        className="profilePictureViewerButton"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
