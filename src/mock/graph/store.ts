import type { ExpandFilters, ExpandRequest, GraphResponse, MockEdge, MockNode, SearchRequest } from './types'

type World = {
    nodesById: Map<string, MockNode>
    edgesById: Map<string, MockEdge>
    edgeIdsByNodeId: Map<string, string[]>
    rootNodeIds: string[]
}

type DeliveredSubgraph = {
    nodeIds: Set<string>
    edgeIds: Set<string>
}

type ExpansionSelection = {
    neighborNodeIds: string[]
    frontierEdgeIds: string[]
}

const ENTITY_TYPES = ['PARTY', 'ACCOUNT', 'CARD', 'DEVICE', 'PHONE', 'COMPANY'] as const
type EntityType = (typeof ENTITY_TYPES)[number]

const world = buildWorld({
    seed: Number(import.meta.env.VITE_MOCK_GRAPH_SEED ?? 20260406),
    totalNodes: Number(import.meta.env.VITE_MOCK_GRAPH_NODES ?? 3000),
    rootCount: Number(import.meta.env.VITE_MOCK_GRAPH_ROOTS ?? 100),
})

const deliveredSubgraph = createDeliveredSubgraph()

export function getRoots(limit = 20) {
    return world.rootNodeIds.slice(0, limit).map((id) => world.nodesById.get(id)!).filter(Boolean)
}

export function searchById(req: SearchRequest): GraphResponse {
    const seedNodeId = req.nodeId

    if (!seedNodeId || !world.nodesById.has(seedNodeId)) {
        return {
            nodes: [],
            edges: [],
            meta: {
                source: 'MSW',
                hop: 1,
                seedNodeId,
                warnings: ['Seed node not found'],
            },
        }
    }

    const selection = selectExpansion(seedNodeId, {}, req.maxNeighbors ?? 20, {
        excludeDeliveredNodes: true,
    })

    const responseNodeIds = buildIncrementalResponseNodeIds(seedNodeId, selection.neighborNodeIds)
    const responseEdgeIds = collectIncrementalEdgeIds(responseNodeIds, {})

    markNodesAsDelivered(responseNodeIds)
    markEdgesAsDelivered(responseEdgeIds)

    return {
        nodes: mapNodeIdsToNodes(responseNodeIds),
        edges: mapEdgeIdsToEdges(responseEdgeIds),
        meta: {
            source: 'MSW',
            hop: 1,
            seedNodeId,
            candidateEdgeCount: responseEdgeIds.length,
            deliveredNodeCount: deliveredSubgraph.nodeIds.size,
            deliveredEdgeCount: deliveredSubgraph.edgeIds.size,
            warnings: [],
        },
    }
}

export function getExpandPreview(req: ExpandRequest) {
    const seedNodeId = req.nodeIds[0]

    if (!seedNodeId || !world.nodesById.has(seedNodeId)) {
        return {
            seedNodeId,
            totalNeighbors: 0,
            availableFilters: {
                entityTypes: [],
                relationFamilies: [],
            },
            meta: {
                source: 'MSW',
                candidateEdgeCount: 0,
                warnings: ['Seed node not found'],
            },
        }
    }

    const selection = selectExpansion(seedNodeId, req.filters, req.maxNeighborsPerSeed ?? 50, {
        excludeDeliveredNodes: true,
    })

    const responseNodeIds = buildIncrementalResponseNodeIds(seedNodeId, selection.neighborNodeIds)
    const candidateEdgeIds = collectIncrementalEdgeIds(responseNodeIds, req.filters)

    const byEntityType = new Map<string, number>()
    const byRelationFamily = new Map<string, number>()

    for (const nodeId of selection.neighborNodeIds) {
        const node = world.nodesById.get(nodeId)
        if (!node) continue
        byEntityType.set(node.entityType, (byEntityType.get(node.entityType) ?? 0) + 1)
    }

    for (const edgeId of selection.frontierEdgeIds) {
        const edge = world.edgesById.get(edgeId)
        if (!edge) continue
        byRelationFamily.set(edge.relationFamily, (byRelationFamily.get(edge.relationFamily) ?? 0) + 1)
    }

    return {
        seedNodeId,
        totalNeighbors: selection.neighborNodeIds.length,
        availableFilters: {
            entityTypes: [...byEntityType.entries()].map(([value, count]) => ({ value, count })),
            relationFamilies: [...byRelationFamily.entries()].map(([value, count]) => ({ value, count })),
        },
        meta: {
            source: 'MSW',
            candidateEdgeCount: candidateEdgeIds.length,
            deliveredNodeCount: deliveredSubgraph.nodeIds.size,
            deliveredEdgeCount: deliveredSubgraph.edgeIds.size,
            warnings: [],
        },
    }
}

