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
	relationFamily: string
	direction: 'OUTBOUND' | 'INBOUND' | 'UNDIRECTED'
	attributes: Attrs
}

export type GraphResponse = {
	nodes: MockNode[]
	edges: MockEdge[]
	meta: Record<string, unknown>
}

export type NodeRef = {
	type: string
	value: string
}

export type ExpandFilters = {
	entityTypes?: string[]
	relationFamilies?: string[]
	excludeNodeIds?: string[]
}

export type SearchRequest = {
	nodeId: string
	maxNeighbors?: number
}

export type ExpandRequest = {
	nodeIds: string[]
	maxNeighborsPerSeed?: number
	filters?: ExpandFilters
}