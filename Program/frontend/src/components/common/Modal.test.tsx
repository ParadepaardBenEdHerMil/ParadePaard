import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
    it("caps fixed modal dimensions to the visible viewport so popup content can scroll", () => {
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

        expect(html).toContain("max-height:min(560px, calc(100dvh - 32px))");
        expect(html).toContain("height:min(560px, calc(100dvh - 32px))");
    });
});