export function expandFromNode(req: ExpandRequest): GraphResponse {
    const seedNodeId = req.nodeIds[0]

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

    const selection = selectExpansion(seedNodeId, req.filters, req.maxNeighborsPerSeed ?? 50, {
        excludeDeliveredNodes: true,
    })

    const responseNodeIds = buildIncrementalResponseNodeIds(seedNodeId, selection.neighborNodeIds)
    const responseEdgeIds = collectIncrementalEdgeIds(responseNodeIds, req.filters)

    markNodesAsDelivered(responseNodeIds)
    markEdgesAsDelivered(responseEdgeIds)

    return {
        nodes: mapNodeIdsToNodes(responseNodeIds),
        edges: mapEdgeIdsToEdges(responseEdgeIds),
        meta: {
            source: 'MSW',
            rankingStrategy: 'MOCK_DETERMINISTIC',
            candidateEdgeCount: responseEdgeIds.length,
            deliveredNodeCount: deliveredSubgraph.nodeIds.size,
            deliveredEdgeCount: deliveredSubgraph.edgeIds.size,
            warnings: [],
        },
    }
}

function selectExpansion(
    seedNodeId: string,
    filters: ExpandFilters = {},
    limit = 50,
    options: { excludeDeliveredNodes: boolean },
): ExpansionSelection {
    const edgeIds = world.edgeIdsByNodeId.get(seedNodeId) ?? []
    const seenNodeIds = new Set<string>()
    const neighborNodeIds: string[] = []
    const frontierEdgeIds: string[] = []

    for (const edgeId of edgeIds) {
        const edge = world.edgesById.get(edgeId)
        if (!edge) continue

        if (!passesRelationFamilyFilter(edge, filters)) {
            continue
        }

        const otherNodeId = edge.source === seedNodeId ? edge.target : edge.source

        if (filters.excludeNodeIds?.includes(otherNodeId)) {
            continue
        }

        if (options.excludeDeliveredNodes && deliveredSubgraph.nodeIds.has(otherNodeId)) {
            continue
        }

        const otherNode = world.nodesById.get(otherNodeId)
        if (!otherNode) continue

        if (filters.entityTypes?.length && !filters.entityTypes.includes(otherNode.entityType)) {
            continue
        }

        if (seenNodeIds.has(otherNodeId)) {
            continue
        }

        seenNodeIds.add(otherNodeId)
        neighborNodeIds.push(otherNodeId)
        frontierEdgeIds.push(edgeId)

        if (neighborNodeIds.length >= limit) {
            break
        }
    }

    return {
        neighborNodeIds,
        frontierEdgeIds,
    }
}

function buildIncrementalResponseNodeIds(seedNodeId: string, newNeighborNodeIds: string[]) {
    const responseNodeIds: string[] = []

    if (!deliveredSubgraph.nodeIds.has(seedNodeId)) {
        responseNodeIds.push(seedNodeId)
    }

    for (const nodeId of newNeighborNodeIds) {
        if (!deliveredSubgraph.nodeIds.has(nodeId)) {
            responseNodeIds.push(nodeId)
        }
    }

    return uniqueIds(responseNodeIds)
}

function collectEdgeIdsWithinNodeSet(nodeIds: Set<string>) {
    const result = new Set<string>()

    for (const nodeId of nodeIds) {
        const edgeIds = world.edgeIdsByNodeId.get(nodeId) ?? []

        for (const edgeId of edgeIds) {
            const edge = world.edgesById.get(edgeId)
            if (!edge) continue

            if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
                result.add(edgeId)
            }
        }
    }

    return [...result].sort()
}

