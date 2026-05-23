import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
    it("caps fixed modal dimensions below the navbar so popup content can scroll", () => {
        const html = renderToStaticMarkup(
            <Modal
                open
                title="Create role"
                onClose={() => undefined}
                maxHeight={560}
                height={560}
                hideDefaultFooter
            >
                <div>Scrollable role form</div>
            </Modal>
        );

        expect(html).toContain("max-height:min(560px, calc(100dvh - var(--navbar-height, 0px) - var(--modal-navbar-gap, 24px) - 32px))");
        expect(html).toContain("height:min(560px, calc(100dvh - var(--navbar-height, 0px) - var(--modal-navbar-gap, 24px) - 32px))");
    });

    it("renders the popup as an aria modal without an inline top offset", () => {
        const html = renderToStaticMarkup(
            <Modal
                open
                title="Create project"
                onClose={() => undefined}
                hideDefaultFooter
            >
                <div>Project form</div>
            </Modal>
        );

        expect(html).toContain('aria-modal="true"');
        expect(html).not.toContain("top:calc(var(--navbar-height, 0px) + var(--modal-navbar-gap, 24px))");
    });
});
