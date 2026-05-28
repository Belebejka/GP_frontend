import type {
    ClientGraphEdge,
    ClientGraphModel,
    ClientGraphNode,
    DeletedGraphArchive,
    DeletedGraphEdgeSnapshot,
    DeletedGraphNodeSnapshot,
    GraphEdge,
    GraphNode,
} from "../types";

export const createClientGraphModel = (): ClientGraphModel => ({
    nodesById: new Map(),
    edgesById: new Map(),
    edgeIdsByNodeId: new Map(),
});

export const createDeletedGraphArchive = (): DeletedGraphArchive => ({
    nodesById: new Map(),
    edgesById: new Map(),
    edgeIdsByNodeId: new Map(),
});

const indexEdge = (model: ClientGraphModel, edge: GraphEdge) => {
    const indexNode = (nodeId: string) => {
        const edgeIds = model.edgeIdsByNodeId.get(nodeId) ?? new Set<string>();
        edgeIds.add(edge.edgeId);
        model.edgeIdsByNodeId.set(nodeId, edgeIds);
    };

    indexNode(edge.fromNodeId);
    indexNode(edge.toNodeId);
};

export const mergeIncomingNode = (model: ClientGraphModel, node: GraphNode) => {
    const existingNode = model.nodesById.get(node.nodeId);

    if (existingNode) {
        model.nodesById.set(node.nodeId, {
            ...existingNode,
            ...node,
            deleted: existingNode.deleted,
            deletedAt: existingNode.deletedAt,
        });

        return {
            node: model.nodesById.get(node.nodeId)!,
            shouldAddToVisibleGraph: false,
        };
    }

    const nextNode: ClientGraphNode = {
        ...node,
        deleted: false,
    };

    model.nodesById.set(node.nodeId, nextNode);

    return {
        node: nextNode,
        shouldAddToVisibleGraph: true,
    };
};

export const upsertVisibleNode = (model: ClientGraphModel, node: GraphNode) => {
    const existingNode = model.nodesById.get(node.nodeId);
    const nextNode: ClientGraphNode = {
        ...existingNode,
        ...node,
        deleted: existingNode?.deleted ?? false,
        deletedAt: existingNode?.deletedAt,
    };

    model.nodesById.set(node.nodeId, nextNode);
    return nextNode;
};

export const mergeIncomingEdge = (model: ClientGraphModel, edge: GraphEdge) => {
    const existingEdge = model.edgesById.get(edge.edgeId);

    if (existingEdge) {
        return {
            edge: existingEdge,
            shouldAddToVisibleGraph: false,
        };
    }

    const sourceNode = model.nodesById.get(edge.fromNodeId);
    const targetNode = model.nodesById.get(edge.toNodeId);
    const deleted = sourceNode?.deleted === true || targetNode?.deleted === true;

    const nextEdge: ClientGraphEdge = {
        ...edge,
        deleted,
        deletedAt: deleted ? Date.now() : undefined,
    };

    model.edgesById.set(edge.edgeId, nextEdge);
    indexEdge(model, edge);

    return {
        edge: nextEdge,
        shouldAddToVisibleGraph: !deleted && Boolean(sourceNode) && Boolean(targetNode),
    };
};

export const markNodeDeleted = (model: ClientGraphModel, nodeId: string) => {
    const node = model.nodesById.get(nodeId);
    if (!node || node.deleted) return null;

    const deletedAt = Date.now();

    model.nodesById.set(nodeId, {
        ...node,
        deleted: true,
        deletedAt,
    });

    const incidentEdgeIds = model.edgeIdsByNodeId.get(nodeId) ?? new Set<string>();

    incidentEdgeIds.forEach((edgeId) => {
        const edge = model.edgesById.get(edgeId);
        if (!edge) return;

        model.edgesById.set(edgeId, {
            ...edge,
            deleted: true,
            deletedAt,
        });
    });

    return {
        nodeId,
        deletedAt,
    };
};

export const saveNodeLayoutAttributes = (
    model: ClientGraphModel,
    nodeId: string,
    layoutAttributes: Record<string, unknown>,
) => {
    const node = model.nodesById.get(nodeId);
    if (!node) return;

    model.nodesById.set(nodeId, {
        ...node,
        layoutAttributes,
    });
};

export const restoreNode = (model: ClientGraphModel, nodeId: string) => {
    const node = model.nodesById.get(nodeId);
    if (!node || !node.deleted) return null;

    const restoredNode: ClientGraphNode = {
        ...node,
        deleted: false,
        deletedAt: undefined,
    };

    model.nodesById.set(nodeId, restoredNode);

    const visibleEdges: ClientGraphEdge[] = [];
    const incidentEdgeIds = model.edgeIdsByNodeId.get(nodeId) ?? new Set<string>();

    incidentEdgeIds.forEach((edgeId) => {
        const edge = model.edgesById.get(edgeId);
        if (!edge) return;

        const sourceNode = model.nodesById.get(edge.fromNodeId);
        const targetNode = model.nodesById.get(edge.toNodeId);

        if (!sourceNode || !targetNode || sourceNode.deleted || targetNode.deleted) {
            return;
        }

        const restoredEdge: ClientGraphEdge = {
            ...edge,
            deleted: false,
            deletedAt: undefined,
        };

        model.edgesById.set(edge.edgeId, restoredEdge);
        visibleEdges.push(restoredEdge);
    });

    return {
        node: restoredNode,
        visibleEdges,
    };
};

export const getDeletedGraphArchive = (model: ClientGraphModel): DeletedGraphArchive => {
    const nodesById = new Map<string, DeletedGraphNodeSnapshot>();
    const edgesById = new Map<string, DeletedGraphEdgeSnapshot>();
    const edgeIdsByNodeId = new Map<string, Set<string>>();

    model.nodesById.forEach((node) => {
        if (!node.deleted) return;

        nodesById.set(node.nodeId, {
            nodeId: node.nodeId,
            attributes: { ...node },
            deletedAt: node.deletedAt ?? 0,
        });
    });

    model.edgesById.forEach((edge) => {
        if (!edge.deleted) return;

        edgesById.set(edge.edgeId, {
            edgeId: edge.edgeId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            attributes: { ...edge },
            deletedAt: edge.deletedAt ?? 0,
        });

        const indexNode = (nodeId: string) => {
            const edgeIds = edgeIdsByNodeId.get(nodeId) ?? new Set<string>();
            edgeIds.add(edge.edgeId);
            edgeIdsByNodeId.set(nodeId, edgeIds);
        };

        indexNode(edge.fromNodeId);
        indexNode(edge.toNodeId);
    });

    return {
        nodesById,
        edgesById,
        edgeIdsByNodeId,
    };
};
