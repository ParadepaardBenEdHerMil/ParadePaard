import React, { useEffect } from "react";
import "../../stylesheets/Modal.css";

type ModalProps = {
    open: boolean;
    title?: string;
    onClose: () => void;
    children: React.ReactNode;
    maxHeight?: number;
    height?: number;
    footer?: React.ReactNode;
    hideDefaultFooter?: boolean;
    closeOnEscape?: boolean;
    closeOnOverlayClick?: boolean;
};

export default function Modal({
    open,
    title,
    onClose,
    children,
    maxHeight = 560,
    height,
    footer,
    hideDefaultFooter = false,
    closeOnEscape = true,
    closeOnOverlayClick = true,
}: ModalProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (closeOnEscape && e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose, closeOnEscape]);

    if (!open) return null;

    const footerContent =
        footer ??
        (!hideDefaultFooter ? (
            <button className="btn" onClick={onClose}>
                Close
            </button>
        ) : null);

    return (
        <div
            className="modal_overlay"
            role="dialog"
            aria-modal="true"
            aria-label={title || "Modal"}
            onClick={(e) => {
                if (closeOnOverlayClick && e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="modal_box"
                style={{ maxHeight, height }}
            >
                <div className="modal_header">
                    <h3 className="modal_title">{title}</h3>
                    <button
                        className="modal_close_btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <div className="modal_body">{children}</div>

                {footerContent ? <div className="modal_footer">{footerContent}</div> : null}
            </div>
        </div>
    );
}
