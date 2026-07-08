// Shared circular-crop helpers used by every "choose a profile picture" flow so
// the crop math stays identical to the one first shipped on the /apply page.

export const PROFILE_CROP_FRAME_SIZE = 280;
export const PROFILE_CROP_OUTPUT_SIZE = 512;
export const PROFILE_CROP_MIN_ZOOM = 1;
export const PROFILE_CROP_MAX_ZOOM = 3;

export type ProfileCropState = {
    zoom: number;
    offsetX: number;
    offsetY: number;
};

export const INITIAL_PROFILE_CROP: ProfileCropState = {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
};

export function getProfileCropBounds(
    naturalWidth: number,
    naturalHeight: number,
    zoom: number
) {
    const baseScale = Math.max(
        PROFILE_CROP_FRAME_SIZE / naturalWidth,
        PROFILE_CROP_FRAME_SIZE / naturalHeight
    );
    const displayedWidth = naturalWidth * baseScale * zoom;
    const displayedHeight = naturalHeight * baseScale * zoom;
    return {
        displayedWidth,
        displayedHeight,
        maxOffsetX: Math.max(0, (displayedWidth - PROFILE_CROP_FRAME_SIZE) / 2),
        maxOffsetY: Math.max(0, (displayedHeight - PROFILE_CROP_FRAME_SIZE) / 2),
    };
}

export function clampProfileCrop(
    naturalWidth: number,
    naturalHeight: number,
    crop: ProfileCropState
): ProfileCropState {
    const bounds = getProfileCropBounds(naturalWidth, naturalHeight, crop.zoom);
    return {
        zoom: crop.zoom,
        offsetX: Math.min(bounds.maxOffsetX, Math.max(-bounds.maxOffsetX, crop.offsetX)),
        offsetY: Math.min(bounds.maxOffsetY, Math.max(-bounds.maxOffsetY, crop.offsetY)),
    };
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
    return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not load the selected profile picture."));
        image.src = src;
    });
}

export type CroppedPictureOptions = {
    /** Output MIME type. Defaults to PNG so it matches the original /apply flow. */
    outputType?: "image/png" | "image/jpeg";
    /** Encoder quality for lossy types (0-1). Ignored for PNG. */
    outputQuality?: number;
};

export async function buildCroppedProfilePicture(
    sourceUrl: string,
    sourceFileName: string,
    crop: ProfileCropState,
    options: CroppedPictureOptions = {}
): Promise<File> {
    const outputType = options.outputType ?? "image/png";
    const extension = outputType === "image/jpeg" ? "jpg" : "png";
    const image = await loadImageElement(sourceUrl);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const normalizedCrop = clampProfileCrop(naturalWidth, naturalHeight, crop);
    const { displayedWidth, displayedHeight } = getProfileCropBounds(
        naturalWidth,
        naturalHeight,
        normalizedCrop.zoom
    );
    const left = (PROFILE_CROP_FRAME_SIZE - displayedWidth) / 2 + normalizedCrop.offsetX;
    const top = (PROFILE_CROP_FRAME_SIZE - displayedHeight) / 2 + normalizedCrop.offsetY;
    const sourceX = ((0 - left) / displayedWidth) * naturalWidth;
    const sourceY = ((0 - top) / displayedHeight) * naturalHeight;
    const sourceWidth = (PROFILE_CROP_FRAME_SIZE / displayedWidth) * naturalWidth;
    const sourceHeight = (PROFILE_CROP_FRAME_SIZE / displayedHeight) * naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = PROFILE_CROP_OUTPUT_SIZE;
    canvas.height = PROFILE_CROP_OUTPUT_SIZE;
    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not prepare the profile picture crop.");
    }

    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        PROFILE_CROP_OUTPUT_SIZE,
        PROFILE_CROP_OUTPUT_SIZE
    );

    if (outputType === "image/jpeg") {
        // JPEG has no alpha channel; paint a white backdrop so transparent
        // source pixels do not turn black.
        context.globalCompositeOperation = "destination-over";
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, PROFILE_CROP_OUTPUT_SIZE, PROFILE_CROP_OUTPUT_SIZE);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType, options.outputQuality)
    );
    if (!blob) {
        throw new Error("Could not save the cropped profile picture.");
    }

    const baseFileName = sourceFileName.replace(/\.[^.]+$/, "") || "profile-picture";
    return new File([blob], `${baseFileName}-profile.${extension}`, { type: outputType });
}
