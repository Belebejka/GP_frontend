import { useRegisterEvents, useSigma } from "@react-sigma/core";
import { useEffect, useRef } from "react";
import {
    useCloseOneHopContext,
    useClusters,
    useIsLayoutRunning,
    useMoveNodeToCluster,
    useOpenSingleNodeClusterPicker,
    useRemoveNodeFromCluster,
    useSelectedClusterId,
    useSetClusterContextMenu,
    useSetHoveredEdge,
    useSetHoveredNode,
} from "../../../store/ClientStore";

export function ClusterGraphEvents() {
    const registerEvents = useRegisterEvents();
    const sigma = useSigma();
    const draggedNodeRef = useRef<string | null>(null);
    const draggedClusterNodeIdsRef = useRef<string[]>([]);
    const isNodeMovedRef = useRef(false);
    const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);

    const isLayoutRunning = useIsLayoutRunning();
    const closeOneHopContext = useCloseOneHopContext();
    const clustersById = useClusters();
    const selectedClusterId = useSelectedClusterId();
    const moveNodeToCluster = useMoveNodeToCluster();
    const openSingleNodeClusterPicker = useOpenSingleNodeClusterPicker();
    const removeNodeFromCluster = useRemoveNodeFromCluster();
    const setClusterContextMenu = useSetClusterContextMenu();
    const setHoveredNode = useSetHoveredNode();
    const setHoveredEdge = useSetHoveredEdge();

    const stopDragging = () => {
        draggedNodeRef.current = null;
        draggedClusterNodeIdsRef.current = [];
        lastDragPositionRef.current = null;
    };

    const ensureCustomBBox = () => {
        if (!sigma.getCustomBBox()) {
            sigma.setCustomBBox(sigma.getBBox());
        }
    };

    const clearHoveredItems = () => {
        setHoveredNode(null);
        setHoveredEdge(null);
    };

    const isCtrlLeftClick = (event: { original: MouseEvent | TouchEvent }) => {
        const original = event.original;
        return original instanceof MouseEvent && original.button === 0 && original.ctrlKey;
    };

    const stopOriginalEvent = (event: {
        preventSigmaDefault: () => void;
        original: {
            preventDefault: () => void;
            stopPropagation: () => void;
        };
    }) => {
        event.preventSigmaDefault();
        event.original.preventDefault();
        event.original.stopPropagation();
    };

    const handleCtrlClick = (nodeId: string) => {
        if (selectedClusterId) {
            const selectedCluster = clustersById.get(selectedClusterId);
            if (selectedCluster?.nodeIds.includes(nodeId)) {
                removeNodeFromCluster(nodeId);
                return;
            }

            moveNodeToCluster(nodeId, selectedClusterId);
            return;
        }

        const isClustered = Array.from(clustersById.values()).some((cluster) => cluster.nodeIds.includes(nodeId));
        if (isClustered) {
            removeNodeFromCluster(nodeId);
            return;
        }

        openSingleNodeClusterPicker(nodeId);
    };

    const moveDraggedNode = (x: number, y: number) => {
        if (!draggedNodeRef.current) return;

        const startedAt = performance.now();
        isNodeMovedRef.current = true;
        const pos = sigma.viewportToGraph({ x, y });
        const graph = sigma.getGraph();
        const getIncidentEdgeIds = (nodeIds: string[]) => {
            const edgeIds = new Set<string>();

            nodeIds.forEach((nodeId) => {
                if (!graph.hasNode(nodeId)) return;
                graph.edges(nodeId).forEach((edgeId) => edgeIds.add(edgeId));
            });

            return Array.from(edgeIds);
        };

        if (draggedClusterNodeIdsRef.current.length > 0 && lastDragPositionRef.current) {
            const deltaX = pos.x - lastDragPositionRef.current.x;
            const deltaY = pos.y - lastDragPositionRef.current.y;
            const movedNodeIds: string[] = [];

            draggedClusterNodeIdsRef.current.forEach((nodeId) => {
                if (!graph.hasNode(nodeId)) return;

                const attributes = graph.getNodeAttributes(nodeId);
                const currentX = typeof attributes.x === "number" ? attributes.x : 0;
                const currentY = typeof attributes.y === "number" ? attributes.y : 0;

                graph.setNodeAttribute(nodeId, "x", currentX + deltaX);
                graph.setNodeAttribute(nodeId, "y", currentY + deltaY);
                movedNodeIds.push(nodeId);
            });

            lastDragPositionRef.current = pos;
            sigma.refresh({
                partialGraph: {
                    nodes: movedNodeIds,
                    edges: getIncidentEdgeIds(movedNodeIds),
                },
                skipIndexation: true,
            });
            window.dispatchEvent(new CustomEvent("graph-performance-operation", {
                detail: {
                    name: "drag-cluster",
                    duration: performance.now() - startedAt,
                },
            }));
            return;
        }

        graph.setNodeAttribute(draggedNodeRef.current, "x", pos.x);
        graph.setNodeAttribute(draggedNodeRef.current, "y", pos.y);
        sigma.refresh({
            partialGraph: {
                nodes: [draggedNodeRef.current],
                edges: graph.edges(draggedNodeRef.current),
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
        const container = sigma.getContainer();
        const setDefaultCursor = () => {
            container.style.cursor = "default";
        };
        const setInteractiveCursor = () => {
            container.style.cursor = "pointer";
        };

        registerEvents({
            enterNode: (event) => {
                setHoveredNode(event.node);
                setInteractiveCursor();
            },
            leaveNode: () => {
                setHoveredNode(null);
                setDefaultCursor();
            },
            clickNode: (event) => {
                if (isCtrlLeftClick(event.event)) {
                    stopOriginalEvent(event.event);
                    handleCtrlClick(event.node);
                    return;
                }

                if (isNodeMovedRef.current) {
                    isNodeMovedRef.current = false;
                    return;
                }

                const selectedCluster = selectedClusterId ? clustersById.get(selectedClusterId) : undefined;
                if (selectedCluster?.nodeIds.includes(event.node)) {
                    setClusterContextMenu({
                        type: "selectedCluster",
                        nodeId: event.node,
                        clusterId: selectedCluster.clusterId,
                    });
                    return;
                }

                setClusterContextMenu({
                    type: "node",
                    nodeId: event.node,
                });
            },
            clickStage: () => {
                clearHoveredItems();
                closeOneHopContext();
                setClusterContextMenu(null);
                setDefaultCursor();
            },
            downNode: (event) => {
                clearHoveredItems();
                closeOneHopContext();
                setClusterContextMenu(null);
                isNodeMovedRef.current = false;
                if (isCtrlLeftClick(event.event)) {
                    stopOriginalEvent(event.event);
                    return;
                }

                const original = event.event.original;
                if (original instanceof MouseEvent && original.button !== 0) return;
                if (isLayoutRunning) return;

                draggedNodeRef.current = event.node;
                lastDragPositionRef.current = sigma.viewportToGraph({
                    x: event.event.x,
                    y: event.event.y,
                });

                if (!selectedClusterId) return;

                const selectedCluster = clustersById.get(selectedClusterId);
                if (!selectedCluster?.nodeIds.includes(event.node)) return;

                const graph = sigma.getGraph();
                draggedClusterNodeIdsRef.current = selectedCluster.nodeIds.filter((nodeId) => graph.hasNode(nodeId));
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
            stopDragging();
            container.removeEventListener("wheel", clearHoveredItemsAndResetCursor);
        };
    }, [
        closeOneHopContext,
        clustersById,
        isLayoutRunning,
        moveNodeToCluster,
        openSingleNodeClusterPicker,
        registerEvents,
        removeNodeFromCluster,
        selectedClusterId,
        setClusterContextMenu,
        setHoveredEdge,
        setHoveredNode,
        sigma,
    ]);

    return null;
}
