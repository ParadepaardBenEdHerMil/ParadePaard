import type React from "react";
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from "react/jsx-runtime";
import { mapIntrinsicType } from "./primitives";

export { Fragment };

type Props = Record<string, unknown>;

function mapType(type: string | React.JSXElementConstructor<unknown>) {
    return mapIntrinsicType(type);
}

export function jsx(
    type: string | React.JSXElementConstructor<unknown>,
    props: Props,
    key?: string
) {
    return reactJsx(mapType(type), props, key);
}

export function jsxs(
    type: string | React.JSXElementConstructor<unknown>,
    props: Props,
    key?: string
) {
    return reactJsxs(mapType(type), props, key);
}

type GenericIntrinsicProps = {
    children?: React.ReactNode;
    hidden?: boolean;
    className?: string;
    style?: unknown;
    onClick?: (...args: any[]) => any;
    onChange?: (...args: any[]) => any;
    onSubmit?: (...args: any[]) => any;
    onKeyDown?: (...args: any[]) => any;
    onFocus?: (...args: any[]) => any;
    onBlur?: (...args: any[]) => any;
    value?: unknown;
    defaultValue?: unknown;
    checked?: boolean;
    type?: string;
    disabled?: boolean;
    href?: string;
    placeholder?: string;
    src?: string;
    alt?: string;
    multiple?: boolean;
    [key: string]: unknown;
};

export namespace JSX {
    export type Element = any;
    export type ElementClass = any;
    export interface ElementAttributesProperty { props: {}; }
    export interface ElementChildrenAttribute { children: {}; }
    export type IntrinsicElements = {
        [elementName: string]: GenericIntrinsicProps;
    };
}
