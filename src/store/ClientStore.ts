import type { Sigma } from "sigma";
import { create } from "zustand";
import type {
    ClientGraphModel,
    ClusterPickerContext,
    DeletedGraphArchive,
    ExpandData,
    ExpandExclude,
    GraphCluster,
    GraphEdge,
    GraphNode,
} from "../types";
import {
    createClientGraphModel,
    createDeletedGraphArchive,
    getDeletedGraphArchive,
    markNodeDeleted,
    mergeIncomingEdge,
    mergeIncomingNode,
    restoreNode,
    saveNodeLayoutAttributes,
    upsertVisibleNode,
} from "./clientGraphModel";
import {
    createClusterId,
    getAvailableClusterItems,
    getClusterColors,
    indexClustersByNode,
    moveNodeToClusterById,
    removeItemsFromOtherClusters,
    removeNodeFromClusters,
    unionStringArrays,
    removeNodeFromClusterById,
} from "./helpers/clusterModel";
import {
    addOrMergeVisualEdges,
    clearOneHopVisualization,
    fullGraphNodePosition,
    setEdgeSelected,
    sigmaNodeAttributes,
} from "./helpers/visualGraphModel";

type OneHopContext = {
    sourceNodeId: string;
    nodeIds: string[];
    edgeIds: string[];
};

type ClientStore = {
    sigma: Sigma | null;
    graphMode: "expand" | "cluster";
    activeOverlay: "hoveredNode" | "hoveredEdge" | "openedNode" | "openedEdge" | "oneHop" | null;
    openedNode: string | null;
    openedEdge: string | null;
    hoveredNode: string | null;
    hoveredEdge: string | null;
    oneHopContext: OneHopContext | null;
    clusterPickerContext: ClusterPickerContext | null;
    clustersById: Map<string, GraphCluster>;
    clusterIdsByNodeId: Map<string, Set<string>>;
    selectedClusterId: string | null;
    clusterContextMenu:
        | { type: "node"; nodeId: string }
        | { type: "selectedCluster"; nodeId: string; clusterId: string }
        | null;
    showHoveredNodeDetails: boolean;
    showHoveredEdgeDetails: boolean;
    focusOnSelect: boolean;
    clusterFocusOnSelect: boolean;
    growNodesOnZoom: boolean;
    drawerState:
        | { type: 'expandPreview'; nodeId: string }
        | { type: 'nodeInfo'; nodeId: string }
        | { type: 'edgeInfo'; edgeId: string }
        | null;
    nodesToReload: string[];
    nodesToResetCamera: string[];
    selectedNodes: string[];
    layoutVersion: number;
    graphVersion: number;
    isLayoutRunning: boolean;
    isNeedToBeReload: boolean;
    clientGraph: ClientGraphModel;
    deletedGraph: DeletedGraphArchive;

    setSigma: (sigma: Sigma) => void;
    setGraphMode: (mode: ClientStore["graphMode"]) => void;
    setActiveOverlay: (overlay: ClientStore["activeOverlay"]) => void;
    setOpenedNode: (node: string | null) => void;
    setOpenedEdge: (edge: string | null) => void;
    setHoveredNode: (node: string | null) => void;
    setHoveredEdge: (edge: string | null) => void;
    setShowHoveredNodeDetails: (show: boolean) => void;
    setShowHoveredEdgeDetails: (show: boolean) => void;
    setFocusOnSelect: (focus: boolean) => void;
    setClusterFocusOnSelect: (focus: boolean) => void;
    setGrowNodesOnZoom: (grow: boolean) => void;
    setDrawerState: (state: ClientStore["drawerState"]) => void;
    setNodesToReload: (nodes: string[]) => void;
    setAllNodesToReload: () => void;
    setNodesToResetCamera: (nodes: string[]) => void;
    setAllNodesToResetCamera: () => void;
    setIsLayoutRunning: (isRunning: boolean) => void;
    setIsNeedToBeReload: (need: boolean) => void;
    setSelectedCluster: (clusterId: string | null) => void;
    setClusterContextMenu: (context: ClientStore["clusterContextMenu"]) => void;
    getGraphExcludeContext: () => ExpandExclude;

    placeSeedNode: () => boolean;
    removeSeedNode: () => void;
    replaceSeedNode: (node: GraphNode) => void;
    replaceGraph: (response: ExpandData) => void;
    expandGraphFromNode: (
        seedNodeId: string,
        response: ExpandData,
        includeSeedInLayout?: boolean,
        focusCameraAfterExpand?: boolean,
    ) => void;
    openExpandPreview: (node: string) => void;
    openNodeInfo: (node: string) => void;
    openEdgeInfo: (edge: string) => void;
    closeDrawer: () => void;
    openOneHopContext: (sourceNodeId: string) => void;
    closeOneHopContext: () => void;
    openClusterPickerFromOneHop: (forceReplace?: boolean) => void;
    closeClusterPicker: () => void;
    createClusterFromPicker: (name?: string) => void;
    addPickerContextToCluster: (clusterId: string) => void;
    deleteCluster: (clusterId: string) => void;
    openSingleNodeClusterPicker: (nodeId: string) => void;
    removeNodeFromCluster: (nodeId: string) => void;
    moveNodeToCluster: (nodeId: string, clusterId: string) => void;
    deleteSelectedCluster: () => void;
    deleteSelectedClusterNodes: () => void;
    deleteNode: (nodeId: string) => void;
    returnNode: (nodeId: string) => void;
    appendLayoutVersion: () => void;
    appendGraphVersion: () => void;
}