function collectIncrementalEdgeIds(responseNodeIds: string[], filters: ExpandFilters = {}) {
    const responseNodeIdSet = new Set(responseNodeIds)
    const knownNodeIds = new Set(deliveredSubgraph.nodeIds)

    for (const nodeId of responseNodeIds) {
        knownNodeIds.add(nodeId)
    }

    const result = new Set<string>()

    for (const nodeId of responseNodeIdSet) {
        const edgeIds = world.edgeIdsByNodeId.get(nodeId) ?? []

        for (const edgeId of edgeIds) {
            if (deliveredSubgraph.edgeIds.has(edgeId)) {
                continue
            }

            const edge = world.edgesById.get(edgeId)
            if (!edge) continue

            if (!passesRelationFamilyFilter(edge, filters)) {
                continue
            }

            if (knownNodeIds.has(edge.source) && knownNodeIds.has(edge.target)) {
                result.add(edgeId)
            }
        }
    }

    return [...result].sort()
}

function passesRelationFamilyFilter(edge: MockEdge, filters: ExpandFilters = {}) {
    if (!filters.relationFamilies?.length) {
        return true
    }

    return filters.relationFamilies.includes(edge.relationFamily)
}

function markNodesAsDelivered(nodeIds: string[]) {
    for (const nodeId of nodeIds) {
        deliveredSubgraph.nodeIds.add(nodeId)
    }
}

function markEdgesAsDelivered(edgeIds: string[]) {
    for (const edgeId of edgeIds) {
        deliveredSubgraph.edgeIds.add(edgeId)
    }
}

function mapNodeIdsToNodes(nodeIds: string[]) {
    return nodeIds.map((nodeId) => world.nodesById.get(nodeId)).filter(Boolean) as MockNode[]
}

function mapEdgeIdsToEdges(edgeIds: string[]) {
    return edgeIds.map((edgeId) => world.edgesById.get(edgeId)).filter(Boolean) as MockEdge[]
}

function uniqueIds(ids: string[]) {
    return [...new Set(ids)]
}

function createDeliveredSubgraph(): DeliveredSubgraph {
    return {
        nodeIds: new Set<string>(),
        edgeIds: new Set<string>(),
    }
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
        const node = makeNode('PARTY', i, rng)
        nodesById.set(node.nodeId, node)
        idsByType.get('PARTY')!.push(node.nodeId)
    }

    for (let i = config.rootCount + 1; i <= config.totalNodes; i++) {
        const type = pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 30 },
            { value: 'CARD', weight: 15 },
            { value: 'DEVICE', weight: 15 },
            { value: 'PHONE', weight: 15 },
            { value: 'COMPANY', weight: 10 },
            { value: 'PARTY', weight: 15 },
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

            const relationFamily = inferRelation(sourceType, targetType)
            const edgeId = `${relationFamily}:${sourceNode.nodeId}:${targetId}`

            if (seenEdges.has(edgeId)) continue
            seenEdges.add(edgeId)

            const edge: MockEdge = {
                edgeId,
                source: sourceNode.nodeId,
                target: targetId,
                relationFamily,
                direction: 'OUTBOUND',
                attributes: makeEdgeAttributes(relationFamily, rng),
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
        rootNodeIds: idsByType.get('PARTY')!.slice(0, config.rootCount),
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
    if (type === 'PARTY') {
        return {
            party_rk: `PRK_${String(seq).padStart(8, '0')}`,
            risk_score: Math.floor(rng() * 100),
            residency: pickWeighted(rng, [
                { value: 'RU', weight: 50 },
                { value: 'KZ', weight: 15 },
                { value: 'AM', weight: 10 },
                { value: 'BY', weight: 15 },
                { value: 'GE', weight: 10 },
            ]),
        }
    }

    if (type === 'ACCOUNT') {
        return {
            account_rk: `ARK_${String(seq).padStart(8, '0')}`,
            balance: Math.floor(rng() * 5_000_000),
            currency: pickWeighted(rng, [
                { value: 'RUB', weight: 60 },
                { value: 'USD', weight: 20 },
                { value: 'EUR', weight: 20 },
            ]),
        }
    }

    if (type === 'CARD') {
        return {
            card_rk: `CRD_${String(seq).padStart(8, '0')}`,
            masked_pan: `2200****${String(1000 + seq).slice(-4)}`,
            status: pickWeighted(rng, [
                { value: 'ACTIVE', weight: 80 },
                { value: 'BLOCKED', weight: 20 },
            ]),
        }
    }

    if (type === 'DEVICE') {
        return {
            device_id: `DEV_${String(seq).padStart(8, '0')}`,
            os_family: pickWeighted(rng, [
                { value: 'ANDROID', weight: 50 },
                { value: 'IOS', weight: 30 },
                { value: 'WINDOWS', weight: 20 },
            ]),
        }
    }

    if (type === 'PHONE') {
        return {
            phone_id: `PHN_${String(seq).padStart(8, '0')}`,
            country_code: pickWeighted(rng, [
                { value: '+7', weight: 70 },
                { value: '+374', weight: 10 },
                { value: '+375', weight: 10 },
                { value: '+995', weight: 10 },
            ]),
        }
    }

    return {
        company_rk: `COM_${String(seq).padStart(8, '0')}`,
        industry: pickWeighted(rng, [
            { value: 'TRADE', weight: 30 },
            { value: 'IT', weight: 20 },
            { value: 'LOGISTICS', weight: 20 },
            { value: 'FINANCE', weight: 15 },
            { value: 'OTHER', weight: 15 },
        ]),
    }
}

