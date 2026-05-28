import { useRegisterEvents, useSigma } from "@react-sigma/core";
import { useEffect, useRef } from "react";
import {
    useCloseOneHopContext,
    useIsLayoutRunning,
    useSetHoveredEdge,
    useSetHoveredNode,
    useSetOpenedEdge,
    useSetOpenedNode,
} from "../../store/ClientStore";

export function GraphEvents() {
    const registerEvents = useRegisterEvents();
    const sigma = useSigma();
    const draggedNodeRef = useRef<string | null>(null);
    const isNodeMovedRef = useRef(false);
    const isLayoutRunning = useIsLayoutRunning();
    const setOpenedNode = useSetOpenedNode();
    const setOpenedEdge = useSetOpenedEdge();
    const setHoveredNode = useSetHoveredNode();
    const setHoveredEdge = useSetHoveredEdge();
    const closeOneHopContext = useCloseOneHopContext();

    const stopDragging = () => {
        draggedNodeRef.current = null;
    };

    const ensureCustomBBox = () => {
        if (!sigma.getCustomBBox()) {
            sigma.setCustomBBox(sigma.getBBox());
        }
    };

    const moveDraggedNode = (x: number, y: number) => {
        if (!draggedNodeRef.current) return;

        const startedAt = performance.now();
        isNodeMovedRef.current = true;
        const pos = sigma.viewportToGraph({ x, y });
        sigma.getGraph().setNodeAttribute(draggedNodeRef.current, "x", pos.x);
        sigma.getGraph().setNodeAttribute(draggedNodeRef.current, "y", pos.y);
        sigma.refresh({
            partialGraph: {
                nodes: [draggedNodeRef.current],
                edges: sigma.getGraph().edges(draggedNodeRef.current),
            },
        skipIndexation: true,
        });
        window.dispatchEvent(new CustomEvent("graph-performance-operation", {
            detail: {
                name: "drag-node",
                duration: performance.now() - startedAt,
            },
        }));
    };

    const stopPointerEvent = (event: {
        preventSigmaDefault: () => void;
        original: {
            preventDefault: () => void;
            stopPropagation: () => void;
        };
    }) => {
        if (!draggedNodeRef.current) return;
        event.preventSigmaDefault();
        event.original.preventDefault();
        event.original.stopPropagation();
    };

    useEffect(() => {
        const clearHoveredNode = () => setHoveredNode(null);
        const clearHoveredEdge = () => {
            setHoveredEdge(null);
        };
        const clearHoveredItems = () => {
            clearHoveredNode();
            clearHoveredEdge();
        };
        const container = sigma.getContainer();
        const setDefaultCursor = () => {
            container.style.cursor = "default";
        };
        const setInteractiveCursor = () => {
            container.style.cursor = "pointer";
        };

        registerEvents({
            enterNode: (event) => {
                clearHoveredEdge();
                setHoveredNode(event.node);
                setInteractiveCursor();
            },
            leaveNode: () => {
                setHoveredNode(null);
                setDefaultCursor();
            },
            enterEdge: (event) => {
                clearHoveredNode();
                clearHoveredEdge();
                setHoveredEdge(event.edge);
                setInteractiveCursor();
            },
            leaveEdge: () => {
                setHoveredEdge(null);
                setDefaultCursor();
            },
            clickNode: (event) => {
                clearHoveredItems();
                closeOneHopContext();
                setOpenedEdge(null);
                if (isNodeMovedRef.current) {
                    isNodeMovedRef.current = false;
                    return;
                }
                setOpenedNode(event.node);
            },
            clickEdge: (event) => {
                clearHoveredItems();
                closeOneHopContext();
                setOpenedNode(null);
                setOpenedEdge(event.edge);
            },
            updated: () => {
                setOpenedNode(null);
                setOpenedEdge(null);
            },
            clickStage: () => {
                clearHoveredItems();
                closeOneHopContext();
                setOpenedNode(null);
                setOpenedEdge(null);
                setDefaultCursor();
            },
            downNode: (event) => {
                clearHoveredItems();
                closeOneHopContext();
                setOpenedNode(null);
                setOpenedEdge(null);
                const original = event.event.original;
                if (original instanceof MouseEvent && original.button !== 0) return;
                if (isLayoutRunning) return;
                draggedNodeRef.current = event.node;
            },
            mouseup: stopDragging,
            touchup: stopDragging,
            mousedown: () => {
                clearHoveredItems();
                ensureCustomBBox();
                setDefaultCursor();
            },
            touchdown: () => {
                clearHoveredItems();
                ensureCustomBBox();
                setDefaultCursor();
            },
            mousemovebody: (event) => {
                if (
                    draggedNodeRef.current ||
                    (event.original instanceof MouseEvent && event.original.buttons > 0)
                ) {
                    clearHoveredItems();
                    setDefaultCursor();
                }
                moveDraggedNode(event.x, event.y);
                stopPointerEvent(event);
            },
            touchmove: (event) => {
                clearHoveredItems();
                setDefaultCursor();
                moveDraggedNode(event.touches[0].x, event.touches[0].y);
                stopPointerEvent(event);
            },
        });

        const clearHoveredItemsAndResetCursor = () => {
            clearHoveredItems();
            setDefaultCursor();
        };

        container.addEventListener("wheel", clearHoveredItemsAndResetCursor, { passive: true });

        return () => {
            container.removeEventListener("wheel", clearHoveredItemsAndResetCursor);
        };
    }, [
        closeOneHopContext,
        isLayoutRunning,
        registerEvents,
        setHoveredEdge,
        setHoveredNode,
        setOpenedEdge,
        setOpenedNode,
        sigma,
    ]);

    return null;
}