export const useClientStore = create<ClientStore>((set, get) => ({
    sigma: null,
    graphMode: "expand",
    activeOverlay: null,
    openedNode: null,
    openedEdge: null,
    hoveredNode: null,
    hoveredEdge: null,
    oneHopContext: null,
    clusterPickerContext: null,
    clustersById: new Map(),
    clusterIdsByNodeId: new Map(),
    selectedClusterId: null,
    clusterContextMenu: null,
    showHoveredNodeDetails: true,
    showHoveredEdgeDetails: true,
    focusOnSelect: true,
    clusterFocusOnSelect: true,
    growNodesOnZoom: true,
    drawerState: null,
    nodesToReload: [],
    nodesToResetCamera: [],
    selectedNodes: [],
    layoutVersion: 0,
    graphVersion: 0,
    isLayoutRunning: false,
    isNeedToBeReload: false,
    clientGraph: createClientGraphModel(),
    deletedGraph: createDeletedGraphArchive(),

//#region Setters
    setSigma: (sigma) => set(() => ({sigma: sigma})),
    setGraphMode: (graphMode) => set(() => ({
        graphMode,
        activeOverlay: null,
        openedNode: null,
        openedEdge: null,
        hoveredNode: null,
        hoveredEdge: null,
        oneHopContext: null,
        clusterContextMenu: null,
    })),
    setActiveOverlay: (activeOverlay) => set(() => ({activeOverlay})),
    setOpenedNode: (node) => {
        const { sigma } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        const previousOpenedEdge = get().openedEdge;
        const openNode = () => {
            setEdgeSelected(graph, previousOpenedEdge, false);
            set(() => ({
                openedNode: node,
                openedEdge: null,
                activeOverlay: "openedNode",
            }));
        };

        if (node){
            if (get().focusOnSelect) {
                const camera = sigma.getCamera();
                const display = sigma.getNodeDisplayData(node);

                if (!display) return;
                camera.animate(
                    {
                        x: display.x,
                        y: display.y,
                        ratio: 0.2,
                    },
                    { duration: 500 }
                ).then(openNode);
                return;
            }

            if (!graph.hasNode(node)) return;
            openNode();
        } else {
            set((state) => ({
                openedNode: node,
                activeOverlay: state.activeOverlay === "openedNode" ? null : state.activeOverlay,
            }));
        }
    },
    setOpenedEdge: (edge) => {
        const { sigma } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        const previousOpenedEdge = get().openedEdge;

        if (edge) {
            if (!graph.hasEdge(edge)) return;

            const openEdge = () => set(() => ({
                openedEdge: edge,
                openedNode: null,
                activeOverlay: "openedEdge",
            }));
            const selectEdge = () => {
                setEdgeSelected(graph, previousOpenedEdge, false);
                setEdgeSelected(graph, edge, true);
            };

            if (get().focusOnSelect) {
                const source = sigma.getNodeDisplayData(graph.source(edge));
                const target = sigma.getNodeDisplayData(graph.target(edge));
                if (!source || !target) return;

                sigma.getCamera().animate(
                    {
                        x: (source.x + target.x) / 2,
                        y: (source.y + target.y) / 2,
                        ratio: 0.2,
                    },
                    { duration: 500 }
                ).then(openEdge).then(selectEdge);
                return;
            }

            openEdge();
            selectEdge();
        } else {
            setEdgeSelected(graph, previousOpenedEdge, false);
            set((state) => ({
                openedEdge: edge,
                activeOverlay: state.activeOverlay === "openedEdge" ? null : state.activeOverlay,
            }));
        }
    },
    setHoveredNode: (hoveredNode) => {
        const { sigma } = get();
        const state = get();

        if (hoveredNode && state.activeOverlay && state.activeOverlay !== "hoveredNode") return;

        if (hoveredNode && sigma && state.hoveredEdge) {
            const graph = sigma.getGraph();
            if (graph.hasEdge(state.hoveredEdge)) {
                graph.setEdgeAttribute(state.hoveredEdge, "hovered", false);
            }
        }

        set((currentState) => ({
            hoveredNode,
            hoveredEdge: hoveredNode ? null : currentState.hoveredEdge,
            activeOverlay: hoveredNode
                ? "hoveredNode"
                : currentState.activeOverlay === "hoveredNode"
                    ? null
                    : currentState.activeOverlay,
        }));
    },
    setHoveredEdge: (hoveredEdge) => {
        const { sigma } = get();
        const state = get();

        if (hoveredEdge && state.activeOverlay && state.activeOverlay !== "hoveredEdge") return;

        if (sigma) {
            const graph = sigma.getGraph();

            if (state.hoveredEdge && graph.hasEdge(state.hoveredEdge)) {
                graph.setEdgeAttribute(state.hoveredEdge, "hovered", false);
            }

            if (hoveredEdge && graph.hasEdge(hoveredEdge)) {
                graph.setEdgeAttribute(hoveredEdge, "hovered", true);
            }
        }

        set((currentState) => ({
            hoveredEdge,
            hoveredNode: hoveredEdge ? null : currentState.hoveredNode,
            activeOverlay: hoveredEdge
                ? "hoveredEdge"
                : currentState.activeOverlay === "hoveredEdge"
                    ? null
                    : currentState.activeOverlay,
        }));
    },
    setShowHoveredNodeDetails: (showHoveredNodeDetails) => set(() => ({showHoveredNodeDetails})),
    setShowHoveredEdgeDetails: (showHoveredEdgeDetails) => set(() => ({showHoveredEdgeDetails})),
    setFocusOnSelect: (focusOnSelect) => set(() => ({focusOnSelect})),
    setClusterFocusOnSelect: (clusterFocusOnSelect) => set(() => ({clusterFocusOnSelect})),
    setGrowNodesOnZoom: (growNodesOnZoom) => set(() => ({growNodesOnZoom})),
    setDrawerState: (drawerState) => set(() => ({drawerState})),
    setNodesToReload: (nodes) => set(() => ({nodesToReload: nodes})),
    setAllNodesToReload: () => {
        const { sigma } = get();
        if (!sigma) return;
        const graph = sigma.getGraph();

        set(() => ({nodesToReload: graph.nodes()}))
    },
    setNodesToResetCamera: (nodes) => set(() => ({nodesToResetCamera: nodes})),
    setAllNodesToResetCamera: () => {
        const { sigma } = get();
        if (!sigma) return;
        const graph = sigma.getGraph();

        set(() => ({nodesToResetCamera: graph.nodes()}));
    },
    setIsLayoutRunning: (isRunning) => set(() => ({isLayoutRunning: isRunning})),
    setIsNeedToBeReload: (need) => set(() => ({isNeedToBeReload: need})),
    setSelectedCluster: (selectedClusterId) => set(() => ({selectedClusterId})),
    setClusterContextMenu: (clusterContextMenu) => set(() => ({clusterContextMenu})),
    getGraphExcludeContext: () => {
        const { clientGraph } = get();
        const nodeIds = Array.from(clientGraph.nodesById.keys());
        const edgeIds = Array.from(clientGraph.edgesById.keys());

        return { nodeIds, edgeIds };
    },
//#endregion

//#region Actions
//#region Drawer actions
    openExpandPreview: (node) => {
        const { sigma } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        if (!graph.hasNode(node)) return;

        set(() => ({
            drawerState: { type: 'expandPreview', nodeId: node },
            openedNode: null,
            openedEdge: null,
        }));
    },

    openNodeInfo: (node) => {
        const { sigma } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        if (!graph.hasNode(node)) return;

        set(() => ({
            drawerState: { type: 'nodeInfo', nodeId: node },
            openedNode: null,
            openedEdge: null,
        }));
    },

    openEdgeInfo: (edge) => {
        const { sigma } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        if (!graph.hasEdge(edge)) return;

        set(() => ({
            drawerState: { type: 'edgeInfo', edgeId: edge },
            openedNode: null,
            openedEdge: null,
        }));
    },

    closeDrawer: () => {
        set(() => ({drawerState: null}));
    },
//#endregion

//#region One hop actions
    openOneHopContext: (sourceNodeId) => {
        const { sigma, oneHopContext } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        if (!graph.hasNode(sourceNodeId)) return;

        clearOneHopVisualization(sigma, oneHopContext);

        const nodeIds = new Set<string>([sourceNodeId]);
        const edgeIds = graph.edges(sourceNodeId);

        edgeIds.forEach((edgeId) => {
            nodeIds.add(graph.source(edgeId));
            nodeIds.add(graph.target(edgeId));
        });

        const nextNodeIds = Array.from(nodeIds);

        nextNodeIds.forEach((nodeId) => {
            if (graph.hasNode(nodeId)) graph.setNodeAttribute(nodeId, "highlighted", true);
        });
        edgeIds.forEach((edgeId) => {
            if (graph.hasEdge(edgeId)) graph.setEdgeAttribute(edgeId, "selected", true);
        });

        sigma.refresh({
            partialGraph: {
                nodes: nextNodeIds,
                edges: edgeIds,
            },
        });

        set(() => ({
            activeOverlay: "oneHop",
            openedNode: null,
            openedEdge: null,
            hoveredNode: null,
            hoveredEdge: null,
            oneHopContext: {
                sourceNodeId,
                nodeIds: nextNodeIds,
                edgeIds,
            },
        }));
    },

    closeOneHopContext: () => {
        const { sigma, oneHopContext } = get();

        clearOneHopVisualization(sigma, oneHopContext);

        set((state) => ({
            oneHopContext: null,
            activeOverlay: state.activeOverlay === "oneHop" ? null : state.activeOverlay,
        }));
    },

    openClusterPickerFromOneHop: (forceReplace = false) => {
        const { oneHopContext } = get();
        if (!oneHopContext) return;

        set(() => ({
            clusterPickerContext: {
                sourceNodeId: oneHopContext.sourceNodeId,
                nodeIds: oneHopContext.nodeIds,
                edgeIds: oneHopContext.edgeIds,
                forceReplace,
            },
        }));
    },

    closeClusterPicker: () => {
        set(() => ({clusterPickerContext: null}));
    },
//#endregion

//#region Cluster actions
    createClusterFromPicker: (name) => {
        const { clusterPickerContext, clusterIdsByNodeId, clustersById, oneHopContext, sigma } = get();
        if (!clusterPickerContext) return;

        const now = Date.now();
        const clusterIndex = clustersById.size;
        const colors = getClusterColors(clusterIndex);
        const clusterId = createClusterId();
        const availableItems = clusterPickerContext.forceReplace
            ? {
                nodeIds: clusterPickerContext.nodeIds,
                edgeIds: clusterPickerContext.edgeIds,
            }
            : getAvailableClusterItems(
                clusterIdsByNodeId,
                clusterId,
                clusterPickerContext.nodeIds,
                clusterPickerContext.edgeIds,
            );
        const nextClustersById = clusterPickerContext.forceReplace
            ? removeItemsFromOtherClusters(clustersById, clusterId, availableItems.nodeIds, availableItems.edgeIds)
            : new Map(clustersById);
        const trimmedName = name?.trim();

        nextClustersById.set(clusterId, {
            clusterId,
            name: trimmedName || `Cluster ${clusterIndex + 1}`,
            color: colors.color,
            activeColor: colors.activeColor,
            nodeIds: Array.from(new Set(availableItems.nodeIds)),
            edgeIds: Array.from(new Set(availableItems.edgeIds)),
            sourceNodeId: clusterPickerContext.sourceNodeId,
            createdAt: now,
            updatedAt: now,
        });

        clearOneHopVisualization(sigma, oneHopContext);

        set(() => ({
            clustersById: nextClustersById,
            clusterIdsByNodeId: indexClustersByNode(nextClustersById),
            clusterPickerContext: null,
            oneHopContext: null,
            activeOverlay: null,
            selectedClusterId: clusterId,
            graphMode: "cluster",
        }));
    },

    addPickerContextToCluster: (clusterId) => {
        const { clusterPickerContext, clusterIdsByNodeId, clustersById, oneHopContext, sigma } = get();
        if (!clusterPickerContext) return;

        const cluster = clustersById.get(clusterId);
        if (!cluster) return;

        const availableItems = clusterPickerContext.forceReplace
            ? {
                nodeIds: clusterPickerContext.nodeIds,
                edgeIds: clusterPickerContext.edgeIds,
            }
            : getAvailableClusterItems(
                clusterIdsByNodeId,
                clusterId,
                clusterPickerContext.nodeIds,
                clusterPickerContext.edgeIds,
            );
        const nextClustersById = clusterPickerContext.forceReplace
            ? removeItemsFromOtherClusters(clustersById, clusterId, availableItems.nodeIds, availableItems.edgeIds)
            : new Map(clustersById);
        const targetCluster = nextClustersById.get(clusterId) ?? cluster;

        nextClustersById.set(clusterId, {
            ...targetCluster,
            nodeIds: unionStringArrays(targetCluster.nodeIds, availableItems.nodeIds),
            edgeIds: unionStringArrays(targetCluster.edgeIds, availableItems.edgeIds),
            updatedAt: Date.now(),
        });

        clearOneHopVisualization(sigma, oneHopContext);

        set(() => ({
            clustersById: nextClustersById,
            clusterIdsByNodeId: indexClustersByNode(nextClustersById),
            clusterPickerContext: null,
            oneHopContext: null,
            activeOverlay: null,
            selectedClusterId: clusterId,
            graphMode: "cluster",
        }));
    },

    deleteCluster: (clusterId) => {
        const { clustersById } = get();
        if (!clustersById.has(clusterId)) return;

        const nextClustersById = new Map(clustersById);
        nextClustersById.delete(clusterId);

        set((state) => ({
            clustersById: nextClustersById,
            clusterIdsByNodeId: indexClustersByNode(nextClustersById),
            selectedClusterId: state.selectedClusterId === clusterId ? null : state.selectedClusterId,
        }));
    },

    openSingleNodeClusterPicker: (nodeId) => {
        set(() => ({
            clusterPickerContext: {
                sourceNodeId: nodeId,
                nodeIds: [nodeId],
                edgeIds: [],
            },
        }));
    },

    removeNodeFromCluster: (nodeId) => {
        const { clientGraph, clusterIdsByNodeId, clustersById } = get();
        const [clusterId] = Array.from(clusterIdsByNodeId.get(nodeId) ?? []);
        if (!clusterId) return;

        const nextClustersById = removeNodeFromClusterById(clustersById, clusterId, nodeId, clientGraph);

        set(() => ({
            clustersById: nextClustersById,
            clusterIdsByNodeId: indexClustersByNode(nextClustersById),
        }));
    },

    moveNodeToCluster: (nodeId, clusterId) => {
        const { clientGraph, clusterIdsByNodeId, clustersById } = get();
        if (!clustersById.has(clusterId)) return;

        const nextClustersById = moveNodeToClusterById(
            clustersById,
            clusterIdsByNodeId,
            clusterId,
            nodeId,
            clientGraph,
        );

        set(() => ({
            clustersById: nextClustersById,
            clusterIdsByNodeId: indexClustersByNode(nextClustersById),
            selectedClusterId: clusterId,
        }));
    },

    deleteSelectedCluster: () => {
        const { selectedClusterId, deleteCluster } = get();
        if (!selectedClusterId) return;

        deleteCluster(selectedClusterId);
        set(() => ({clusterContextMenu: null}));
    },

    deleteSelectedClusterNodes: () => {
        const { clustersById, deleteNode, selectedClusterId } = get();
        if (!selectedClusterId) return;

        const cluster = clustersById.get(selectedClusterId);
        if (!cluster) return;

        cluster.nodeIds.forEach((nodeId) => deleteNode(nodeId));
        set(() => ({clusterContextMenu: null}));
    },
//#endregion

//#region Seed node actions
    placeSeedNode: () => {
        const { sigma,
            setNodesToReload
        } = get();

        if (!sigma) return false;

        const graph = sigma.getGraph();
        
        if (!graph.hasNode("seedNode")) {
            graph.addNode("seedNode", { nodeId: "seedNode", x: 0, y: 0 });
        } 

        setNodesToReload(["seedNode"]);

        return true;
    },

    removeSeedNode: () => {
        const { sigma } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        if (graph.hasNode("seedNode")) {
            graph.dropNode("seedNode");
        }
    },

    replaceSeedNode: (node) => {
        const { sigma, clientGraph, appendGraphVersion } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        const seedAttributes = graph.hasNode("seedNode")
            ? graph.getNodeAttributes("seedNode")
            : { x: 0, y: 0 };

        if (graph.hasNode("seedNode")) {
            graph.dropNode("seedNode");
        }

        const clientNode = upsertVisibleNode(clientGraph, node);

        if (clientNode.deleted) {
            sigma.refresh();
            set(() => ({openedNode: null}));
            appendGraphVersion();
            return;
        }

        if (!clientNode.deleted && !graph.hasNode(node.nodeId)) {
            graph.addNode(node.nodeId, {
                ...seedAttributes,
                ...sigmaNodeAttributes(node),
            });
        }

        sigma.refresh();
        set(() => ({openedNode: node.nodeId}));
        appendGraphVersion();
    },
//#endregion

//#region Graph loading actions
    replaceGraph: (response) => {
        const { sigma } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        graph.clear();

        const clientGraph = createClientGraphModel();
        const nodeIdsToReload: string[] = [];

        response.nodes.forEach((node, index) => {
            const clientNode = upsertVisibleNode(clientGraph, node);
            const position = fullGraphNodePosition(index, response.nodes.length);

            if (!clientNode.deleted) {
                graph.addNode(node.nodeId, {
                    ...sigmaNodeAttributes(node),
                    ...position,
                    fixed: true,
                });
                nodeIdsToReload.push(node.nodeId);
            }
        });

        const visibleEdges: GraphEdge[] = [];
        response.edges.forEach((edge) => {
            const result = mergeIncomingEdge(clientGraph, edge);
            if (result.shouldAddToVisibleGraph) {
                visibleEdges.push(edge);
            }
        });
        addOrMergeVisualEdges(graph, visibleEdges);

        sigma.refresh();
        set((state) => ({
            activeOverlay: null,
            openedNode: null,
            openedEdge: null,
            hoveredNode: null,
            hoveredEdge: null,
            oneHopContext: null,
            clusterPickerContext: null,
            clustersById: new Map(),
            clusterIdsByNodeId: new Map(),
            selectedClusterId: null,
            clusterContextMenu: null,
            drawerState: null,
            selectedNodes: [],
            clientGraph,
            deletedGraph: createDeletedGraphArchive(),
            nodesToReload: [],
            nodesToResetCamera: nodeIdsToReload,
            isLayoutRunning: false,
            graphMode: "expand",
            graphVersion: state.graphVersion + 1,
        }));
    },

    expandGraphFromNode: (seedNodeId, response, includeSeedInLayout = false, focusCameraAfterExpand = true) => {
        const {
            sigma,
            clientGraph,
            setNodesToReload,
            setNodesToResetCamera,
            appendGraphVersion,
        } = get();

        if (!sigma) return;

        const graph = sigma.getGraph();
        if (!graph.hasNode(seedNodeId)) return;

        const seedNodeAttributes = graph.getNodeAttributes(seedNodeId);
        const baseX = seedNodeAttributes.x ?? 0;
        const baseY = seedNodeAttributes.y ?? 0;
        const radius = 2;
        const numberOfNodes = Math.max(response.nodes.length, 1);
        const finalSetOfNodes = new Set<string>();
        const visibleEdgesToMerge: GraphEdge[] = [];

        response.nodes.forEach((node, index) => {
            const result = mergeIncomingNode(clientGraph, node);
            if (!result.shouldAddToVisibleGraph) return;

            const angle = (Math.PI * 2 * index) / numberOfNodes;
            graph.addNode(node.nodeId, {
                ...sigmaNodeAttributes(node),
                x: baseX + Math.cos(angle) * radius,
                y: baseY + Math.sin(angle) * radius,
            });

            finalSetOfNodes.add(node.nodeId);
        });

        response.edges.forEach((edge) => {
            const result = mergeIncomingEdge(clientGraph, edge);
            if (result.shouldAddToVisibleGraph) {
                visibleEdgesToMerge.push(edge);
            }
        });

        addOrMergeVisualEdges(graph, visibleEdgesToMerge);

        if (includeSeedInLayout) {
            finalSetOfNodes.add(seedNodeId);
        }

        const expandedNodeIds = Array.from(finalSetOfNodes);

        setNodesToReload(expandedNodeIds);
        if (focusCameraAfterExpand) {
            setNodesToResetCamera([seedNodeId, ...expandedNodeIds]);
        }
        set(() => ({
            clientGraph,
            deletedGraph: getDeletedGraphArchive(clientGraph),
        }));
        appendGraphVersion();
    },
//#endregion

//#region Delete and restore actions
    deleteNode: (nodeId: string) => {
        const {
            sigma,
            clientGraph,
            clustersById,
        } = get();

        if (!sigma) return;

        const graph = sigma.getGraph();
        if (!graph.hasNode(nodeId)) return;

        saveNodeLayoutAttributes(clientGraph, nodeId, { ...graph.getNodeAttributes(nodeId) });
        const result = markNodeDeleted(clientGraph, nodeId);
        if (!result) return;
        const deletedEdgeIds = clientGraph.edgeIdsByNodeId.get(nodeId) ?? new Set<string>();
        const nextClustersById = removeNodeFromClusters(clustersById, nodeId, deletedEdgeIds);

        graph.dropNode(nodeId);

        set((state) => {
            return {
                clientGraph,
                deletedGraph: getDeletedGraphArchive(clientGraph),
                clustersById: nextClustersById,
                clusterIdsByNodeId: indexClustersByNode(nextClustersById),
                openedNode: state.openedNode === nodeId ? null : state.openedNode,
                graphVersion: state.graphVersion + 1,
            };
        });
    },

    returnNode: (deletedNodeId: string) => {
        const { sigma, clientGraph } = get();
        if (!sigma) return;

        const graph = sigma.getGraph();
        if (graph.hasNode(deletedNodeId)) return;

        const result = restoreNode(clientGraph, deletedNodeId);
        if (!result) return;

        graph.addNode(result.node.nodeId, {
            ...result.node.layoutAttributes,
            ...sigmaNodeAttributes(result.node),
        });
        addOrMergeVisualEdges(graph, result.visibleEdges);

        const neighborNodeIds = result.visibleEdges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]);
        const focusNodeIds = Array.from(new Set([deletedNodeId, ...neighborNodeIds]));

        set((state) => {
            return {
                clientGraph,
                deletedGraph: getDeletedGraphArchive(clientGraph),
                graphVersion: state.graphVersion + 1,
                nodesToReload: [deletedNodeId],
                nodesToResetCamera: focusNodeIds,
            };
        });
    },
//#endregion

//#region Version actions
    appendLayoutVersion: () => {
        set((state) => ({layoutVersion: state.layoutVersion + 1}));
    },

    appendGraphVersion: () => {
        set((state) => ({graphVersion: state.graphVersion + 1}))
    },
//#endregion
//#endregion
}));

