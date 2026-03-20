import React, { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import {
    Image,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import DocumentPicker from "react-native-document-picker";

type WebLikeEvent = {
    preventDefault: () => void;
    stopPropagation: () => void;
    defaultPrevented: boolean;
    currentTarget: {
        value: string;
        checked: boolean;
        files: File[];
    };
    target: {
        value: string;
        checked: boolean;
        files: File[];
    };
    nativeEvent?: unknown;
    bubbles?: boolean;
    cancelable?: boolean;
};

type GenericProps = {
    children?: ReactNode;
    hidden?: boolean;
    className?: string;
    style?: unknown;
    onClick?: (...args: any[]) => any;
    onChange?: (...args: any[]) => any;
    onSubmit?: (...args: any[]) => any;
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

type IntrinsicComponent = (props: GenericProps) => React.ReactElement | null;

const INLINE_TAGS = new Set([
    "span",
    "p",
    "label",
    "strong",
    "em",
    "small",
    "b",
    "i",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
]);

const BLOCK_TAGS = new Set([
    "div",
    "section",
    "article",
    "main",
    "aside",
    "header",
    "footer",
    "nav",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "fieldset",
]);

const FormContext = createContext<(() => void) | null>(null);

function toEventTarget(value: {
    value?: string;
    checked?: boolean;
    files?: File[];
}): WebLikeEvent {
    let prevented = false;
    let stopped = false;
    const target = {
        value: value.value ?? "",
        checked: value.checked ?? false,
        files: value.files ?? [],
    };
    return {
        preventDefault: () => {
            prevented = true;
        },
        stopPropagation: () => {
            stopped = true;
        },
        get defaultPrevented() {
            return prevented;
        },
        get bubbles() {
            return !stopped;
        },
        cancelable: true,
        target,
        currentTarget: target,
    };
}

function normalizeChildren(children: ReactNode, parentIsText = false): ReactNode {
    return React.Children.map(children, (child) => {
        if (child === null || child === undefined || typeof child === "boolean") return null;
        if (typeof child === "string" || typeof child === "number") {
            return parentIsText ? String(child) : <Text>{String(child)}</Text>;
        }
        return child;
    });
}

function Block(props: GenericProps) {
    if (props.hidden) return null;
    return <View style={props.style as never}>{normalizeChildren(props.children, false)}</View>;
}

function Inline(props: GenericProps) {
    if (props.hidden) return null;
    return <Text style={props.style as never}>{normalizeChildren(props.children, true)}</Text>;
}

function Anchor(props: GenericProps) {
    if (props.hidden) return null;
    return (
        <Pressable
            disabled={Boolean(props.disabled)}
            onPress={async () => {
                const event = toEventTarget({});
                props.onClick?.(event);
                if (event.defaultPrevented) return;
                if (typeof props.href === "string" && props.href.length > 0) {
                    await Linking.openURL(props.href);
                }
            }}
            style={props.style as never}
        >
            <Text>{normalizeChildren(props.children, true)}</Text>
        </Pressable>
    );
}

function Button(props: GenericProps) {
    if (props.hidden) return null;
    const submit = useContext(FormContext);
    return (
        <Pressable
            disabled={Boolean(props.disabled)}
            onPress={() => {
                const event = toEventTarget({});
                props.onClick?.(event);
                if (event.defaultPrevented) return;
                if (props.type === "submit") {
                    submit?.();
                }
            }}
            style={props.style as never}
        >
            <Text>{normalizeChildren(props.children, true)}</Text>
        </Pressable>
    );
}

function toInputValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value);
}

function Input(props: GenericProps) {
    if (props.hidden) return null;

    if (props.type === "checkbox") {
        const checked = Boolean(props.checked ?? props.value);
        return (
            <Pressable
                disabled={Boolean(props.disabled)}
                onPress={() => {
                    const next = !checked;
                    props.onChange?.(toEventTarget({ checked: next, value: next ? "on" : "" }));
                }}
                style={props.style as never}
            >
                <Text>{checked ? "[x]" : "[ ]"}</Text>
            </Pressable>
        );
    }

    if (props.type === "file") {
        return (
            <Pressable
                disabled={Boolean(props.disabled)}
                onPress={async () => {
                    try {
                        const picked = await DocumentPicker.pickSingle();
                        const fileLike = {
                            uri: picked.uri,
                            name: picked.name ?? "upload",
                            type: picked.type ?? "application/octet-stream",
                            size: picked.size ?? 0,
                        } as unknown as File;
                        props.onChange?.(
                            toEventTarget({
                                files: [fileLike],
                                value: picked.name ?? "",
                            })
                        );
                    } catch (err: unknown) {
                        if (DocumentPicker.isCancel(err)) return;
                        props.onChange?.(toEventTarget({ files: [] }));
                    }
                }}
                style={props.style as never}
            >
                <Text>{typeof props.placeholder === "string" ? props.placeholder : "Select file"}</Text>
            </Pressable>
        );
    }

    const secureTextEntry = props.type === "password";
    return (
        <TextInput
            editable={!props.disabled}
            value={toInputValue(props.value ?? props.defaultValue)}
            secureTextEntry={secureTextEntry}
            placeholder={typeof props.placeholder === "string" ? props.placeholder : undefined}
            onChangeText={(text) => props.onChange?.(toEventTarget({ value: text }))}
            style={props.style as never}
        />
    );
}

function Textarea(props: GenericProps) {
    if (props.hidden) return null;
    return (
        <TextInput
            editable={!props.disabled}
            multiline
            value={toInputValue(props.value ?? props.defaultValue)}
            placeholder={typeof props.placeholder === "string" ? props.placeholder : undefined}
            onChangeText={(text) => props.onChange?.(toEventTarget({ value: text }))}
            style={props.style as never}
        />
    );
}

type SelectOption = {
    key: string;
    value: string;
    label: string;
    disabled: boolean;
};

function extractSelectOptions(children: ReactNode): SelectOption[] {
    const nodes = React.Children.toArray(children);
    const options: SelectOption[] = [];

    nodes.forEach((node, index) => {
        if (!React.isValidElement(node)) return;
        const props = (node.props ?? {}) as { value?: unknown; disabled?: boolean; children?: ReactNode };
        const labelText = React.Children.toArray(props.children)
            .map((child) => {
                if (typeof child === "string" || typeof child === "number") return String(child);
                return "";
            })
            .join("")
            .trim();
        const value = props.value !== undefined ? String(props.value) : labelText;
        options.push({
            key: `${value}-${index}`,
            value,
            label: labelText || value,
            disabled: Boolean(props.disabled),
        });
    });

    return options;
}

function Select(props: GenericProps) {
    if (props.hidden) return null;
    const options = useMemo(() => extractSelectOptions(props.children), [props.children]);
    const currentValue = toInputValue(props.value ?? props.defaultValue);
    const [open, setOpen] = useState(false);
    const selected =
        options.find((option) => option.value === currentValue) ??
        options.find((option) => !option.disabled) ??
        null;

    return (
        <View style={props.style as never}>
            <Pressable disabled={Boolean(props.disabled)} onPress={() => setOpen(true)}>
                <Text>{selected?.label ?? "Select option"}</Text>
            </Pressable>
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable
                    onPress={() => setOpen(false)}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        justifyContent: "center",
                        padding: 16,
                    }}
                >
                    <Pressable
                        onPress={(event) => {
                            event.stopPropagation();
                        }}
                        style={{ maxHeight: "70%", backgroundColor: "white", borderRadius: 8, padding: 12 }}
                    >
                        <ScrollView>
                            {options.map((option) => (
                                <Pressable
                                    key={option.key}
                                    disabled={option.disabled}
                                    onPress={() => {
                                        setOpen(false);
                                        props.onChange?.(toEventTarget({ value: option.value }));
                                    }}
                                    style={{ paddingVertical: 10 }}
                                >
                                    <Text>{option.label}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

function Option() {
    return null;
}

function Form(props: GenericProps) {
    if (props.hidden) return null;
    const submit = () => {
        const event = toEventTarget({});
        props.onSubmit?.(event);
    };
    return (
        <FormContext.Provider value={submit}>
            <View style={props.style as never}>{normalizeChildren(props.children, false)}</View>
        </FormContext.Provider>
    );
}

function ImageTag(props: GenericProps) {
    if (props.hidden) return null;
    if (!props.src || typeof props.src !== "string") return null;
    return (
        <Image
            source={{ uri: props.src }}
            accessibilityLabel={typeof props.alt === "string" ? props.alt : undefined}
            style={props.style as never}
        />
    );
}

function SvgFallback(props: GenericProps) {
    if (props.hidden) return null;
    return <View style={props.style as never}>{normalizeChildren(props.children, false)}</View>;
}

const componentCache = new Map<string, IntrinsicComponent>();

function createIntrinsicComponent(tag: string): IntrinsicComponent {
    if (tag === "a") return Anchor;
    if (tag === "button") return Button;
    if (tag === "input") return Input;
    if (tag === "textarea") return Textarea;
    if (tag === "select") return Select;
    if (tag === "option") return Option;
    if (tag === "form") return Form;
    if (tag === "img") return ImageTag;
    if (tag === "svg" || tag === "path" || tag === "circle" || tag === "line") return SvgFallback;
    if (INLINE_TAGS.has(tag)) return Inline;
    if (BLOCK_TAGS.has(tag)) return Block;
    return Block;
}

export function mapIntrinsicType(type: string | React.JSXElementConstructor<unknown>) {
    if (typeof type !== "string") return type;
    const cached = componentCache.get(type);
    if (cached) return cached;
    const component = createIntrinsicComponent(type);
    componentCache.set(type, component);
    return component;
}
