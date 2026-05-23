import React, { useEffect } from "react";
import "../../stylesheets/Modal.css";

let openModalCount = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";
const MODAL_VIEWPORT_GAP_PX = 32;
const MODAL_VIEWPORT_HEIGHT_LIMIT =
    `calc(100dvh - var(--navbar-height, 0px) - var(--modal-navbar-gap, 24px) - ${MODAL_VIEWPORT_GAP_PX}px)`;

type ModalDimension = number | string;

const toViewportBoundedDimension = (value: ModalDimension | undefined) => {
    if (value === undefined) return undefined;
    if (typeof value === "number") {
        return `min(${value}px, ${MODAL_VIEWPORT_HEIGHT_LIMIT})`;
    }
    return value;
};

type ModalProps = {
    open: boolean;
    title?: string;
    onClose: () => void;
    children: React.ReactNode;
    maxHeight?: ModalDimension;
    height?: ModalDimension;
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
}: ModalProps) {
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        if (openModalCount === 0) {
            originalBodyOverflow = document.body.style.overflow;
            originalHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
        }

        openModalCount += 1;

        return () => {
            openModalCount = Math.max(0, openModalCount - 1);

            if (openModalCount === 0) {
                document.body.style.overflow = originalBodyOverflow;
                document.documentElement.style.overflow = originalHtmlOverflow;
            }
        };
    }, [open]);

    if (!open) return null;

    const footerContent =
        footer ??
        (!hideDefaultFooter ? (
            <button className="btn" onClick={onClose}>
                Close
            </button>
        ) : null);
    const modalStyle: React.CSSProperties = {
        maxHeight: toViewportBoundedDimension(maxHeight),
        height: toViewportBoundedDimension(height),
    };
    return (
        <div
            className="modal_overlay"
            role="dialog"
            aria-modal="true"
            aria-label={title || "Modal"}
        >
            <div
                className="modal_box"
                style={modalStyle}
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