//#region Hooks for getters
export const useSigmaInstance = () => useClientStore((state) => {
    return state.sigma;
});

export const useGraphMode = () => useClientStore((state) => {
    return state.graphMode;
});

export const useOpenedNode = () => useClientStore((state) => {
    return state.openedNode;
});

export const useActiveOverlay = () => useClientStore((state) => {
    return state.activeOverlay;
});

export const useOpenedEdge = () => useClientStore((state) => {
    return state.openedEdge;
});

export const useHoveredNode = () => useClientStore((state) => {
    return state.hoveredNode;
});

export const useHoveredEdge = () => useClientStore((state) => {
    return state.hoveredEdge;
});

export const useOneHopContext = () => useClientStore((state) => {
    return state.oneHopContext;
});

export const useShowHoveredNodeDetails = () => useClientStore((state) => {
    return state.showHoveredNodeDetails;
});

export const useShowHoveredEdgeDetails = () => useClientStore((state) => {
    return state.showHoveredEdgeDetails;
});

export const useFocusOnSelect = () => useClientStore((state) => {
    return state.focusOnSelect;
});

export const useClusterFocusOnSelect = () => useClientStore((state) => {
    return state.clusterFocusOnSelect;
});

export const useGrowNodesOnZoom = () => useClientStore((state) => {
    return state.growNodesOnZoom;
});

