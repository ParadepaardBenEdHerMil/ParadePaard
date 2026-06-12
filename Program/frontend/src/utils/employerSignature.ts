export function formatEmployerSignaturePlaceholder(fullName?: string | null): string {
    const normalizedName = (fullName ?? "").trim().replace(/\s+/g, " ");
    return normalizedName
        ? `Type employer full legal name: ${normalizedName}`
        : "Type employer full legal name";
}
