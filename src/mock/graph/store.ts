import type {
    AttributeFilterValue,
    BackendGraphEdge,
    BackendGraphNode,
    ExpandFilters,
    ExpandRequest,
    GraphExpandPreviewResponse,
    GraphNodeSummaryResponse,
    GraphResponse,
    GraphNodeSearchResponse,
    MockEdge,
    MockNode,
    Direction,
} from './types'

type World = {
    nodesById: Map<string, MockNode>
    edgesById: Map<string, MockEdge>
    edgeIdsByNodeId: Map<string, string[]>
    rootNodeIds: string[]
}

type ExpansionSelection = {
    neighborNodeIds: string[]
    frontierEdgeIds: string[]
}

type ExpansionCandidate = {
    neighborNodeId: string
    frontierEdgeId: string
}

const ENTITY_TYPES = ['PERSON', 'COMPANY', 'ACCOUNT', 'LOAN', 'MEDIUM'] as const
type EntityType = (typeof ENTITY_TYPES)[number]

const world = buildWorld({
    seed: Number(import.meta.env.VITE_MOCK_GRAPH_SEED ?? 20260406),
    totalNodes: Number(import.meta.env.VITE_MOCK_GRAPH_NODES ?? 3000),
    rootCount: Number(import.meta.env.VITE_MOCK_GRAPH_ROOTS ?? 100),
})

export function searchNodes(
    query: string,
    nodeType?: string | null,
    limit = 20,
    includeAttributes = true,
): GraphNodeSearchResponse {
    const normalizedQuery = query.trim().toLowerCase()
    const normalizedNodeType = nodeType?.trim().toUpperCase() || null
    const effectiveLimit = Math.min(Math.max(limit, 1), 100)

    if (!normalizedQuery) {
        return {
            nodes: [],
            meta: {
                query: '',
                nodeType: normalizedNodeType,
                limit: effectiveLimit,
                returnedNodeCount: 0,
                truncated: false,
            },
        }
    }

    const matches = [...world.nodesById.values()]
        .filter((node) => !normalizedNodeType || node.entityType === normalizedNodeType)
        .map((node) => ({
            node,
            rank: getNodeSearchRank(node, normalizedQuery),
        }))
        .filter((item) => item.rank !== null)
        .sort((left, right) =>
            left.rank! - right.rank!
            || left.node.displayName.localeCompare(right.node.displayName)
            || left.node.nodeId.localeCompare(right.node.nodeId),
        )

    const nodes = matches.slice(0, effectiveLimit).map((item) => toBackendNode(item.node, includeAttributes))

    return {
        nodes,
        meta: {
            query: query.trim(),
            nodeType: normalizedNodeType,
            limit: effectiveLimit,
            returnedNodeCount: nodes.length,
            truncated: matches.length > effectiveLimit,
        },
    }
}

export function getNodeSummary(
    nodeId: string,
    relationFamily: string | null = null,
    direction: Direction = 'BOTH',
): GraphNodeSummaryResponse | null {
    const node = world.nodesById.get(nodeId)
    if (!node) return null

    const resolvedRelationFamily = relationFamily?.trim() || 'ALL_RELATIONS'
    const matchingEdges = (world.edgeIdsByNodeId.get(nodeId) ?? [])
        .map((edgeId) => world.edgesById.get(edgeId))
        .filter((edge): edge is MockEdge => Boolean(edge))
        .filter((edge) => resolvedRelationFamily === 'ALL_RELATIONS' || edge.relationFamily === resolvedRelationFamily)
        .filter((edge) => matchesDirection(edge, nodeId, direction))

    const neighborNodeIds = new Set<string>()
    const relationFamilies = new Map<string, number>()
    const edgeTypes = new Map<string, number>()
    const neighborNodeTypes = new Map<string, number>()
    let outboundEdgeCount = 0
    let inboundEdgeCount = 0

    for (const edge of matchingEdges) {
        const neighborNodeId = edge.source === nodeId ? edge.target : edge.source
        const neighborNode = world.nodesById.get(neighborNodeId)

        neighborNodeIds.add(neighborNodeId)
        incrementFacet(relationFamilies, edge.relationFamily)
        incrementFacet(edgeTypes, edge.edgeType)

        if (neighborNode) {
            incrementFacet(neighborNodeTypes, neighborNode.entityType)
        }

        if (edge.source === nodeId) outboundEdgeCount += 1
        if (edge.target === nodeId) inboundEdgeCount += 1
    }

    return {
        node: toBackendNode(node, true),
        summary: {
            requestedDirection: direction,
            relationFamily: resolvedRelationFamily,
            adjacentEdgeCount: matchingEdges.length,
            uniqueNeighborCount: neighborNodeIds.size,
            outboundEdgeCount,
            inboundEdgeCount,
        },
        relationFamilies: mapToFacetCounts(relationFamilies),
        edgeTypes: mapToFacetCounts(edgeTypes),
        neighborNodeTypes: mapToFacetCounts(neighborNodeTypes),
        expandPreview: {
            defaultMaxNeighborsPerSeed: 50,
            defaultMaxNodes: 300,
            defaultMaxEdges: 500,
            wouldTruncateByNeighborBudget: matchingEdges.length > 50,
        },
    }
}