export const useDrawerState = () => useClientStore((state) => {
    return state.drawerState;
});

export const useNodesToReload = () => useClientStore((state) => {
    return state.nodesToReload;
});

export const useNodesToResetCamera = () => useClientStore((state) => {
    return state.nodesToResetCamera;
});

export const useLayoutVersion = () => useClientStore((state) => {
    return state.layoutVersion;
});

export const useGraphVersion = () => useClientStore((state) => {
    return state.graphVersion;
})

export const useIsLayoutRunning = () => useClientStore((state) => {
    return state.isLayoutRunning;
});

export const useIsNeedToBeReload = () => useClientStore((state) => {
    return state.isNeedToBeReload;
});

export const useDeletedGraph = () => useClientStore((state) => {
    return state.deletedGraph;
});

export const useDeletedNodes = () => useClientStore((state) => {
    return state.deletedGraph.nodesById;
});

export const useDeletedEdges = () => useClientStore((state) => {
    return state.deletedGraph.edgesById;
});

export const useClusterPickerContext = () => useClientStore((state) => {
    return state.clusterPickerContext;
});

export const useClusters = () => useClientStore((state) => {
    return state.clustersById;
});

export const useClusterIdsByNodeId = () => useClientStore((state) => {
    return state.clusterIdsByNodeId;
});

