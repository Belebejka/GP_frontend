import { useSigma } from "@react-sigma/core";
import { useEffect, useRef } from "react";
import { useClusters, useGraphMode, useSelectedClusterId } from "../../../store/ClientStore";

export function ClusterHighlightController() {
    const sigma = useSigma();
    const graphMode = useGraphMode();
    const clustersById = useClusters();
    const selectedClusterId = useSelectedClusterId();
    const highlightedNodeIdsRef = useRef<string[]>([]);

    useEffect(() => {
        const graph = sigma.getGraph();
        const previousNodeIds = highlightedNodeIdsRef.current;
        const existingPreviousNodeIds = previousNodeIds.filter((nodeId) => graph.hasNode(nodeId));

        existingPreviousNodeIds.forEach((nodeId) => {
            graph.setNodeAttribute(nodeId, "highlighted", false);
        });

        if (graphMode !== "cluster") {
            highlightedNodeIdsRef.current = [];
            if (existingPreviousNodeIds.length > 0) {
                sigma.refresh({ partialGraph: { nodes: existingPreviousNodeIds } });
            }
            return;
        }

        const clusters = Array.from(clustersById.values());
        const visibleClusterNodeIds = clusters.flatMap((cluster) => cluster.nodeIds);
        const nextNodeIds = Array.from(new Set(visibleClusterNodeIds))
            .filter((nodeId) => graph.hasNode(nodeId));

        nextNodeIds.forEach((nodeId) => {
            graph.setNodeAttribute(nodeId, "highlighted", true);
        });

        highlightedNodeIdsRef.current = nextNodeIds;
        const nodesToRefresh = Array.from(new Set([...existingPreviousNodeIds, ...nextNodeIds]));

        if (nodesToRefresh.length === 0) return;

        sigma.refresh({
            partialGraph: {
                nodes: nodesToRefresh,
            },
        });

        return () => {
            const existingNextNodeIds = nextNodeIds.filter((nodeId) => graph.hasNode(nodeId));
            existingNextNodeIds.forEach((nodeId) => graph.setNodeAttribute(nodeId, "highlighted", false));

            if (existingNextNodeIds.length > 0) {
                sigma.refresh({ partialGraph: { nodes: existingNextNodeIds } });
            }
        };
    }, [clustersById, graphMode, selectedClusterId, sigma]);

    return null;
}