export function expandFromNode(req: ExpandRequest): GraphResponse {
    const seedNodeId = resolveSeedNodeId(req.seeds?.[0])
    const filters = requestToFilters(req)
    const direction = req.direction ?? 'BOTH'
    const includeAttributes = req.includeAttributes ?? true

    if (!seedNodeId || !world.nodesById.has(seedNodeId)) {
        return {
            nodes: [],
            edges: [],
            meta: {
                source: 'MSW',
                candidateEdgeCount: 0,
                warnings: ['Seed node not found'],
            },
        }
    }

    const maxNodes = req.maxNodes ?? 300
    const maxEdges = req.maxEdges ?? 500
    const maxNeighbors = Math.max(0, Math.min(req.maxNeighborsPerSeed ?? 50, maxNodes))

    const selection = selectExpansion(seedNodeId, filters, direction, maxNeighbors)

    const responseNodeIds = uniqueIds([seedNodeId, ...selection.neighborNodeIds]).slice(0, maxNodes)
    const responseNodeIdSet = new Set(responseNodeIds)
    const responseEdgeIds = selection.frontierEdgeIds
        .filter((edgeId) => {
            const edge = world.edgesById.get(edgeId)
            if (!edge) return false

            const hasSource = responseNodeIdSet.has(edge.source)
            const hasTarget = responseNodeIdSet.has(edge.target)

            return hasSource && hasTarget
        })
        .slice(0, maxEdges)

    return {
        nodes: mapNodeIdsToBackendNodes(responseNodeIds, includeAttributes),
        edges: mapEdgeIdsToBackendEdges(responseEdgeIds, includeAttributes),
        meta: {
            source: 'MSW',
            rankingStrategy: 'MOCK_DETERMINISTIC',
            candidateEdgeCount: responseEdgeIds.length,
            warnings: [],
        },
    }
}

export function getFullGraph(includeAttributes = true): GraphResponse {
    const nodeIds = [...world.nodesById.keys()]
    const edgeIds = [...world.edgesById.keys()]

    return {
        nodes: mapNodeIdsToBackendNodes(nodeIds, includeAttributes),
        edges: mapEdgeIdsToBackendEdges(edgeIds, includeAttributes),
        meta: {
            source: 'MSW',
            returnedNodeCount: nodeIds.length,
            returnedEdgeCount: edgeIds.length,
            truncated: false,
        },
    }
}

function selectExpansion(
    seedNodeId: string,
    filters: ExpandFilters = {},
    direction: Direction,
    limit = 50,
): ExpansionSelection {
    const candidates = collectExpansionCandidates(seedNodeId, filters, direction).slice(0, limit)

    return {
        neighborNodeIds: candidates.map((candidate) => candidate.neighborNodeId),
        frontierEdgeIds: candidates.map((candidate) => candidate.frontierEdgeId),
    }
}