export const useSelectedClusterId = () => useClientStore((state) => {
    return state.selectedClusterId;
});

export const useClusterContextMenu = () => useClientStore((state) => {
    return state.clusterContextMenu;
});
//#endregion

//#region Hooks for setters
export const useSetSigma = () => useClientStore((state) => {
    return state.setSigma;
});

export const useSetGraphMode = () => useClientStore((state) => {
    return state.setGraphMode;
});

export const useSetActiveOverlay = () => useClientStore((state) => {
    return state.setActiveOverlay;
});

export const useSetOpenedNode = () => useClientStore((state) => {
    return state.setOpenedNode;
});

export const useSetOpenedEdge = () => useClientStore((state) => {
    return state.setOpenedEdge;
});

export const useSetHoveredNode = () => useClientStore((state) => {
    return state.setHoveredNode;
});

export const useSetHoveredEdge = () => useClientStore((state) => {
    return state.setHoveredEdge;
});

export const useSetShowHoveredNodeDetails = () => useClientStore((state) => {
    return state.setShowHoveredNodeDetails;
});

export const useSetShowHoveredEdgeDetails = () => useClientStore((state) => {
    return state.setShowHoveredEdgeDetails;
});

export const useSetFocusOnSelect = () => useClientStore((state) => {
    return state.setFocusOnSelect;
});

