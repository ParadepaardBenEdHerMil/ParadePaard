import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PageBack from "./PageBack";

const navigate = vi.fn();
let historyLength = 2;
let pathname = "/management/users/employee-1";

vi.mock("react-router-dom", () => ({
    useNavigate: () => navigate,
    useLocation: () => ({ pathname }),
}));

describe("PageBack", () => {
    beforeEach(() => {
        navigate.mockClear();
        historyLength = 2;
        pathname = "/management/users/employee-1";
        vi.stubGlobal("window", {
            history: {
                get length() {
                    return historyLength;
                },
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses browser history before a fallback route", () => {
        const element = PageBack({ to: "/management/users" }) as ReactElement<{
            onClick: () => void;
        }>;

        element.props.onClick();

        expect(navigate).toHaveBeenCalledWith(-1);
    });

    it("uses the fallback route when no previous page exists", () => {
        historyLength = 1;
        const element = PageBack({ to: "/management/users" }) as ReactElement<{
            onClick: () => void;
        }>;

        element.props.onClick();

        expect(navigate).toHaveBeenCalledWith("/management/users");
    });

    it("can prefer the provided target over browser history", () => {
        const element = PageBack({ to: "/management/users", preferTarget: true }) as ReactElement<{
            onClick: () => void;
        }>;

        element.props.onClick();

        expect(navigate).toHaveBeenCalledWith("/management/users");
    });
});
