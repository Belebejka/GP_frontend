export type NodeRef = {
    type: string
    value: string
}

export type GraphSearchRequest = {
    nodeId: string
    maxNeighbors?: number
}

export type ExpandRequest = {
    nodeIds: string[]
    maxNeighborsPerSeed?: number
    filters?: Record<string, unknown>
}

export type GraphNode = {
    nodeId: string
    entityType: string
    displayName: string
    attributes: Record<string, unknown>
}

export type GraphEdge = {
    edgeId: string
    source: string
    target: string
    relationFamily: string
    attributes: Record<string, unknown>
}

export type GraphResponse = {
    nodes: GraphNode[]
    edges: GraphEdge[]
    meta: Record<string, unknown>
}