export function previewExpandFromNode(req: ExpandRequest): GraphExpandPreviewResponse {
    const seedNodeId = resolveSeedNodeId(req.seeds?.[0])
    const filters = requestToFilters(req)
    const direction = req.direction ?? 'BOTH'
    const maxNeighborsPerSeed = req.maxNeighborsPerSeed ?? 1000
    const maxNodes = req.maxNodes ?? 1000
    const maxEdges = req.maxEdges ?? 2000

    if (!seedNodeId || !world.nodesById.has(seedNodeId)) {
        return {
            summary: {
                adjacentEdgeCount: 0,
                uniqueNeighborCount: 0,
                newNodeCount: 0,
                newEdgeCount: 0,
            },
            facets: {
                relationFamilies: [],
                edgeTypes: [],
                neighborNodeTypes: [],
                nodeAttributes: {},
                edgeAttributes: {},
            },
            expandPreview: {
                defaultMaxNeighborsPerSeed: maxNeighborsPerSeed,
                defaultMaxNodes: maxNodes,
                defaultMaxEdges: maxEdges,
                wouldTruncateByNeighborBudget: false,
            },
        }
    }

    const candidates = collectExpansionCandidates(seedNodeId, filters, direction)
    const uniqueNeighborNodeIds = uniqueIds(candidates.map((candidate) => candidate.neighborNodeId))
    const excludedNodeIds = new Set(req.exclude?.nodeIds ?? [])
    const excludedEdgeIds = new Set(req.exclude?.edgeIds ?? [])
    const newNodeIds = uniqueNeighborNodeIds.filter((nodeId) => !excludedNodeIds.has(nodeId))
    const newEdgeIds = uniqueIds(candidates.map((candidate) => candidate.frontierEdgeId))
        .filter((edgeId) => !excludedEdgeIds.has(edgeId))

    return {
        summary: {
            adjacentEdgeCount: candidates.length,
            uniqueNeighborCount: uniqueNeighborNodeIds.length,
            newNodeCount: newNodeIds.length,
            newEdgeCount: newEdgeIds.length,
        },
        facets: {
            relationFamilies: toCandidateFacetCounts(candidates, (candidate) => world.edgesById.get(candidate.frontierEdgeId)?.relationFamily),
            edgeTypes: toCandidateFacetCounts(candidates, (candidate) => world.edgesById.get(candidate.frontierEdgeId)?.edgeType),
            neighborNodeTypes: toCandidateFacetCounts(candidates, (candidate) => world.nodesById.get(candidate.neighborNodeId)?.entityType),
            nodeAttributes: {},
            edgeAttributes: {},
        },
        expandPreview: {
            defaultMaxNeighborsPerSeed: maxNeighborsPerSeed,
            defaultMaxNodes: maxNodes,
            defaultMaxEdges: maxEdges,
            wouldTruncateByNeighborBudget: uniqueNeighborNodeIds.length > maxNeighborsPerSeed,
        },
    }
}

function collectExpansionCandidates(
    seedNodeId: string,
    filters: ExpandFilters = {},
    direction: Direction,
): ExpansionCandidate[] {
    const edgeIds = world.edgeIdsByNodeId.get(seedNodeId) ?? []
    const seenNodeIds = new Set<string>()
    const candidates: ExpansionCandidate[] = []

    for (const edgeId of edgeIds) {
        const edge = world.edgesById.get(edgeId)
        if (!edge) continue

        if (!matchesDirection(edge, seedNodeId, direction)) {
            continue
        }

        const otherNodeId = edge.source === seedNodeId ? edge.target : edge.source

        if (filters.exclude?.nodeIds?.includes(otherNodeId)) {
            continue
        }

        const otherNode = world.nodesById.get(otherNodeId)
        if (!otherNode) continue

        if (seenNodeIds.has(otherNodeId)) {
            continue
        }

        const candidate = {
            neighborNodeId: otherNodeId,
            frontierEdgeId: edgeId,
        }

        if (!passesCandidateFilters(candidate, filters)) {
            continue
        }

        seenNodeIds.add(otherNodeId)
        candidates.push(candidate)
    }

    return candidates
}

function passesRelationFamilyFilter(edge: MockEdge, filters: ExpandFilters = {}) {
    if (!filters.relationFamilies?.length) {
        return true
    }

    return filters.relationFamilies.includes(edge.relationFamily)
}

function passesEdgeTypeFilter(edge: MockEdge, filters: ExpandFilters = {}) {
    if (!filters.edgeTypes?.length) {
        return true
    }

    return filters.edgeTypes.includes(edge.edgeType)
}

function passesCandidateFilters(candidate: ExpansionCandidate, filters: ExpandFilters = {}) {
    const node = world.nodesById.get(candidate.neighborNodeId)
    const edge = world.edgesById.get(candidate.frontierEdgeId)

    if (!node || !edge) return false

    if (!passesRelationFamilyFilter(edge, filters)) {
        return false
    }

    if (!passesEdgeTypeFilter(edge, filters)) {
        return false
    }

    if (filters.nodeTypes?.length && !filters.nodeTypes.includes(node.entityType)) {
        return false
    }

    if (!passesAttributeFilters(node.attributes, filters.nodeAttributes)) {
        return false
    }

    return passesAttributeFilters(edge.attributes, filters.edgeAttributes)
}

