import type React from "react";
import { Fragment, jsxDEV as reactJsxDEV } from "react/jsx-dev-runtime";
import { mapIntrinsicType } from "./primitives";

export { Fragment };

type Props = Record<string, unknown>;

export function jsxDEV(
    type: string | React.JSXElementConstructor<unknown>,
    props: Props,
    key: string | undefined,
    isStaticChildren: boolean,
    source: {
        fileName?: string;
        lineNumber?: number;
        columnNumber?: number;
    },
    self: unknown
) {
    return reactJsxDEV(mapIntrinsicType(type), props, key, isStaticChildren, source, self);
}
