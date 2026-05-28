export type NodeRef = {
    type: string
    value: string
}

export type Direction = "OUTBOUND" | "INBOUND" | "BOTH"

export type AttributeRangeFilter = {
    gte?: number
    lte?: number
}

export type AttributeFilterValue = {
    eq?: string | number | boolean | null
    in?: Array<string | number | boolean | null>
    gte?: number
    lte?: number
}

export type ExpandFilters = {
    relationFamilies?: string[]
    edgeTypes?: string[]
    nodeTypes?: string[]
    nodeAttributes?: Record<string, AttributeFilterValue>
    edgeAttributes?: Record<string, AttributeFilterValue>
}

export type ExpandExclude = {
    nodeIds?: string[]
    edgeIds?: string[]
}

export type ExpandRequest = {
    seeds: NodeRef[]
    relationFamily?: string
    edgeTypes?: string[]
    filters?: ExpandFilters
    exclude?: ExpandExclude
    direction: Direction
    maxNeighborsPerSeed?: number
    maxNodes?: number
    maxEdges?: number
    includeAttributes?: boolean
}

export type GraphNode = {
    nodeId: string
    nodeType?: string
    displayName: string
    identifiers?: Record<string, string>
    statuses?: string[]
    attributes: Record<string, unknown>
}

export type GraphEdge = {
    edgeId: string
    fromNodeId: string
    toNodeId: string
    type: string
    relationFamily?: string
    directed: boolean
    weight?: number
    sourceSystem?: string
    firstSeenAt?: string
    lastSeenAt?: string
    attributes: Record<string, unknown>
}

export type VisualGraphEdge = {
    edgeId: string
    fromNodeId: string
    toNodeId: string
    directed: boolean
    rawEdges: GraphEdge[]
    edgeCount: number
}

export type GraphResponse = {
    nodes: GraphNode[]
    edges: GraphEdge[]
    meta: Record<string, unknown>
}

export type ExpandData = {
    nodes: GraphNode[]
    edges: GraphEdge[]
}

export type ClientGraphNode = GraphNode & {
    deleted: boolean
    deletedAt?: number
    layoutAttributes?: Record<string, unknown>
}

export type ClientGraphEdge = GraphEdge & {
    deleted: boolean
    deletedAt?: number
}

export type ClientGraphModel = {
    nodesById: Map<string, ClientGraphNode>
    edgesById: Map<string, ClientGraphEdge>
    edgeIdsByNodeId: Map<string, Set<string>>
}

export type GraphNodeSearchMeta = {
    query: string
    nodeType: string | null
    limit: number
    returnedNodeCount: number
    truncated: boolean
}

export type GraphNodeSearchResponse = {
    nodes: GraphNode[]
    meta: GraphNodeSearchMeta
}

export type GraphFacetCount = {
    key: string
    count: number
}

export type GraphNodeSummary = {
    requestedDirection: Direction
    relationFamily: string
    adjacentEdgeCount: number
    uniqueNeighborCount: number
    outboundEdgeCount: number
    inboundEdgeCount: number
}

export type GraphExpandPreview = {
    defaultMaxNeighborsPerSeed: number
    defaultMaxNodes: number
    defaultMaxEdges: number
    wouldTruncateByNeighborBudget: boolean
}

export type GraphExpandPreviewSummary = {
    adjacentEdgeCount: number
    uniqueNeighborCount: number
    newNodeCount: number
    newEdgeCount: number
}

export type GraphExpandFacets = {
    relationFamilies: GraphFacetCount[]
    edgeTypes: GraphFacetCount[]
    neighborNodeTypes: GraphFacetCount[]
    nodeAttributes: Record<string, GraphFacetCount[]>
    edgeAttributes: Record<string, GraphFacetCount[]>
}

export type GraphExpandPreviewResponse = {
    summary: GraphExpandPreviewSummary
    facets: GraphExpandFacets
    expandPreview: GraphExpandPreview
}

export type GraphNodeSummaryResponse = {
    node: GraphNode
    summary: GraphNodeSummary
    relationFamilies: GraphFacetCount[]
    edgeTypes: GraphFacetCount[]
    neighborNodeTypes: GraphFacetCount[]
    expandPreview: GraphExpandPreview
}

export type DeletedGraphEdgeSnapshot = {
    edgeId: string
    fromNodeId: string
    toNodeId: string
    attributes: Record<string, unknown>
    deletedAt: number
}

export type DeletedGraphNodeSnapshot = {
    nodeId: string
    attributes: Record<string, unknown>
    deletedAt: number
}

export type DeletedGraphArchive = {
    nodesById: Map<string, DeletedGraphNodeSnapshot>
    edgesById: Map<string, DeletedGraphEdgeSnapshot>
    edgeIdsByNodeId: Map<string, Set<string>>
}

export type GraphCluster = {
    clusterId: string
    name: string
    color: string
    activeColor: string
    nodeIds: string[]
    edgeIds: string[]
    sourceNodeId?: string
    createdAt: number
    updatedAt: number
}

export type ClusterPickerContext = {
    sourceNodeId: string
    nodeIds: string[]
    edgeIds: string[]
    forceReplace?: boolean
}