function passesAttributeFilters(attrs: Record<string, unknown>, filters?: Record<string, AttributeFilterValue>) {
    if (!filters) return true

    for (const [key, filter] of Object.entries(filters)) {
        if (!matchesAttributeFilter(attrs[key], filter)) {
            return false
        }
    }

    return true
}

function matchesAttributeFilter(value: unknown, filter: AttributeFilterValue) {
    if (filter.eq !== undefined && value !== filter.eq) {
        return false
    }
    if (filter.in?.length && !filter.in.includes(value as string | number | boolean | null)) {
        return false
    }
    if (filter.gte !== undefined || filter.lte !== undefined) {
        if (typeof value !== 'number') return false
        if (typeof filter.gte === 'number' && value < filter.gte) return false
        if (typeof filter.lte === 'number' && value > filter.lte) return false
    }
    return true
}

function incrementFacet(map: Map<string, number>, value: string) {
    map.set(value, (map.get(value) ?? 0) + 1)
}

function mapToFacetCounts(map: Map<string, number>) {
    return [...map.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
}

function matchesDirection(edge: MockEdge, nodeId: string, direction: Direction) {
    if (direction === 'BOTH') return true
    if (direction === 'OUTBOUND') return edge.source === nodeId || edge.direction === 'UNDIRECTED'
    return edge.target === nodeId || edge.direction === 'UNDIRECTED'
}

function resolveSeedNodeId(seed?: { type: string; value: string }) {
    if (!seed) return ''

    const normalizedType = seed.type.trim().toUpperCase()
    const value = seed.value.trim()

    if (normalizedType === 'NODE_ID') {
        return value
    }

    const match = [...world.nodesById.values()].find((node) => {
        if (node.nodeId === value) return true

        return Object.entries(buildIdentifiers(node)).some(([key, identifierValue]) => (
            key.toUpperCase() === normalizedType && identifierValue === value
        ))
    })

    return match?.nodeId ?? value
}

function requestToFilters(req: ExpandRequest): ExpandFilters {
    const relationFamily = req.relationFamily?.trim()
    const edgeTypes = req.edgeTypes?.filter(Boolean)

    return {
        ...req.filters,
        exclude: req.exclude,
        relationFamilies: req.filters?.relationFamilies?.length
            ? req.filters.relationFamilies
            : relationFamily && relationFamily !== 'ALL_RELATIONS'
            ? [relationFamily]
            : undefined,
        edgeTypes: req.filters?.edgeTypes?.length ? req.filters.edgeTypes : edgeTypes?.length ? edgeTypes : undefined,
    }
}

function toCandidateFacetCounts(candidates: ExpansionCandidate[], classifier: (candidate: ExpansionCandidate) => string | undefined) {
    const map = new Map<string, number>()
    candidates.forEach((candidate) => {
        const value = classifier(candidate)
        if (!value) return
        incrementFacet(map, value)
    })
    return mapToFacetCounts(map)
}

function mapNodeIdsToNodes(nodeIds: string[]) {
    return nodeIds.map((nodeId) => world.nodesById.get(nodeId)).filter(Boolean) as MockNode[]
}

function mapNodeIdsToBackendNodes(nodeIds: string[], includeAttributes: boolean) {
    return mapNodeIdsToNodes(nodeIds).map((node) => toBackendNode(node, includeAttributes))
}

function toBackendNode(node: MockNode, includeAttributes: boolean): BackendGraphNode {
    return {
        nodeId: node.nodeId,
        nodeType: node.entityType,
        displayName: node.displayName,
        identifiers: buildIdentifiers(node),
        statuses: buildStatuses(node),
        attributes: includeAttributes ? node.attributes : {},
    }
}

function buildIdentifiers(node: MockNode) {
    const identifiers: Record<string, string> = {
        node_id: node.nodeId,
    }

    for (const [key, value] of Object.entries(node.attributes)) {
        if (key.endsWith('_rk') || key.endsWith('_id') || ['account_no', 'loan_id', 'medium_id'].includes(key)) {
            identifiers[key] = String(value)
        }
    }

    return identifiers
}

function buildStatuses(node: MockNode) {
    const statuses: string[] = []
    const riskLevel = node.attributes.riskLevel

    if (node.attributes.isBlocked === true) {
        statuses.push('BLACKLIST')
    }

    if (node.attributes.isVip === true || node.attributes.accountLevel === 'VIP') {
        statuses.push('VIP')
    }

    if (riskLevel === 'HIGH') {
        statuses.push('HIGH_RISK')
    }

    return [...new Set(statuses)]
}

function mapEdgeIdsToEdges(edgeIds: string[]) {
    return edgeIds.map((edgeId) => world.edgesById.get(edgeId)).filter(Boolean) as MockEdge[]
}

function mapEdgeIdsToBackendEdges(edgeIds: string[], includeAttributes: boolean) {
    return mapEdgeIdsToEdges(edgeIds).map((edge) => toBackendEdge(edge, includeAttributes))
}

function toBackendEdge(edge: MockEdge, includeAttributes: boolean): BackendGraphEdge {
    const timestamp = typeof edge.attributes.timestamp === 'string'
        ? edge.attributes.timestamp
        : undefined
    const eventTs = typeof edge.attributes.event_ts === 'number'
        ? new Date(edge.attributes.event_ts).toISOString()
        : timestamp
    const strength = edge.attributes.strengthScore ?? edge.attributes.strength ?? edge.attributes.ratio

    return {
        edgeId: edge.edgeId,
        fromNodeId: edge.source,
        toNodeId: edge.target,
        type: edge.edgeType,
        relationFamily: edge.relationFamily,
        directed: edge.direction !== 'UNDIRECTED',
        weight: typeof strength === 'number' ? strength : undefined,
        sourceSystem: 'MSW',
        firstSeenAt: eventTs,
        lastSeenAt: eventTs,
        attributes: includeAttributes ? edge.attributes : {},
    }
}

function getNodeSearchRank(node: MockNode, normalizedQuery: string) {
    const values = [
        node.nodeId,
        node.displayName,
        node.entityType,
        ...Object.values(node.attributes).map((value) => String(value)),
    ].map((value) => value.toLowerCase())

    if (values.some((value) => value === normalizedQuery)) return 0
    if (values.some((value) => value.startsWith(normalizedQuery))) return 1
    if (values.some((value) => value.includes(normalizedQuery))) return 2

    return null
}

function uniqueIds(ids: string[]) {
    return [...new Set(ids)]
}

function buildWorld(config: { seed: number; totalNodes: number; rootCount: number }): World {
    const rng = mulberry32(config.seed)
    const nodesById = new Map<string, MockNode>()
    const edgesById = new Map<string, MockEdge>()
    const edgeIdsByNodeId = new Map<string, string[]>()
    const idsByType = new Map<EntityType, string[]>()

    for (const type of ENTITY_TYPES) {
        idsByType.set(type, [])
    }

    for (let i = 1; i <= config.rootCount; i++) {
        const node = makeNode('PERSON', i, rng)
        nodesById.set(node.nodeId, node)
        idsByType.get('PERSON')!.push(node.nodeId)
    }

    for (let i = config.rootCount + 1; i <= config.totalNodes; i++) {
        const type = pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 38 },
            { value: 'PERSON', weight: 20 },
            { value: 'COMPANY', weight: 10 },
            { value: 'LOAN', weight: 14 },
            { value: 'MEDIUM', weight: 18 },
        ] satisfies { value: EntityType; weight: number }[])
        const seq = (idsByType.get(type)?.length ?? 0) + 1
        const node = makeNode(type, seq, rng)
        nodesById.set(node.nodeId, node)
        idsByType.get(type)!.push(node.nodeId)
    }

    const allNodes = [...nodesById.values()]
    const seenEdges = new Set<string>()

    for (const sourceNode of allNodes) {
        const sourceType = sourceNode.entityType as EntityType
        const degree = sampleDegree(rng)

        for (let i = 0; i < degree; i++) {
            const targetType = pickTargetType(sourceType, rng)
            const targetIds = idsByType.get(targetType) ?? []
            if (!targetIds.length) continue

            const targetId = targetIds[randomInt(rng, 0, targetIds.length - 1)]
            if (!targetId || targetId === sourceNode.nodeId) continue

            const relation = inferRelation(sourceType, targetType, rng)
            const eventTime = randomTimestamp(rng)
            const edgeId = `${relation.edgeType}:${sourceNode.nodeId}:${targetId}:${eventTime}`

            if (seenEdges.has(edgeId)) continue
            seenEdges.add(edgeId)

            const edge: MockEdge = {
                edgeId,
                source: sourceNode.nodeId,
                target: targetId,
                edgeType: relation.edgeType,
                relationFamily: relation.relationFamily,
                direction: relation.directed ? 'OUTBOUND' : 'UNDIRECTED',
                attributes: makeEdgeAttributes(relation.edgeType, relation.relationFamily, eventTime, rng),
            }

            edgesById.set(edge.edgeId, edge)
            pushEdge(edgeIdsByNodeId, edge.source, edge.edgeId)
            pushEdge(edgeIdsByNodeId, edge.target, edge.edgeId)
        }
    }

    return {
        nodesById,
        edgesById,
        edgeIdsByNodeId,
        rootNodeIds: idsByType.get('PERSON')!.slice(0, config.rootCount),
    }
}

