import { Linking, Platform, Share } from "react-native";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let base64 = "";

    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const c = i + 2 < bytes.length ? bytes[i + 2] : 0;

        const triplet = (a << 16) | (b << 8) | c;
        base64 += chars[(triplet >> 18) & 0x3f];
        base64 += chars[(triplet >> 12) & 0x3f];
        base64 += i + 1 < bytes.length ? chars[(triplet >> 6) & 0x3f] : "=";
        base64 += i + 2 < bytes.length ? chars[triplet & 0x3f] : "=";
    }

    return base64;
}

export async function blobToDataUrl(
    blob: Blob | null,
    mimeType = "application/octet-stream"
): Promise<string | null> {
    if (!blob) return null;
    const buffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    return `data:${mimeType};base64,${base64}`;
}

export async function downloadBlob(
    blob: Blob,
    filename: string,
    mimeType = "application/octet-stream"
): Promise<void> {
    const dataUrl = await blobToDataUrl(blob, mimeType);
    if (!dataUrl) throw new Error("Failed to process file");

    if (Platform.OS === "web" && typeof document !== "undefined") {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    try {
        await Share.share({
            title: filename,
            url: dataUrl,
            message: filename,
        });
    } catch {
        await Linking.openURL(dataUrl);
    }
}
