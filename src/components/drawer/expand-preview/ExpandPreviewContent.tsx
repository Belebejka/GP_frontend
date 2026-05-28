import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useExpandGraphMutation, usePreviewExpandGraphMutation } from "../../../services/queries";
import {
    useCloseDrawer,
    useExpandGraphFromNode,
    useGetGraphExcludeContext,
    useSetNodesToReload,
    useSigmaInstance,
} from "../../../store/ClientStore";
import type {
    AttributeFilterValue,
    Direction,
    ExpandFilters,
    ExpandRequest,
    GraphExpandPreviewResponse,
    GraphFacetCount,
} from "../../../types";
import styles from "./ExpandPreviewContent.module.css";

type ActiveTab = "filters" | "result";
type AttributePreset = {
    id: string
    label: string
    scope: "node" | "edge"
    key: string
    filter: AttributeFilterValue
}
type FilterState = {
    direction: Direction
    relationFamilies: string[]
    edgeTypes: string[]
    nodeTypes: string[]
    attributePresetIds: string[]
}

const DIRECTIONS: Direction[] = ["BOTH", "OUTBOUND", "INBOUND"];
const DEFAULT_FILTERS: FilterState = {
    direction: "BOTH",
    relationFamilies: [],
    edgeTypes: [],
    nodeTypes: [],
    attributePresetIds: [],
};
const DEFAULT_MAX_NODES = 1000;
const DEFAULT_MAX_EDGES = 2000;
const FALLBACK_NODE_TYPES = ["PERSON", "ACCOUNT", "COMPANY", "DEVICE", "ADDRESS", "LOAN", "MEDIUM"];
const ATTRIBUTE_PRESETS: AttributePreset[] = [
    { id: "node:isBlocked", label: "Blocked", scope: "node", key: "isBlocked", filter: { eq: true } },
    { id: "node:isVip", label: "VIP", scope: "node", key: "isVip", filter: { eq: true } },
    { id: "node:blacklist", label: "Blacklist", scope: "node", key: "blacklist", filter: { eq: true } },
    { id: "edge:amount100k", label: "Amount >= 100k", scope: "edge", key: "amount", filter: { gte: 100000 } },
    { id: "edge:strength07", label: "Strength >= .7", scope: "edge", key: "strengthScore", filter: { gte: 0.7 } },
    { id: "edge:evidence2", label: "Evidence >= 2", scope: "edge", key: "evidenceCount", filter: { gte: 2 } },
];

let settings = {
    includeSeedInLayout: false,
    focusCameraAfterExpand: true,
    layoutTime: 500,
    maxNodes: DEFAULT_MAX_NODES,
    maxEdges: DEFAULT_MAX_EDGES,
}

const normalizeLimit = (value: number, fallback: number) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(1, Math.floor(value));
};