export const useSetClusterFocusOnSelect = () => useClientStore((state) => {
    return state.setClusterFocusOnSelect;
});

export const useSetGrowNodesOnZoom = () => useClientStore((state) => {
    return state.setGrowNodesOnZoom;
});

export const useSetDrawerState = () => useClientStore((state) => {
    return state.setDrawerState;
});

export const useSetNodesToReload = () => useClientStore((state) => {
    return state.setNodesToReload;
});

export const useSetAllNodesToReload = () => useClientStore((state) => {
    return state.setAllNodesToReload;
});

export const useSetNodesToResetCamera = () => useClientStore((state) => {
    return state.setNodesToResetCamera;
});

export const useSetAllNodesToResetCamera = () => useClientStore((state) => {
    return state.setAllNodesToResetCamera;
});

export const useSetIsLayoutRunning = () => useClientStore((state => {
    return state.setIsLayoutRunning;
}))

export const useSetIsNeedToBeReload = () => useClientStore((state) => {
    return state.setIsNeedToBeReload;
})

export const useSetSelectedCluster = () => useClientStore((state) => {
    return state.setSelectedCluster;
});

export const useSetClusterContextMenu = () => useClientStore((state) => {
    return state.setClusterContextMenu;
});

export const useGetGraphExcludeContext = () => useClientStore((state) => {
    return state.getGraphExcludeContext;
});

