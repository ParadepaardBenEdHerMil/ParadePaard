import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import {
    INITIAL_PROFILE_CROP,
    PROFILE_CROP_MAX_ZOOM,
    PROFILE_CROP_MIN_ZOOM,
    buildCroppedProfilePicture,
    clampProfileCrop,
    getProfileCropBounds,
    type CroppedPictureOptions,
    type ProfileCropState,
} from "../../utils/profilePictureCrop";
import "../../stylesheets/common/ProfilePictureCropper.css";

type ProfilePictureCropperProps = {
    /** Source image the operator picked. When null the cropper is closed. */
    sourceFile: File | null;
    title?: string;
    intro?: string;
    confirmLabel?: string;
    /** Output format for the cropped file. Defaults to PNG (matches /apply). */
    outputType?: CroppedPictureOptions["outputType"];
    outputQuality?: CroppedPictureOptions["outputQuality"];
    /** Called with the square, cropped picture once the operator confirms. */
    onCropComplete: (file: File) => void | Promise<void>;
    onCancel: () => void;
};

export default function ProfilePictureCropper({
    sourceFile,
    title = "Adjust visible profile area",
    intro = "Drag the image to choose what will show inside the circular profile picture.",
    confirmLabel = "Use this crop",
    outputType,
    outputQuality,
    onCropComplete,
    onCancel,
}: ProfilePictureCropperProps) {
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [crop, setCrop] = useState<ProfileCropState>(INITIAL_PROFILE_CROP);
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
    const [dragStartPoint, setDragStartPoint] = useState<{
        pointerId: number;
        startX: number;
        startY: number;
        offsetX: number;
        offsetY: number;
    } | null>(null);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);

    const open = sourceFile != null;

    useEffect(() => {
        if (!sourceFile) {
            setSourceUrl(null);
            return;
        }

        // Reset the crop for each freshly picked image.
        setCrop(INITIAL_PROFILE_CROP);
        setNaturalSize(null);
        setDragStartPoint(null);
        setApplying(false);
        setError(null);

        const objectUrl = URL.createObjectURL(sourceFile);
        setSourceUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [sourceFile]);

    function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
        const image = event.currentTarget;
        const nextSize = {
            width: image.naturalWidth || image.width,
            height: image.naturalHeight || image.height,
        };
        setNaturalSize(nextSize);
        setCrop((current) => clampProfileCrop(nextSize.width, nextSize.height, current));
    }

    function handleZoomChange(nextZoom: number) {
        if (!naturalSize) {
            setCrop((current) => ({ ...current, zoom: nextZoom }));
            return;
        }
        setCrop((current) =>
            clampProfileCrop(naturalSize.width, naturalSize.height, {
                ...current,
                zoom: nextZoom,
            })
        );
    }

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (!naturalSize) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragStartPoint({
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: crop.offsetX,
            offsetY: crop.offsetY,
        });
    }

    function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        if (!dragStartPoint || !naturalSize || dragStartPoint.pointerId !== event.pointerId) return;
        setCrop(
            clampProfileCrop(naturalSize.width, naturalSize.height, {
                ...crop,
                offsetX: dragStartPoint.offsetX + (event.clientX - dragStartPoint.startX),
                offsetY: dragStartPoint.offsetY + (event.clientY - dragStartPoint.startY),
            })
        );
    }

    function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
        if (dragStartPoint?.pointerId !== event.pointerId) return;
        if (stageRef.current?.hasPointerCapture(event.pointerId)) {
            stageRef.current.releasePointerCapture(event.pointerId);
        }
        setDragStartPoint(null);
    }

    async function handleApply() {
        if (!sourceUrl || !sourceFile) return;
        try {
            setApplying(true);
            setError(null);
            const croppedFile = await buildCroppedProfilePicture(sourceUrl, sourceFile.name, crop, {
                outputType,
                outputQuality,
            });
            await onCropComplete(croppedFile);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not crop the selected profile picture.";
            setError(message);
            setApplying(false);
        }
    }

    function handleCancel() {
        if (applying) return;
        onCancel();
    }

    return (
        <Modal
            open={open}
            onClose={handleCancel}
            title={title}
            hideDefaultFooter
            maxHeight={760}
            height={760}
        >
            <div className="profileCropModal">
                <p className="profileCropIntro">{intro}</p>
                <div
                    ref={stageRef}
                    className={`profileCropStage${dragStartPoint ? " profileCropStage--dragging" : ""}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                >
                    {sourceUrl ? (
                        <img
                            src={sourceUrl}
                            alt="Profile crop source"
                            className="profileCropImage"
                            onLoad={handleImageLoad}
                            draggable={false}
                            style={
                                naturalSize
                                    ? (() => {
                                          const bounds = getProfileCropBounds(
                                              naturalSize.width,
                                              naturalSize.height,
                                              crop.zoom
                                          );
                                          return {
                                              width: `${bounds.displayedWidth}px`,
                                              height: `${bounds.displayedHeight}px`,
                                              transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px))`,
                                          } satisfies React.CSSProperties;
                                      })()
                                    : undefined
                            }
                        />
                    ) : null}
                    <div className="profileCropMask" aria-hidden="true" />
                    <div className="profileCropCircle" aria-hidden="true" />
                </div>

                <label className="profileCropControl">
                    <span>Zoom</span>
                    <input
                        type="range"
                        min={PROFILE_CROP_MIN_ZOOM}
                        max={PROFILE_CROP_MAX_ZOOM}
                        step="0.01"
                        value={crop.zoom}
                        onChange={(event) => handleZoomChange(Number(event.target.value))}
                    />
                </label>

                {error ? <p className="profileCropError" role="alert">{error}</p> : null}

                <div className="profileCropActions">
                    <button
                        type="button"
                        className="profileCropSecondary"
                        onClick={handleCancel}
                        disabled={applying}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="profileCropPrimary"
                        onClick={() => void handleApply()}
                        disabled={applying || !sourceUrl}
                    >
                        {applying ? "Saving..." : confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
