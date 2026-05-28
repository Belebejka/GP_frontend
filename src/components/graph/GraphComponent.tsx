import { SigmaContainer, useLoadGraph, useSetSettings, useSigma } from "@react-sigma/core";
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { createNodeImageProgram } from "@sigma/node-image";
import { getCameraStateToFitViewportToNodes  } from "@sigma/utils";
import Graph from "graphology";
import { useEffect, useRef } from "react";
import { createNodeCompoundProgram, NodeCircleProgram } from "sigma/rendering";

import "@react-sigma/core/lib/style.css";
import {
    useGraphMode,
    useGrowNodesOnZoom,
    useIsLayoutRunning,
    useNodesToReload,
    useNodesToResetCamera,
    useSetIsLayoutRunning,
    useSetNodesToResetCamera,
    useSetSigma,
} from "../../store/ClientStore";
import { useSettingsOfLayout } from "../../store/LayoutSettingsStore";
import { drawNodeHover, graphEdgeReducer, graphNodeReducer } from "./GraphVisualization";
import { WidePickingEdgeProgram } from "./custom_programmes/WidePickingEdgeProgram";
import { GraphModeSwitcher } from "./graph-mode-switcher/GraphModeSwitcher";
import { ClusterPickerDialog } from "./clusters/ClusterPickerDialog";
import { ClusterGraphMode } from "./modes/ClusterGraphMode";
import { ExpandGraphMode } from "./modes/ExpandGraphMode";

const NodePictogramCustomProgram = createNodeImageProgram({
    padding: 0.30,
    size: { mode: "force", value: 256 },
    correctCentering: true,
    drawingMode: "color",
    colorAttribute: "pictoColor",
});

const NodeProgram = createNodeCompoundProgram([NodeCircleProgram, NodePictogramCustomProgram]);
const growOnZoomSizeRatioFunction = (ratio: number) => Math.sqrt(ratio);
const staticOnZoomSizeRatioFunction = (ratio: number) => Math.max(1, ratio);

function LoadGraph() {
    const graphRef = useRef<Graph | null>(null);
    if (!graphRef.current) {
        graphRef.current = new Graph();
    }

    const loadGraph = useLoadGraph();

    useEffect(() => {
        loadGraph(graphRef.current!);
    }, [loadGraph]);

    return null;
}

function InitialCamera() {
    const sigma = useSigma();

    useEffect(() => {
        sigma.getCamera().setState({ ratio: 0.2 });
    }, [sigma]);

    return null;
}

function Layout() {
    const sigma = useSigma();
    const layoutSettings = useSettingsOfLayout();
    const nodesToReload = useNodesToReload();
    const setIsLayoutRunning = useSetIsLayoutRunning();
    const { start, stop } = useWorkerLayoutForceAtlas2({ settings: layoutSettings });
    const graph = sigma.getGraph();

    useEffect(() => {
        if (nodesToReload.length > 0) {
            nodesToReload.forEach((node) => graph.setNodeAttribute(node, "fixed", false));
            setIsLayoutRunning(true);
            start();
        } else {
            setIsLayoutRunning(false);
        }

        return () => {
            nodesToReload.forEach((node) => graph.setNodeAttribute(node, "fixed", true));
            stop();
        };
    }, [graph, nodesToReload, setIsLayoutRunning, start, stop]);

    return null;
}

function CameraFocusController() {
    const sigma = useSigma();
    const nodesToReload = useNodesToReload();
    const nodesToResetCamera = useNodesToResetCamera();
    const isLayoutRunning = useIsLayoutRunning();
    const setNodesToResetCamera = useSetNodesToResetCamera();

    useEffect(() => {
        if (nodesToResetCamera.length === 0) return;
        if (isLayoutRunning || nodesToReload.length > 0) return;
        
        const graph = sigma.getGraph();
        const existingNodes = nodesToResetCamera.filter((node) => graph.hasNode(node));

        if (existingNodes.length > 0) {
            sigma.setCustomBBox(null);
            sigma.refresh();
            const cameraState = getCameraStateToFitViewportToNodes(sigma, existingNodes);
            sigma.getCamera().animate(cameraState, {
                duration: 500,
                easing: "quadraticInOut",
            }).then(() => setNodesToResetCamera([]));
        }

    }, [isLayoutRunning, nodesToReload, nodesToResetCamera, setNodesToResetCamera, sigma]);

    return null;
}

function StoreSigma() {
    const sigma = useSigma();
    const setSigma = useSetSigma();

    useEffect(() => {
        setSigma(sigma);
    }, [setSigma, sigma]);

    return null;
}

function NodeSizeZoomController() {
    const setSettings = useSetSettings();
    const growNodesOnZoom = useGrowNodesOnZoom();

    useEffect(() => {
        setSettings({
            zoomToSizeRatioFunction: growNodesOnZoom
                ? growOnZoomSizeRatioFunction
                : staticOnZoomSizeRatioFunction,
        });
    }, [growNodesOnZoom, setSettings]);

    return null;
}

export default function GraphComponent() {
    const graphMode = useGraphMode();
    const isExpandMode = graphMode === "expand";
    const isClusterMode = graphMode === "cluster";

    return (
        <SigmaContainer
            style={{
                height: "100vh",
                width: "100%",
                backgroundColor: "#050a12",
                backgroundImage: `
                    repeating-linear-gradient(0deg, rgba(0, 255, 255, 0.03) 0px, rgba(0, 255, 255, 0.03) 1px, transparent 1px, transparent 40px),
                    repeating-linear-gradient(90deg, rgba(255, 0, 255, 0.03) 0px, rgba(255, 0, 255, 0.03) 1px, transparent 1px, transparent 40px)
                `,
                position: "relative" as const,
            }}
            settings={{
                autoRescale: true,
                itemSizesReference: "screen",
                zoomToSizeRatioFunction: growOnZoomSizeRatioFunction,
                minCameraRatio: 0.05,
                maxCameraRatio: 10,
                enableEdgeEvents: true,
                nodeProgramClasses: { pictogram: NodeProgram },
                edgeProgramClasses: { line: WidePickingEdgeProgram },
                nodeReducer: graphNodeReducer,
                edgeReducer: graphEdgeReducer,
                defaultDrawNodeHover: drawNodeHover,
            }}
        >
            <LoadGraph />
            <StoreSigma />
            <NodeSizeZoomController />
            <Layout />
            <CameraFocusController />
            <InitialCamera />
            <GraphModeSwitcher />
            <ClusterPickerDialog />

            {isExpandMode && (
                <ExpandGraphMode />
            )}

            {isClusterMode && (
                <ClusterGraphMode />
            )}
        </SigmaContainer>
    );
}
