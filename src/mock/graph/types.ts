export type Attrs = Record<string, unknown>

export type MockNode = {
	nodeId: string
	entityType: string
	displayName: string
	attributes: Attrs
	ui?: {
		x: number
		y: number
		size?: number
		color?: string
	}
}

export type MockEdge = {
	edgeId: string
	source: string
	target: string
	edgeType: string
	relationFamily: string
	direction: 'OUTBOUND' | 'INBOUND' | 'UNDIRECTED'
	attributes: Attrs
}

export type BackendGraphNode = {
	nodeId: string
	nodeType: string
	displayName: string
	identifiers: Record<string, string>
	statuses: string[]
	attributes: Attrs
}

export type BackendGraphEdge = {
	edgeId: string
	fromNodeId: string
	toNodeId: string
	type: string
	relationFamily: string
	directed: boolean
	weight?: number
	sourceSystem?: string
	firstSeenAt?: string
	lastSeenAt?: string
	attributes: Attrs
}

export type GraphResponse = {
	nodes: BackendGraphNode[]
	edges: BackendGraphEdge[]
	meta: Record<string, unknown>
}

export type GraphNodeSearchResponse = {
	nodes: BackendGraphNode[]
	meta: {
		query: string
		nodeType: string | null
		limit: number
		returnedNodeCount: number
		truncated: boolean
	}
}

export type NodeRef = {
	type: string
	value: string
}

export type Direction = 'OUTBOUND' | 'INBOUND' | 'BOTH'

export type GraphFacetCount = {
	key: string
	count: number
}

export type GraphNodeSummaryResponse = {
	node: {
		nodeId: string
		nodeType: string
		displayName: string
		identifiers: Record<string, string>
		statuses: string[]
		attributes: Attrs
	}
	summary: {
		requestedDirection: Direction
		relationFamily: string
		adjacentEdgeCount: number
		uniqueNeighborCount: number
		outboundEdgeCount: number
		inboundEdgeCount: number
	}
	relationFamilies: GraphFacetCount[]
	edgeTypes: GraphFacetCount[]
	neighborNodeTypes: GraphFacetCount[]
	expandPreview: {
		defaultMaxNeighborsPerSeed: number
		defaultMaxNodes: number
		defaultMaxEdges: number
		wouldTruncateByNeighborBudget: boolean
	}
}

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
	exclude?: ExpandExclude
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

export type GraphExpandPreviewResponse = {
	summary: {
		adjacentEdgeCount: number
		uniqueNeighborCount: number
		newNodeCount: number
		newEdgeCount: number
	}
	facets: {
		relationFamilies: GraphFacetCount[]
		edgeTypes: GraphFacetCount[]
		neighborNodeTypes: GraphFacetCount[]
		nodeAttributes: Record<string, GraphFacetCount[]>
		edgeAttributes: Record<string, GraphFacetCount[]>
	}
	expandPreview: {
		defaultMaxNeighborsPerSeed: number
		defaultMaxNodes: number
		defaultMaxEdges: number
		wouldTruncateByNeighborBudget: boolean
	}
}