function makeEdgeAttributes(relationFamily: string, rng: () => number) {
    return {
        strength: Math.round(rng() * 100) / 100,
        amount: relationFamily === 'ACCOUNT_TRANSFER_ACCOUNT' ? Math.floor(rng() * 500_000) : null,
        event_ts: Date.now() - Math.floor(rng() * 30 * 24 * 60 * 60 * 1000),
    }
}

function pickTargetType(sourceType: EntityType, rng: () => number): EntityType {
    if (sourceType === 'PARTY') {
        return pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 35 },
            { value: 'PHONE', weight: 20 },
            { value: 'DEVICE', weight: 20 },
            { value: 'COMPANY', weight: 10 },
            { value: 'PARTY', weight: 15 },
        ])
    }

    if (sourceType === 'ACCOUNT') {
        return pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 45 },
            { value: 'CARD', weight: 20 },
            { value: 'PARTY', weight: 20 },
            { value: 'COMPANY', weight: 15 },
        ])
    }

    if (sourceType === 'CARD') {
        return pickWeighted(rng, [
            { value: 'ACCOUNT', weight: 70 },
            { value: 'PARTY', weight: 30 },
        ])
    }

    if (sourceType === 'DEVICE') {
        return pickWeighted(rng, [
            { value: 'PARTY', weight: 80 },
            { value: 'ACCOUNT', weight: 20 },
        ])
    }

    if (sourceType === 'PHONE') {
        return pickWeighted(rng, [
            { value: 'PARTY', weight: 85 },
            { value: 'COMPANY', weight: 15 },
        ])
    }

    return pickWeighted(rng, [
        { value: 'PARTY', weight: 50 },
        { value: 'ACCOUNT', weight: 30 },
        { value: 'COMPANY', weight: 20 },
    ])
}

function inferRelation(sourceType: EntityType, targetType: EntityType) {
    if (sourceType === 'PARTY' && targetType === 'ACCOUNT') return 'PARTY_OWNS_ACCOUNT'
    if (sourceType === 'PARTY' && targetType === 'PHONE') return 'PARTY_USES_PHONE'
    if (sourceType === 'PARTY' && targetType === 'DEVICE') return 'PARTY_USES_DEVICE'
    if (sourceType === 'PARTY' && targetType === 'COMPANY') return 'PARTY_ASSOCIATED_WITH_COMPANY'
    if (sourceType === 'ACCOUNT' && targetType === 'ACCOUNT') return 'ACCOUNT_TRANSFER_ACCOUNT'
    if (sourceType === 'CARD' && targetType === 'ACCOUNT') return 'CARD_LINKED_ACCOUNT'
    if (sourceType === 'DEVICE' && targetType === 'PARTY') return 'DEVICE_USED_BY_PARTY'
    if (sourceType === 'PHONE' && targetType === 'PARTY') return 'PHONE_USED_BY_PARTY'
    if (sourceType === 'PARTY' && targetType === 'PARTY') return 'PERSON_KNOWS_PERSON'
    return `${sourceType}_${targetType}`
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