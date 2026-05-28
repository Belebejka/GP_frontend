import { useMutation, useQuery } from "@tanstack/react-query";
import { expandGraph, getFullGraph, getNodeSummary, previewExpandGraph, searchNodes, type NodeSummaryOptions, type SearchNodesOptions } from "./responses";

export function useGetNodeSummaryQuery(nodeId: string, options: NodeSummaryOptions = {}, enabled = true) {
    return useQuery({
        queryKey: ['graph-node-summary', nodeId, options.relationFamily, options.direction],
        queryFn: () => getNodeSummary(nodeId, options),
        enabled: enabled && nodeId.trim().length > 0,
    });
}

export function useExpandGraphMutation() {
    return useMutation({
        mutationFn: expandGraph,
    })
}

export function usePreviewExpandGraphMutation() {
    return useMutation({
        mutationFn: previewExpandGraph,
    })
}

export function useFullGraphMutation() {
    return useMutation({
        mutationFn: getFullGraph,
    })
}

export function useSearchNodesQuery(query: string) {
    return useQuery({
        queryKey: ['graph-nodes-search', query],
        queryFn: () => searchNodes(query, { includeAttributes: false, limit: 10 }),
        enabled: query.trim().length > 0,
    });
}

export function useSearchNodesMutation() {
    return useMutation({
        mutationFn: ({ query, options }: { query: string; options?: SearchNodesOptions }) => searchNodes(query, options),
    });
}
