import type { ClientGraphModel, GraphCluster } from "../../types";

const CLUSTER_COLOR_PALETTE = [
    { color: "#23598f", activeColor: "#7ec3ff" },
    { color: "#6d3f93", activeColor: "#d39bff" },
    { color: "#9a642f", activeColor: "#ffc06f" },
    { color: "#24734a", activeColor: "#72eca5" },
    { color: "#923b3f", activeColor: "#ff8b8f" },
    { color: "#19727a", activeColor: "#6df4ff" },
    { color: "#8f7930", activeColor: "#ffe06d" },
    { color: "#7c4a90", activeColor: "#eca0ff" },
] as const;

export const getClusterColors = (index: number) => {
    return CLUSTER_COLOR_PALETTE[index % CLUSTER_COLOR_PALETTE.length];
};

export const createClusterId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return `cluster-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const unionStringArrays = (first: string[], second: string[]) => {
    return Array.from(new Set([...first, ...second]));
};

export const getAvailableClusterItems = (
    clusterIdsByNodeId: Map<string, Set<string>>,
    targetClusterId: string,
    nodeIds: string[],
    edgeIds: string[],
) => {
    return {
        nodeIds: nodeIds.filter((nodeId) => {
            const clusterIds = clusterIdsByNodeId.get(nodeId);
            return !clusterIds || clusterIds.size === 0 || clusterIds.has(targetClusterId);
        }),
        edgeIds,
    };
};

export const removeItemsFromOtherClusters = (
    clustersById: Map<string, GraphCluster>,
    targetClusterId: string,
    nodeIds: string[],
    edgeIds: string[],
) => {
    const nodeIdSet = new Set(nodeIds);
    const edgeIdSet = new Set(edgeIds);
    const nextClustersById = new Map<string, GraphCluster>();

    clustersById.forEach((cluster, clusterId) => {
        if (clusterId === targetClusterId) {
            nextClustersById.set(clusterId, cluster);
            return;
        }

        nextClustersById.set(clusterId, {
            ...cluster,
            nodeIds: cluster.nodeIds.filter((nodeId) => !nodeIdSet.has(nodeId)),
            edgeIds: cluster.edgeIds.filter((edgeId) => !edgeIdSet.has(edgeId)),
            updatedAt: Date.now(),
        });
    });

    return nextClustersById;
};

export const removeNodeFromClusters = (
    clustersById: Map<string, GraphCluster>,
    deletedNodeId: string,
    deletedEdgeIds: Iterable<string>,
) => {
    const deletedEdgeIdSet = new Set(deletedEdgeIds);
    const nextClustersById = new Map<string, GraphCluster>();

    clustersById.forEach((cluster, clusterId) => {
        nextClustersById.set(clusterId, {
            ...cluster,
            nodeIds: cluster.nodeIds.filter((nodeId) => nodeId !== deletedNodeId),
            edgeIds: cluster.edgeIds.filter((edgeId) => !deletedEdgeIdSet.has(edgeId)),
            updatedAt: Date.now(),
        });
    });

    return nextClustersById;
};

const getIncidentClusterEdgeIds = (cluster: GraphCluster, nodeId: string, clientGraph: ClientGraphModel) => {
    const incidentEdgeIds = clientGraph.edgeIdsByNodeId.get(nodeId) ?? new Set<string>();
    const clusterEdgeIds = new Set(cluster.edgeIds);

    return Array.from(incidentEdgeIds).filter((edgeId) => clusterEdgeIds.has(edgeId));
};

export const removeNodeFromClusterById = (
    clustersById: Map<string, GraphCluster>,
    clusterId: string,
    nodeId: string,
    clientGraph: ClientGraphModel,
) => {
    const cluster = clustersById.get(clusterId);
    if (!cluster) return clustersById;

    const incidentEdgeIds = new Set(getIncidentClusterEdgeIds(cluster, nodeId, clientGraph));
    const nextClustersById = new Map(clustersById);

    nextClustersById.set(clusterId, {
        ...cluster,
        nodeIds: cluster.nodeIds.filter((clusterNodeId) => clusterNodeId !== nodeId),
        edgeIds: cluster.edgeIds.filter((edgeId) => !incidentEdgeIds.has(edgeId)),
        updatedAt: Date.now(),
    });

    return nextClustersById;
};

export const moveNodeToClusterById = (
    clustersById: Map<string, GraphCluster>,
    clusterIdsByNodeId: Map<string, Set<string>>,
    targetClusterId: string,
    nodeId: string,
    clientGraph: ClientGraphModel,
) => {
    let nextClustersById = new Map(clustersById);

    Array.from(clusterIdsByNodeId.get(nodeId) ?? []).forEach((clusterId) => {
        if (clusterId === targetClusterId) return;
        nextClustersById = removeNodeFromClusterById(nextClustersById, clusterId, nodeId, clientGraph);
    });

    const targetCluster = nextClustersById.get(targetClusterId);
    if (!targetCluster) return nextClustersById;

    nextClustersById.set(targetClusterId, {
        ...targetCluster,
        nodeIds: unionStringArrays(targetCluster.nodeIds, [nodeId]),
        updatedAt: Date.now(),
    });

    return nextClustersById;
};

export const indexClustersByNode = (clustersById: Map<string, GraphCluster>) => {
    const clusterIdsByNodeId = new Map<string, Set<string>>();

    clustersById.forEach((cluster) => {
        cluster.nodeIds.forEach((nodeId) => {
            const clusterIds = clusterIdsByNodeId.get(nodeId) ?? new Set<string>();
            clusterIds.add(cluster.clusterId);
            clusterIdsByNodeId.set(nodeId, clusterIds);
        });
    });

    return clusterIdsByNodeId;
};