function pushEdge(map: Map<string, string[]>, nodeId: string, edgeId: string) {
    const current = map.get(nodeId)
    if (current) current.push(edgeId)
    else map.set(nodeId, [edgeId])
}

function makeNode(type: EntityType, seq: number, rng: () => number): MockNode {
    const id = `${type}_${String(seq).padStart(6, '0')}`

    return {
        nodeId: id,
        entityType: type,
        displayName: `${type} ${seq}`,
        attributes: makeNodeAttributes(type, seq, rng),
        ui: {
            x: Math.round((rng() * 2000 - 1000) * 100) / 100,
            y: Math.round((rng() * 2000 - 1000) * 100) / 100,
            size: 10 + Math.floor(rng() * 8),
        },
    }
}

function makeNodeAttributes(type: EntityType, seq: number, rng: () => number) {
    if (type === 'PERSON') {
        return {
            person_id: `FB_PERSON_ID_${String(seq).padStart(8, '0')}`,
            party_rk: `FB_PARTY_${String(seq).padStart(8, '0')}`,
            name: `Person ${seq}`,
            gender: pickWeighted(rng, [
                { value: 'FEMALE', weight: 49 },
                { value: 'MALE', weight: 49 },
                { value: 'UNKNOWN', weight: 2 },
            ]),
            birthday: randomDate(rng, 1950, 2004),
            country: pickCountry(rng),
            city: pickCity(rng),
            isBlocked: rng() > 0.93,
            isVip: rng() > 0.96,
        }
    }

    if (type === 'COMPANY') {
        return {
            company_id: `FB_COMPANY_${String(seq).padStart(8, '0')}`,
            name: `Company ${seq}`,
            business: pickWeighted(rng, [
                { value: 'TRADE', weight: 26 },
                { value: 'FINANCE', weight: 20 },
                { value: 'LOGISTICS', weight: 18 },
                { value: 'IT', weight: 18 },
                { value: 'OTHER', weight: 18 },
            ]),
            description: `FinBench company ${seq}`,
            url: `https://company-${seq}.example.test`,
            country: pickCountry(rng),
            city: pickCity(rng),
            isBlocked: rng() > 0.95,
        }
    }

    if (type === 'ACCOUNT') {
        return {
            account_no: `FB_ACCOUNT_${String(seq).padStart(8, '0')}`,
            nickname: `Account ${seq}`,
            accountType: pickWeighted(rng, [
                { value: 'CHECKING', weight: 50 },
                { value: 'SAVINGS', weight: 25 },
                { value: 'CARD', weight: 15 },
                { value: 'BUSINESS', weight: 10 },
            ]),
            phone: `+7${String(9000000000 + seq).slice(-10)}`,
            email: `account${seq}@example.test`,
            accountLevel: pickWeighted(rng, [
                { value: 'BASIC', weight: 55 },
                { value: 'STANDARD', weight: 30 },
                { value: 'PREMIUM', weight: 12 },
                { value: 'VIP', weight: 3 },
            ]),
            balance: randomInt(rng, 0, 8_000_000),
            currency: pickWeighted(rng, [
                { value: 'RUB', weight: 70 },
                { value: 'USD', weight: 15 },
                { value: 'EUR', weight: 15 },
            ]),
            isBlocked: rng() > 0.96,
        }
    }

    if (type === 'LOAN') {
        return {
            loan_id: `FB_LOAN_${String(seq).padStart(8, '0')}`,
            loanAmount: randomInt(rng, 50_000, 12_000_000),
            balance: randomInt(rng, 0, 10_000_000),
            purpose: pickWeighted(rng, [
                { value: 'CONSUMER', weight: 35 },
                { value: 'MORTGAGE', weight: 20 },
                { value: 'BUSINESS', weight: 25 },
                { value: 'AUTO', weight: 20 },
            ]),
            interestRate: Math.round((4 + rng() * 24) * 100) / 100,
        }
    }

    return {
        medium_id: `FB_MEDIUM_${String(seq).padStart(8, '0')}`,
        mediumType: pickWeighted(rng, [
            { value: 'IP', weight: 35 },
            { value: 'POS', weight: 20 },
            { value: 'MAC', weight: 15 },
            { value: 'PHONE', weight: 20 },
            { value: 'DEVICE', weight: 10 },
        ]),
        location: pickCity(rng),
        lastLoginAt: randomTimestamp(rng),
        riskLevel: pickWeighted(rng, [
            { value: 'LOW', weight: 60 },
            { value: 'MEDIUM', weight: 28 },
            { value: 'HIGH', weight: 12 },
        ]),
        isBlocked: rng() > 0.97,
    }
}

