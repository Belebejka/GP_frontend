import { useQuery } from "@tanstack/react-query";
import { expandGraph, getExpandPreview, getMockRoots, searchGraph } from "./responses";
import type { GraphSearchRequest, ExpandRequest } from "./types";

export function useSearchGraphQuery(payload: GraphSearchRequest) {
    return useQuery({
        queryKey: ['graph-search', payload],
        queryFn: () => searchGraph(payload),
        enabled: payload.nodeId != "",
    });
}

export function useGetExpandPreviewQuery(payload: ExpandRequest) {
    return useQuery({
        queryKey: ['graph-expand-preview', payload],
        queryFn: () => getExpandPreview(payload),
        enabled: payload !== null,
    });
}

export function useExpandGraphQuery(payload: ExpandRequest) {
    return useQuery({
        queryKey: ['graph-expand', payload],
        queryFn: () => expandGraph(payload),
        enabled: payload.nodeIds[0] !== "",
    })
}

//#region Only mock
export function useGetMockRoots() {
    return useQuery({
        queryKey: ["mock-roots"],
        queryFn: () => getMockRoots(50),
    });
}
//#endregion