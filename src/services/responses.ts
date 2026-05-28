import axios from "axios"
import type {
    Direction,
    ExpandData,
    ExpandRequest,
    GraphExpandPreviewResponse,
    GraphNodeSearchResponse,
    GraphNodeSummaryResponse,
    GraphResponse,
} from "../types";

const api = axios.create();

export function setApiBaseUrl(baseURL?: string) {
    api.defaults.baseURL = baseURL || undefined;
}

export type NodeSummaryOptions = {
    relationFamily?: string
    direction?: Direction
}

export async function getNodeSummary(nodeId: string, options: NodeSummaryOptions = {}): Promise<GraphNodeSummaryResponse> {
    const { data }: { data: GraphNodeSummaryResponse } = await api.get('/api/v1/graph/node-summary', {
        params: {
            nodeId,
            relationFamily: options.relationFamily,
            direction: options.direction ?? "BOTH",
        },
    });

    return data;
}

export async function expandGraph(payload: ExpandRequest) : Promise<ExpandData> {
    const { data } : {data: GraphResponse} = await api.post('/api/v1/graph/expand', payload);
    return {
        nodes: data.nodes,
        edges: data.edges
    };
}

export async function previewExpandGraph(payload: ExpandRequest): Promise<GraphExpandPreviewResponse> {
    const { data }: { data: GraphExpandPreviewResponse } = await api.post('/api/v1/graph/expand/preview', payload);
    return data;
}

export async function getFullGraph(): Promise<ExpandData> {
    const { data }: { data: GraphResponse } = await api.get('/api/v1/graph/full', {
        params: { includeAttributes: true },
    });

    return {
        nodes: data.nodes,
        edges: data.edges,
    };
}

export type SearchNodesOptions = {
    includeAttributes?: boolean
    limit?: number
    nodeType?: string
}

export async function searchNodes(query: string, options: SearchNodesOptions = {}): Promise<GraphNodeSearchResponse> {
    const { data }: { data: GraphNodeSearchResponse } = await api.get('/api/v1/graph/nodes/search', {
        params: {
            query,
            limit: options.limit ?? 10,
            nodeType: options.nodeType,
            includeAttributes: options.includeAttributes ?? false,
        },
    });

    return data;
}
