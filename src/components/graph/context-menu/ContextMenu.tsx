import { useSigma } from "@react-sigma/core";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Coordinates } from "sigma/types";
import styles from "./ContextMenu.module.css";

type ContextMenuProps = {
    graphPosition: Coordinates;
    children: ReactNode;
};

const GAP = 18;
const MARGIN = 12;

export function ContextMenu({ graphPosition, children }: ContextMenuProps) {
    const sigma = useSigma();
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuSize, setMenuSize] = useState({ width: 0, height: 0 });
    const [cameraVersion, setCameraVersion] = useState(0);

    useEffect(() => {
        const camera = sigma.getCamera();
        const updatePosition = () => setCameraVersion((version) => version + 1);

        camera.on("updated", updatePosition);

        return () => {
            camera.off("updated", updatePosition);
        };
    }, [sigma]);

    useLayoutEffect(() => {
        if (!menuRef.current) return;

        const updateMenuSize = () => {
            if (!menuRef.current) return;

            const { width, height } = menuRef.current.getBoundingClientRect();
            setMenuSize({ width, height });
        };

        updateMenuSize();

        const resizeObserver = new ResizeObserver(updateMenuSize);
        resizeObserver.observe(menuRef.current);

        return () => resizeObserver.disconnect();
    }, [children]);

    const position = useMemo(() => {
        const viewportPosition = sigma.graphToViewport(graphPosition);
        const container = sigma.getContainer();
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        let left = viewportPosition.x + GAP;
        if (menuSize.width > 0 && left + menuSize.width > containerWidth - MARGIN) {
            left = viewportPosition.x - GAP - menuSize.width;
        }

        let top = viewportPosition.y - menuSize.height / 2;
        if (menuSize.height > 0 && top < MARGIN) {
            top = viewportPosition.y + GAP;
        }
        if (menuSize.height > 0 && top + menuSize.height > containerHeight - MARGIN) {
            top = viewportPosition.y - GAP - menuSize.height;
        }

        left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, containerWidth - menuSize.width - MARGIN));
        top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, containerHeight - menuSize.height - MARGIN));

        return { left, top };
    }, [cameraVersion, graphPosition, menuSize.height, menuSize.width, sigma]);

    return (
        <div
            ref={menuRef}
            className={styles.menu}
            style={position}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {children}
        </div>
    );
}

export { styles as contextMenuStyles };