function Settings({ setIsSettingsOpen }: { setIsSettingsOpen: (isOpen: boolean) => void }) {
    const [includeSeedInLayout, setIncludeSeedInLayout] = useState(settings.includeSeedInLayout);
    const [focusCameraAfterExpand, setFocusCameraAfterExpand] = useState(settings.focusCameraAfterExpand);
    const [selectedTimeOfLayoutOption, setSelectedTimeOfLayoutOption] = useState(settings.layoutTime);
    const [maxNodes, setMaxNodes] = useState(settings.maxNodes);
    const [maxEdges, setMaxEdges] = useState(settings.maxEdges);

    const timeOfLayoutOptions = [500, 1000, 1500, 2500, 5000];

    useEffect(() => {
        settings.includeSeedInLayout = includeSeedInLayout;
        settings.focusCameraAfterExpand = focusCameraAfterExpand;
        settings.layoutTime = selectedTimeOfLayoutOption;
        settings.maxNodes = normalizeLimit(maxNodes, DEFAULT_MAX_NODES);
        settings.maxEdges = normalizeLimit(maxEdges, DEFAULT_MAX_EDGES);
    }, [
        includeSeedInLayout,
        focusCameraAfterExpand,
        selectedTimeOfLayoutOption,
        maxNodes,
        maxEdges,
    ])

    return (
        <div className={styles.settingsOverlay}>
            <section className={styles.settingsPanel}>
                <header className={styles.settingsHeader}>
                    <div>
                        <div className={styles.eyebrow}>EXPAND SETTINGS</div>
                        <h3 className={styles.settingsTitle}>Settings</h3>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(false)}
                        className={styles.closeButton}
                        aria-label="Close expand settings"
                    >
                        X
                    </button>
                </header>

                <div className={styles.settingsContent}>
                    <label className={styles.checkboxRow}>
                        <input
                            type="checkbox"
                            checked={includeSeedInLayout}
                            onChange={(event) => setIncludeSeedInLayout(event.target.checked)}
                            className={styles.checkbox}
                        />
                        <span>Включить исходную ноду в layout</span>
                    </label>
                    <label className={styles.checkboxRow}>
                        <input
                            type="checkbox"
                            checked={focusCameraAfterExpand}
                            onChange={(event) => setFocusCameraAfterExpand(event.target.checked)}
                            className={styles.checkbox}
                        />
                        <span>Приближать камеру к результату после expand</span>
                    </label>
                    <select
                        value={selectedTimeOfLayoutOption}
                        onChange={(event) => setSelectedTimeOfLayoutOption(Number(event.target.value))}
                        className={styles.settingsSelect}
                    >
                        {timeOfLayoutOptions.map((option) => 
                            <option key={option} value={option}>
                                {`${option} ms`}
                            </option>
                        )}
                    </select>

                    <div className={styles.limitsGrid}>
                        <label className={styles.limitField}>
                            <span>Лимит нод</span>
                            <input
                                type="number"
                                min={1}
                                step={50}
                                value={maxNodes}
                                onChange={(event) => setMaxNodes(Number(event.target.value))}
                                className={styles.limitInput}
                            />
                        </label>

                        <label className={styles.limitField}>
                            <span>Лимит связей</span>
                            <input
                                type="number"
                                min={1}
                                step={100}
                                value={maxEdges}
                                onChange={(event) => setMaxEdges(Number(event.target.value))}
                                className={styles.limitInput}
                            />
                        </label>
                    </div>
                </div>
            </section>
        </div>
    )
}

function mergeSelectedWithFacets(selectedValues: string[], facets: GraphFacetCount[]): GraphFacetCount[] {
    const byKey = new Map(facets.map((item) => [item.key, item]));

    selectedValues.forEach((value) => {
        if (!byKey.has(value)) {
            byKey.set(value, { key: value, count: 0 });
        }
    });

    return Array.from(byKey.values());
}

