import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from "@react-sigma/core";
import { getGraph } from "./Graph";
import { useWorkerLayoutForceAtlas2 } from '@react-sigma/layout-forceatlas2';
import { useEffect, useRef, useState } from "react";

import "@react-sigma/core/lib/style.css"
import { useAppendLayoutVersion, useIsLayoutRunning, useIsNeedToBeReload, useLayoutVersion, useResetCamera, useSetIsLayoutRunning, useSetIsNeedToBeReload, useSetOpenedNode, useSetSigma } from "../store/SigmaStore";
import NodeContextMenu from "./NodeContextMenu";

function LoadGraph() {
    const graph = getGraph();
    const loadGraph = useLoadGraph();

    useEffect(() => {
        loadGraph(graph);
    }, [loadGraph])

    return null;
}

function InitialCamera() {
    const sigma = useSigma();

    useEffect(() => {
        sigma.getCamera().setState({
            ratio: 0.2,
        });
    }, [sigma]);

    return null;
}

function InitialLayout() {
    const sigma = useSigma();
    const layoutVersion = useLayoutVersion();
    const needToBeReload = useIsNeedToBeReload();
    const setIsLayoutRunning = useSetIsLayoutRunning();
    const setIsNeedToBeReload = useSetIsNeedToBeReload();
    const appendLayoutVersion = useAppendLayoutVersion();
    // const resetCamera = useResetCamera();
    const { start, stop } = useWorkerLayoutForceAtlas2({
        settings: { 
            slowDown: 10,
            scalingRatio: 100,
            gravity: 25,
            strongGravityMode: false,
        },
    });
    const graph = sigma.getGraph();

    if (needToBeReload) {
        graph.forEachNode((node) => {
            graph.setNodeAttribute(node, "fixed", false);
        });
        setIsNeedToBeReload(false);
        appendLayoutVersion();
    }

    useEffect(() => {
        const graph = sigma.getGraph();

        start();
        setIsLayoutRunning(true);

        const timeoutId = setTimeout(() => {
            stop();
            setIsLayoutRunning(false);

            graph.forEachNode((node) => {
                graph.setNodeAttribute(node, "fixed", true);
            });

            sigma.refresh();
        }, 100);

        return () => {            
            clearTimeout(timeoutId);
        };
    }, [sigma, start, stop, layoutVersion]);

    return null;
}

function GraphEvents() {
    const registerEvents = useRegisterEvents();
    const sigma = useSigma();
    
    const draggedNodeRef = useRef<string | null>(null);
    const isNodeMovedRef = useRef(false);
    const isLayoutRunning = useIsLayoutRunning();

    const setOpenedNode = useSetOpenedNode();

//#region Функции touch/mouse
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

        isNodeMovedRef.current = true;
        
        const pos = sigma.viewportToGraph({ x, y });

        sigma.getGraph().setNodeAttribute(draggedNodeRef.current, "x", pos.x);
        sigma.getGraph().setNodeAttribute(draggedNodeRef.current, "y", pos.y);
        sigma.refresh();
    };

    const stopPointerEvent = (
        e: {
            preventSigmaDefault: () => void;
            original: {
                preventDefault: () => void;
                stopPropagation: () => void;
            };
        }
    ) => {
        if (!draggedNodeRef.current) return;
        e.preventSigmaDefault();
        e.original.preventDefault();
        e.original.stopPropagation();
    };
//#endregion

    useEffect(() =>{
        registerEvents({
            clickNode: (e) => {
                if (isNodeMovedRef.current) {
                    isNodeMovedRef.current = false;
                    return;
                }

                setOpenedNode(e.node);
            },
            
            updated: () => {
                setOpenedNode(null);
            },

            clickStage: () => {
                setOpenedNode(null);
            },

            downNode: (e) => {                
                setOpenedNode(null);

                const original = e.event.original;

                if ((original instanceof MouseEvent)) {
                    const button = original.button;
                    if (button !== 0) return;
                };

                if (!isLayoutRunning) draggedNodeRef.current = e.node;
            },

            mouseup: stopDragging,
            touchup: stopDragging,

            mousedown: ensureCustomBBox,
            touchdown: ensureCustomBBox,

            mousemovebody: (e) => {
                moveDraggedNode(e.x, e.y);
                stopPointerEvent(e);
            },

            touchmove: (e) => {
                moveDraggedNode(e.touches[0].x, e.touches[0].y);
                stopPointerEvent(e);
            },
        })

    }, [registerEvents, sigma, isLayoutRunning])

    return null
}

function StoreSigma() {
    const sigma = useSigma();
    const setSigma = useSetSigma();

    useEffect(() => {
        setSigma(sigma);
    }, [])

    return null;
}

export default function GraphComponent() {
    return <SigmaContainer
        style={{
            height: "100vh", 
            width: "100%", 
            backgroundColor: "#f0f0e5"
        }}
        settings={{
            autoRescale: false,
            itemSizesReference: "screen",
            minCameraRatio: 0.05,
            maxCameraRatio: 10,
        }}
    >
        <LoadGraph />
        <StoreSigma />
        <GraphEvents />
        <InitialLayout />
        <InitialCamera />
        <NodeContextMenu />
    </SigmaContainer>
}