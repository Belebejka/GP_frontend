import type Graph from "graphology";
import type { Sigma } from "sigma";
import type { GraphEdge, GraphNode, VisualGraphEdge } from "../../types";

const visualEdgeKey = (edge: GraphEdge) => {
    if (edge.directed) {
        return `bundle:directed:${edge.fromNodeId}->${edge.toNodeId}`;
    }

    const [firstNodeId, secondNodeId] = [edge.fromNodeId, edge.toNodeId].sort();
    return `bundle:undirected:${firstNodeId}<->${secondNodeId}`;
};

const aggregateEdgesForVisualization = (edges: GraphEdge[]): VisualGraphEdge[] => {
    const visualEdgesById = new Map<string, VisualGraphEdge>();

    edges.forEach((edge) => {
        const edgeId = visualEdgeKey(edge);
        const existingEdge = visualEdgesById.get(edgeId);

        if (existingEdge) {
            existingEdge.rawEdges.push(edge);
            existingEdge.edgeCount = existingEdge.rawEdges.length;
            return;
        }

        visualEdgesById.set(edgeId, {
            edgeId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            directed: edge.directed,
            rawEdges: [edge],
            edgeCount: 1,
        });
    });

    return Array.from(visualEdgesById.values());
};

const mergeVisualEdge = (currentRawEdges: GraphEdge[], nextRawEdges: GraphEdge[]) => {
    const rawEdgesById = new Map<string, GraphEdge>();

    currentRawEdges.forEach((edge) => rawEdgesById.set(edge.edgeId, edge));
    nextRawEdges.forEach((edge) => rawEdgesById.set(edge.edgeId, edge));

    return Array.from(rawEdgesById.values());
};

const sigmaEdgeAttributes = (edge: VisualGraphEdge) => ({
    edgeCount: edge.edgeCount,
    rawEdges: edge.rawEdges,
    directed: edge.directed,
});

export const sigmaNodeAttributes = (node: GraphNode) => ({
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    displayName: node.displayName,
    identifiers: node.identifiers,
    statuses: node.statuses,
    attributes: node.attributes,
    rawNode: node,
});

export const setEdgeSelected = (graph: Graph, edgeId: string | null | undefined, selected: boolean) => {
    if (!edgeId || !graph.hasEdge(edgeId)) return;
    graph.setEdgeAttribute(edgeId, "selected", selected);
};

export const clearOneHopVisualization = (
    sigma: Sigma | null,
    oneHopContext: { nodeIds: string[]; edgeIds: string[] } | null,
) => {
    if (!sigma || !oneHopContext) return;

    const graph = sigma.getGraph();
    const existingNodeIds = oneHopContext.nodeIds.filter((nodeId) => graph.hasNode(nodeId));
    const existingEdgeIds = oneHopContext.edgeIds.filter((edgeId) => graph.hasEdge(edgeId));

    existingNodeIds.forEach((nodeId) => {
        graph.setNodeAttribute(nodeId, "highlighted", false);
    });
    existingEdgeIds.forEach((edgeId) => {
        graph.setEdgeAttribute(edgeId, "selected", false);
    });

    sigma.refresh({
        partialGraph: {
            nodes: existingNodeIds,
            edges: existingEdgeIds,
        },
    });
};

export const addOrMergeVisualEdges = (graph: Graph, edges: GraphEdge[]) => {
    aggregateEdgesForVisualization(edges).forEach((edge) => {
        if (!graph.hasNode(edge.fromNodeId) || !graph.hasNode(edge.toNodeId)) return;

        const existingEdgeId = graph.hasEdge(edge.edgeId)
            ? edge.edgeId
            : graph.edge(edge.fromNodeId, edge.toNodeId)
                ?? graph.edge(edge.toNodeId, edge.fromNodeId);

        if (existingEdgeId) {
            const currentRawEdges = graph.getEdgeAttribute(existingEdgeId, "rawEdges") as GraphEdge[] | undefined;
            const rawEdges = mergeVisualEdge(currentRawEdges ?? [], edge.rawEdges);

            graph.mergeEdgeAttributes(existingEdgeId, {
                edgeCount: rawEdges.length,
                rawEdges,
                directed: edge.directed,
            });
            return;
        }

        graph.addDirectedEdgeWithKey(edge.edgeId, edge.fromNodeId, edge.toNodeId, sigmaEdgeAttributes(edge));
    });
};

export const fullGraphNodePosition = (index: number, total: number) => {
    const safeTotal = Math.max(total, 1);
    const columns = Math.ceil(Math.sqrt(safeTotal));
    const rows = Math.ceil(safeTotal / columns);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const gap = 80;

    return {
        x: (column - (columns - 1) / 2) * gap,
        y: (row - (rows - 1) / 2) * gap,
    };
};