function BarList({ items }: { items: GraphFacetCount[] }) {
    const maxCount = Math.max(...items.map((item) => item.count), 1);

    if (!items.length) {
        return <div className={styles.emptyState}>Нет данных для отображения.</div>;
    }

    return (
        <div className={styles.barList}>
            {items.map((item) => (
                <div key={item.key} className={styles.barRow}>
                    <div className={styles.barMeta}>
                        <span className={styles.barLabel}>{item.key}</span>
                        <span className={styles.barCount}>{item.count}</span>
                    </div>
                    <div className={styles.barTrack}>
                        <div
                            className={styles.barFill}
                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

function FilterChips({
    items,
    selectedValues,
    onToggle,
}: {
    items: GraphFacetCount[]
    selectedValues: string[]
    onToggle: (value: string) => void
}) {
    if (!items.length) {
        return <div className={styles.emptyState}>Нет доступных фильтров.</div>;
    }

    return (
        <div className={styles.chips}>
            {items.map((item) => {
                const isSelected = selectedValues.includes(item.key);
                const isUnavailable = isSelected && item.count === 0;

                return (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => onToggle(item.key)}
                        className={`${styles.chip} ${isSelected ? styles.chipSelected : ""}`}
                        title={isUnavailable ? "Фильтр выбран, но текущая комбинация не дает результатов" : undefined}
                    >
                        <span>{item.key}</span>
                        <span className={styles.chipCount}>{item.count}</span>
                    </button>
                );
            })}
        </div>
    );
}

function AttributePresetChips({
    selectedValues,
    onToggle,
}: {
    selectedValues: string[]
    onToggle: (value: string) => void
}) {
    return (
        <div className={styles.chips}>
            {ATTRIBUTE_PRESETS.map((preset) => {
                const isSelected = selectedValues.includes(preset.id);

                return (
                    <button
                        key={preset.id}
                        type="button"
                        onClick={() => onToggle(preset.id)}
                        className={`${styles.chip} ${isSelected ? styles.chipSelected : ""}`}
                    >
                        <span>{preset.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function DirectionChips({
    value,
    onSelect,
}: {
    value: Direction
    onSelect: (value: Direction) => void
}) {
    return (
        <div className={styles.chips}>
            {DIRECTIONS.map((direction) => (
                <button
                    key={direction}
                    type="button"
                    onClick={() => onSelect(direction)}
                    className={`${styles.chip} ${value === direction ? styles.chipSelected : ""}`}
                >
                    <span>{direction}</span>
                </button>
            ))}
        </div>
    );
}

const toggleValue = (values: string[], value: string) => (
    values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]
);

function buildAttributeFilters(attributePresetIds: string[]) {
    const nodeAttributes: Record<string, AttributeFilterValue> = {};
    const edgeAttributes: Record<string, AttributeFilterValue> = {};

    attributePresetIds.forEach((id) => {
        const preset = ATTRIBUTE_PRESETS.find((item) => item.id === id);
        if (!preset) return;

        if (preset.scope === "node") {
            nodeAttributes[preset.key] = preset.filter;
        } else {
            edgeAttributes[preset.key] = preset.filter;
        }
    });

    return { nodeAttributes, edgeAttributes };
}

function compactFilters(filters: FilterState): ExpandFilters | undefined {
    const { nodeAttributes, edgeAttributes } = buildAttributeFilters(filters.attributePresetIds);
    const payload: ExpandFilters = {};

    if (filters.relationFamilies.length > 0) payload.relationFamilies = filters.relationFamilies;
    if (filters.edgeTypes.length > 0) payload.edgeTypes = filters.edgeTypes;
    if (filters.nodeTypes.length > 0) payload.nodeTypes = filters.nodeTypes;
    if (Object.keys(nodeAttributes).length > 0) payload.nodeAttributes = nodeAttributes;
    if (Object.keys(edgeAttributes).length > 0) payload.edgeAttributes = edgeAttributes;

    return Object.keys(payload).length > 0 ? payload : undefined;
}

export function ExpandPreviewContent({ nodeId }: { nodeId: string }) {
    const sigma = useSigmaInstance();
    const closeDrawer = useCloseDrawer();
    const expandGraphFromNode = useExpandGraphFromNode();
    const getGraphExcludeContext = useGetGraphExcludeContext();
    const setNodesToReload = useSetNodesToReload();
    const expandGraphMutation = useExpandGraphMutation();
    const previewMutation = usePreviewExpandGraphMutation();

    const [activeTab, setActiveTab] = useState<ActiveTab>("filters");
    const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [preview, setPreview] = useState<GraphExpandPreviewResponse | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const selectedNodeAttributes = useMemo(() => {
        if (!sigma) return null;

        const graph = sigma.getGraph();
        if (!graph.hasNode(nodeId)) return null;

        return graph.getNodeAttributes(nodeId);
    }, [sigma, nodeId]);
    const selectedNodeDisplayName = typeof selectedNodeAttributes?.displayName === "string"
        ? selectedNodeAttributes.displayName
        : nodeId;
    const selectedNodeType = typeof selectedNodeAttributes?.nodeType === "string"
        ? selectedNodeAttributes.nodeType
        : "UNKNOWN TYPE";

    const buildRequest = (filters: FilterState): ExpandRequest => ({
        seeds: [{ type: "NODE_ID", value: nodeId }],
        direction: filters.direction,
        filters: compactFilters(filters),
        exclude: getGraphExcludeContext(),
        maxNeighborsPerSeed: settings.maxNodes,
        maxNodes: settings.maxNodes,
        maxEdges: settings.maxEdges,
        includeAttributes: true,
    });

    const loadPreview = async (filters: FilterState) => {
        const request = buildRequest(filters);
        const data = await previewMutation.mutateAsync(request);
        setPreview(data);
        return data;
    };

    useEffect(() => {
        setActiveTab("filters");
        setDraftFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
        setPreview(null);
        setIsSettingsOpen(false);

        if (!nodeId.trim()) return;
        loadPreview(DEFAULT_FILTERS).catch((error) => {
            console.error("Expand preview failed", {
                error,
                response: axios.isAxiosError(error) ? error.response?.data : undefined,
                request: buildRequest(DEFAULT_FILTERS),
            });
        });
    }, [nodeId]);

    const setDraftDirection = (direction: Direction) => {
        setDraftFilters((filters) => ({ ...filters, direction }));
    };

    const toggleDraftRelationFamily = (relationFamily: string) => {
        setDraftFilters((filters) => ({
            ...filters,
            relationFamilies: toggleValue(filters.relationFamilies, relationFamily),
        }));
    };

    const toggleDraftEdgeType = (edgeType: string) => {
        setDraftFilters((filters) => ({
            ...filters,
            edgeTypes: toggleValue(filters.edgeTypes, edgeType),
        }));
    };

    const toggleDraftNodeType = (nodeType: string) => {
        setDraftFilters((filters) => ({
            ...filters,
            nodeTypes: toggleValue(filters.nodeTypes, nodeType),
        }));
    };

    const toggleDraftAttributePreset = (presetId: string) => {
        setDraftFilters((filters) => ({
            ...filters,
            attributePresetIds: toggleValue(filters.attributePresetIds, presetId),
        }));
    };

    const applyFilters = async () => {
        try {
            await loadPreview(draftFilters);
            setAppliedFilters(draftFilters);
            setActiveTab("result");
        } catch (error) {
            console.error("Expand preview failed", {
                error,
                response: axios.isAxiosError(error) ? error.response?.data : undefined,
                request: buildRequest(draftFilters),
            });
            let message = "Не удалось получить preview расширения.";
            if (axios.isAxiosError(error)) {
                const response = error.response?.data as { message?: string; detail?: string; traceId?: string } | undefined;
                message = response?.message ?? response?.detail ?? message;
                if (response?.traceId) message = `${message} (traceId: ${response.traceId})`;
            }
            window.alert(message);
        }
    };

    const resetDraftFilters = () => {
        setDraftFilters(DEFAULT_FILTERS);
    };

    const previewFacets = preview?.facets;
    const relationFamilies = mergeSelectedWithFacets(
        draftFilters.relationFamilies,
        previewFacets?.relationFamilies ?? [],
    );
    const edgeTypes = mergeSelectedWithFacets(
        draftFilters.edgeTypes,
        previewFacets?.edgeTypes ?? [],
    );
    const previewNodeTypes = previewFacets?.neighborNodeTypes?.length
        ? previewFacets.neighborNodeTypes
        : FALLBACK_NODE_TYPES.map((key) => ({ key, count: 0 }));
    const neighborNodeTypes = mergeSelectedWithFacets(
        draftFilters.nodeTypes,
        previewNodeTypes,
    );
    const resultRelationFamilies = mergeSelectedWithFacets(
        appliedFilters.relationFamilies,
        previewFacets?.relationFamilies ?? [],
    );
    const resultEdgeTypes = mergeSelectedWithFacets(
        appliedFilters.edgeTypes,
        previewFacets?.edgeTypes ?? [],
    );
    const resultNeighborNodeTypes = mergeSelectedWithFacets(
        appliedFilters.nodeTypes,
        previewFacets?.neighborNodeTypes ?? [],
    );
    const resultSummary = preview?.summary;
    const isPreviewLoading = previewMutation.isPending && !expandGraphMutation.isPending;
    const isExpandDisabled = !preview ||
        isPreviewLoading ||
        expandGraphMutation.isPending ||
        ((resultSummary?.newNodeCount ?? 0) === 0 && (resultSummary?.newEdgeCount ?? 0) === 0);

    const expand = async () => {
        try {
            const data = await expandGraphMutation.mutateAsync(buildRequest(appliedFilters));

            setTimeout(() => {
                setNodesToReload([]);
            }, settings.layoutTime);

            expandGraphFromNode(nodeId, data, settings.includeSeedInLayout, settings.focusCameraAfterExpand);
            closeDrawer();
        } catch (error) {
            let traceId = "";
            let message = "Expand request failed";

            if (axios.isAxiosError(error)) {
                const response = error.response?.data as {
                    message?: string
                    detail?: string
                    traceId?: string
                } | undefined;

                traceId = response?.traceId ?? "";
                message = response?.message ?? response?.detail ?? message;
            }

            const suffix = traceId ? ` (traceId: ${traceId})` : "";
            window.alert(`${message}${suffix}`);
            console.error("Expand failed", { error, traceId });
        }
    };

    return (
        <>
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>NODE EXPANSION</div>
                    <h2 className={styles.title}>Расширение</h2>
                </div>

                <div className={styles.headerActions}>
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className={styles.settingsButton}
                        aria-label="Open expand settings"
                    >
                        ⚙
                    </button>

                    <button
                        type="button"
                        onClick={closeDrawer}
                        className={styles.closeButton}
                        aria-label="Закрыть расширение"
                    >
                        X
                    </button>
                </div>
            </header>

            {isSettingsOpen && <Settings setIsSettingsOpen={setIsSettingsOpen}/>}

            <section className={styles.heroCard}>
                <div className={styles.nodeName}>
                    {selectedNodeDisplayName}
                </div>
                <div className={styles.nodeId}>{nodeId}</div>
                <div className={styles.typePill}>
                    {selectedNodeType}
                </div>
            </section>

            <div className={styles.tabs} role="tablist" aria-label="Разделы расширения">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "filters"}
                    onClick={() => setActiveTab("filters")}
                    className={`${styles.tabButton} ${activeTab === "filters" ? styles.tabButtonActive : ""}`}
                >
                    Фильтры
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "result"}
                    onClick={() => setActiveTab("result")}
                    className={`${styles.tabButton} ${activeTab === "result" ? styles.tabButtonActive : ""}`}
                >
                    Итог
                </button>
            </div>

            <div className={styles.tabPanels}>
                <div
                    role="tabpanel"
                    className={`${styles.tabPanel} ${activeTab === "filters" ? styles.tabPanelActive : ""}`}
                    aria-hidden={activeTab !== "filters"}
                >
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Фильтры</div>

                        <div className={styles.subsectionTitle}>Направление</div>
                        <DirectionChips value={draftFilters.direction} onSelect={setDraftDirection} />

                        <div className={styles.subsectionTitle}>Семейства связей</div>
                        {isPreviewLoading ? (
                            <div className={styles.emptyState}>Загружаем preview...</div>
                        ) : previewMutation.isError ? (
                            <div className={styles.errorState}>Не удалось получить preview.</div>
                        ) : (
                            <FilterChips
                                items={relationFamilies}
                                selectedValues={draftFilters.relationFamilies}
                                onToggle={toggleDraftRelationFamily}
                            />
                        )}

                        <div className={styles.subsectionTitle}>Типы связей</div>
                        <FilterChips
                            items={edgeTypes}
                            selectedValues={draftFilters.edgeTypes}
                            onToggle={toggleDraftEdgeType}
                        />

                        <div className={styles.subsectionTitle}>Типы соседних нод</div>
                        <FilterChips
                            items={neighborNodeTypes}
                            selectedValues={draftFilters.nodeTypes}
                            onToggle={toggleDraftNodeType}
                        />

                        <div className={styles.subsectionTitle}>Атрибуты</div>
                        <AttributePresetChips
                            selectedValues={draftFilters.attributePresetIds}
                            onToggle={toggleDraftAttributePreset}
                        />
                    </section>
                </div>

                <div
                    role="tabpanel"
                    className={`${styles.tabPanel} ${activeTab === "result" ? styles.tabPanelActive : ""}`}
                    aria-hidden={activeTab !== "result"}
                >
                    <section className={styles.summaryCard}>
                        <div className={styles.sectionTitle}>Итог</div>

                        {isPreviewLoading ? (
                            <div className={styles.emptyState}>Считаем preview...</div>
                        ) : previewMutation.isError ? (
                            <div className={styles.errorState}>Не удалось получить preview.</div>
                        ) : (
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{resultSummary?.adjacentEdgeCount ?? 0}</span>
                                    <span className={styles.statLabel}>связей</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{resultSummary?.newNodeCount ?? 0}</span>
                                    <span className={styles.statLabel}>новых нод</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{resultSummary?.newEdgeCount ?? 0}</span>
                                    <span className={styles.statLabel}>новых ребер</span>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Состав результата</div>

                        <div className={styles.subsectionTitle}>Типы соседних нод</div>
                        <BarList items={resultNeighborNodeTypes} />

                        <div className={styles.subsectionTitle}>Семейства связей</div>
                        <BarList items={resultRelationFamilies} />

                        <div className={styles.subsectionTitle}>Типы связей</div>
                        <BarList items={resultEdgeTypes} />
                    </section>
                </div>
            </div>

            <footer className={`${styles.footer} ${activeTab === "result" ? styles.footerResult : ""}`}>
                {activeTab === "filters" ? (
                    <>
                        <button
                            type="button"
                            onClick={resetDraftFilters}
                            className={styles.secondaryButton}
                            disabled={JSON.stringify(draftFilters) === JSON.stringify(DEFAULT_FILTERS)}
                        >
                            Сбросить
                        </button>
                        <button
                            type="button"
                            onClick={applyFilters}
                            className={styles.primaryButton}
                            disabled={previewMutation.isPending}
                        >
                            {previewMutation.isPending ? "Считаем..." : "Применить"}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={expand}
                        className={styles.primaryButton}
                        disabled={isExpandDisabled}
                    >
                        {expandGraphMutation.isPending ? "Расширяем..." : "Расширить"}
                    </button>
                )}
            </footer>
        </>
    );
}