//#endregion

//#region Hooks for actions
export const usePlaceSeedNode = () => useClientStore((state) => {
    return state.placeSeedNode;
});

export const useRemoveSeedNode = () => useClientStore((state) => {
    return state.removeSeedNode;
});

export const useReplaceSeedNode = () => useClientStore((state) => {
    return state.replaceSeedNode;
});

export const useReplaceGraph = () => useClientStore((state) => {
    return state.replaceGraph;
});

export const useExpandGraphFromNode = () => useClientStore((state) => {
    return state.expandGraphFromNode;
});

export const useOpenExpandPreview = () => useClientStore((state) => {
    return state.openExpandPreview;
});

export const useOpenNodeInfo = () => useClientStore((state) => {
    return state.openNodeInfo;
});

export const useOpenEdgeInfo = () => useClientStore((state) => {
    return state.openEdgeInfo;
});

export const useCloseDrawer = () => useClientStore((state) => {
    return state.closeDrawer;
});

export const useOpenOneHopContext = () => useClientStore((state) => {
    return state.openOneHopContext;
});

export const useCloseOneHopContext = () => useClientStore((state) => {
    return state.closeOneHopContext;
});

export const useOpenClusterPickerFromOneHop = () => useClientStore((state) => {
    return state.openClusterPickerFromOneHop;
});