function makeEdgeAttributes(edgeType: string, relationFamily: string, timestamp: string, rng: () => number) {
    const base = {
        benchmark: 'LDBC FinBench',
        relation: edgeType,
        relationFamily,
        timestamp,
        strengthScore: Math.round((0.45 + rng() * 0.55) * 100) / 100,
    }

    if (['TRANSFERS_TO', 'WITHDRAWS_TO', 'DEPOSITS_TO', 'REPAYS'].includes(edgeType)) {
        return {
            ...base,
            amount: randomInt(rng, 1_000, 900_000),
            ordernumber: `ORD-${randomInt(rng, 100000, 999999)}`,
            comment: pickWeighted(rng, [
                { value: 'invoice payment', weight: 30 },
                { value: 'cash movement', weight: 20 },
                { value: 'loan operation', weight: 20 },
                { value: 'goods payment', weight: 30 },
            ]),
            payType: pickWeighted(rng, [
                { value: 'CARD', weight: 35 },
                { value: 'WIRE', weight: 30 },
                { value: 'SBP', weight: 25 },
                { value: 'CASH', weight: 10 },
            ]),
            goodsType: pickWeighted(rng, [
                { value: 'SERVICES', weight: 40 },
                { value: 'GOODS', weight: 35 },
                { value: 'FINANCE', weight: 15 },
                { value: 'UNKNOWN', weight: 10 },
            ]),
        }
    }

    if (edgeType === 'SIGNED_IN_WITH') {
        return {
            ...base,
            location: pickCity(rng),
        }
    }

    if (edgeType === 'INVESTS_IN') {
        return {
            ...base,
            ratio: Math.round(rng() * 10000) / 10000,
        }
    }

    if (edgeType === 'APPLIES_FOR') {
        return {
            ...base,
            organization: pickWeighted(rng, [
                { value: 'Acme Bank', weight: 35 },
                { value: 'Northwind Credit', weight: 25 },
                { value: 'Contoso Finance', weight: 25 },
                { value: 'Fabrikam Loans', weight: 15 },
            ]),
        }
    }

    if (edgeType === 'GUARANTEES') {
        return {
            ...base,
            relationship: pickWeighted(rng, [
                { value: 'FAMILY', weight: 28 },
                { value: 'BUSINESS_PARTNER', weight: 28 },
                { value: 'EMPLOYER', weight: 16 },
                { value: 'UNKNOWN', weight: 28 },
            ]),
        }
    }

    return base
}