export const useCloseClusterPicker = () => useClientStore((state) => {
    return state.closeClusterPicker;
});

export const useCreateClusterFromPicker = () => useClientStore((state) => {
    return state.createClusterFromPicker;
});

export const useAddPickerContextToCluster = () => useClientStore((state) => {
    return state.addPickerContextToCluster;
});

export const useDeleteCluster = () => useClientStore((state) => {
    return state.deleteCluster;
});

export const useOpenSingleNodeClusterPicker = () => useClientStore((state) => {
    return state.openSingleNodeClusterPicker;
});

export const useRemoveNodeFromCluster = () => useClientStore((state) => {
    return state.removeNodeFromCluster;
});

export const useMoveNodeToCluster = () => useClientStore((state) => {
    return state.moveNodeToCluster;
});

export const useDeleteSelectedCluster = () => useClientStore((state) => {
    return state.deleteSelectedCluster;
});

export const useDeleteSelectedClusterNodes = () => useClientStore((state) => {
    return state.deleteSelectedClusterNodes;
});

export const useDeleteNode = () => useClientStore((state) => {
    return state.deleteNode;
});

export const useReturnNode = () => useClientStore((state) => {
    return state.returnNode;
});

export const useAppendLayoutVersion = () => useClientStore((state) => {
    return state.appendLayoutVersion;
})
//#endregion