function pickTargetType(sourceType: EntityType, rng: () => number): EntityType {
    if (sourceType === 'PERSON') {
        return pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 32 },
            { value: 'LOAN', weight: 18 },
            { value: 'COMPANY', weight: 18 },
            { value: 'PERSON', weight: 22 },
            { value: 'MEDIUM', weight: 10 },
        ])
    }

    if (sourceType === 'COMPANY') {
        return pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 32 },
            { value: 'LOAN', weight: 20 },
            { value: 'COMPANY', weight: 28 },
            { value: 'MEDIUM', weight: 20 },
        ])
    }

    if (sourceType === 'ACCOUNT') {
        return pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 68 },
            { value: 'LOAN', weight: 32 },
        ])
    }

    if (sourceType === 'LOAN') {
        return pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 92 },
            { value: 'COMPANY', weight: 8 },
        ])
    }

    return pickWeighted(rng, [
        { value: 'ACCOUNT', weight: 88 },
        { value: 'PERSON', weight: 6 },
        { value: 'COMPANY', weight: 6 },
    ])
}

function inferRelation(sourceType: EntityType, targetType: EntityType, rng: () => number) {
    if ((sourceType === 'PERSON' || sourceType === 'COMPANY') && targetType === 'ACCOUNT') {
        return { edgeType: 'OWNS', relationFamily: 'CUSTOMER_OWNERSHIP', directed: true }
    }

    if (sourceType === 'ACCOUNT' && targetType === 'ACCOUNT') {
        return {
            edgeType: pickWeighted(rng, [
                { value: 'TRANSFERS_TO', weight: 78 },
                { value: 'WITHDRAWS_TO', weight: 22 },
            ]),
            relationFamily: 'ACCOUNT_FLOW',
            directed: true,
        }
    }

    if ((sourceType === 'PERSON' || sourceType === 'COMPANY') && targetType === 'LOAN') {
        return { edgeType: 'APPLIES_FOR', relationFamily: 'LOAN_APPLICATION', directed: true }
    }

    if (sourceType === 'LOAN' && targetType === 'ACCOUNT') {
        return { edgeType: 'DEPOSITS_TO', relationFamily: 'LOAN_FLOW', directed: true }
    }

    if (sourceType === 'ACCOUNT' && targetType === 'LOAN') {
        return { edgeType: 'REPAYS', relationFamily: 'LOAN_FLOW', directed: true }
    }

    if (sourceType === 'MEDIUM' && targetType === 'ACCOUNT') {
        return { edgeType: 'SIGNED_IN_WITH', relationFamily: 'SHARED_INFRASTRUCTURE', directed: true }
    }

    if (sourceType === targetType && (sourceType === 'PERSON' || sourceType === 'COMPANY')) {
        return {
            edgeType: 'GUARANTEES',
            relationFamily: sourceType === 'PERSON' ? 'PERSON_GUARANTEE_PERSON' : 'COMPANY_GUARANTEE_COMPANY',
            directed: true,
        }
    }

    if ((sourceType === 'PERSON' || sourceType === 'COMPANY') && targetType === 'COMPANY') {
        return { edgeType: 'INVESTS_IN', relationFamily: 'INVESTMENT', directed: true }
    }

    return { edgeType: 'RELATED_TO', relationFamily: 'OTHER', directed: true }
}

function pickCountry(rng: () => number) {
    return pickWeighted(rng, [
        { value: 'RU', weight: 52 },
        { value: 'KZ', weight: 14 },
        { value: 'AM', weight: 10 },
        { value: 'BY', weight: 12 },
        { value: 'GE', weight: 12 },
    ])
}

function pickCity(rng: () => number) {
    return pickWeighted(rng, [
        { value: 'Moscow', weight: 30 },
        { value: 'Saint Petersburg', weight: 18 },
        { value: 'Kazan', weight: 14 },
        { value: 'Almaty', weight: 12 },
        { value: 'Yerevan', weight: 10 },
        { value: 'Tbilisi', weight: 8 },
        { value: 'Minsk', weight: 8 },
    ])
}

function randomDate(rng: () => number, startYear: number, endYear: number) {
    const year = randomInt(rng, startYear, endYear)
    const month = String(randomInt(rng, 1, 12)).padStart(2, '0')
    const day = String(randomInt(rng, 1, 28)).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function randomTimestamp(rng: () => number) {
    const now = Date.now()
    const windowMs = 180 * 24 * 60 * 60 * 1000
    return new Date(now - Math.floor(rng() * windowMs)).toISOString()
}

function sampleDegree(rng: () => number) {
    const p = rng()
    if (p < 0.8) return randomInt(rng, 1, 4)
    if (p < 0.95) return randomInt(rng, 5, 12)
    return randomInt(rng, 20, 60)
}

function pickWeighted<T extends string>(rng: () => number, items: { value: T; weight: number }[]): T {
    const total = items.reduce((acc, item) => acc + item.weight, 0)
    let roll = rng() * total

    for (const item of items) {
        roll -= item.weight
        if (roll <= 0) return item.value
    }

    return items[items.length - 1].value
}

function randomInt(rng: () => number, min: number, max: number) {
    return Math.floor(rng() * (max - min + 1)) + min
}

function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
