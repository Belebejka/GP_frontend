import { useMemo, useState } from "react";
import { useCloseDrawer, useSigmaInstance } from "../../../store/ClientStore";
import type { GraphEdge } from "../../../types";
import styles from "./EdgeInfoContent.module.css";

type ActiveTab = "summary" | "edges";
type Field = {
    key: string;
    value: unknown;
};
type CountItem = {
    key: string;
    count: number;
};

const INITIAL_VISIBLE_EDGES = 50;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toFields = (value: unknown): Field[] => {
    if (!isRecord(value)) return [];

    return Object.entries(value)
        .filter(([, fieldValue]) => fieldValue !== undefined && fieldValue !== null && fieldValue !== "")
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([key, fieldValue]) => ({ key, value: fieldValue }));
};

const formatValue = (value: unknown): string => {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value);
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(formatValue).join(", ");

    return JSON.stringify(value, null, 2) ?? String(value);
};

const countBy = (values: Array<string | undefined>): CountItem[] => {
    const counts = new Map<string, number>();
    values.forEach((value) => {
        if (!value) return;
        counts.set(value, (counts.get(value) ?? 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((first, second) => second.count - first.count || first.key.localeCompare(second.key));
};

const uniqueValues = (items: CountItem[]) => items.map((item) => item.key);

const getNumber = (edge: GraphEdge, key: string) => {
    const topLevelValue = edge[key as keyof GraphEdge];
    if (typeof topLevelValue === "number") return topLevelValue;

    const attributeValue = edge.attributes[key];
    return typeof attributeValue === "number" ? attributeValue : 0;
};

const sumNumber = (edges: GraphEdge[], key: string) => {
    return edges.reduce((sum, edge) => sum + getNumber(edge, key), 0);
};

const averageNumber = (edges: GraphEdge[], key: string) => {
    const values = edges
        .map((edge) => getNumber(edge, key))
        .filter((value) => value > 0);

    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const minString = (values: Array<string | undefined>) => {
    const existingValues = values.filter((value): value is string => Boolean(value)).sort();
    return existingValues[0];
};

const maxString = (values: Array<string | undefined>) => {
    const existingValues = values.filter((value): value is string => Boolean(value)).sort();
    return existingValues.at(-1);
};

const displayNodeName = (attributes: Record<string, unknown>, fallback: string) => {
    return String(attributes.displayName ?? attributes.nodeId ?? fallback);
};

function CountList({ items, emptyText }: { items: CountItem[]; emptyText: string }) {
    const maxCount = Math.max(...items.map((item) => item.count), 1);

    if (!items.length) {
        return <div className={styles.emptyState}>{emptyText}</div>;
    }

    return (
        <div className={styles.countList}>
            {items.map((item) => (
                <div key={item.key} className={styles.countRow}>
                    <div className={styles.countMeta}>
                        <span className={styles.countLabel}>{item.key}</span>
                        <span className={styles.countValue}>{item.count}</span>
                    </div>
                    <div className={styles.countTrack}>
                        <div className={styles.countFill} style={{ width: `${(item.count / maxCount) * 100}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function FieldList({ fields, emptyText }: { fields: Field[]; emptyText: string }) {
    if (!fields.length) {
        return <div className={styles.emptyState}>{emptyText}</div>;
    }

    return (
        <dl className={styles.fieldList}>
            {fields.map((field) => {
                const isComplex = isRecord(field.value) || Array.isArray(field.value);

                return (
                    <div key={field.key} className={`${styles.fieldRow} ${isComplex ? styles.fieldRowStacked : ""}`}>
                        <dt>{field.key}</dt>
                        <dd className={isComplex ? styles.codeValue : ""}>{formatValue(field.value)}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
    return (
        <label className={styles.filterField}>
            <span>{label}</span>
            <select value={value} onChange={(event) => onChange(event.target.value)} className={styles.select}>
                <option value="">Все</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </label>
    );
}

export function EdgeInfoContent({ edgeId }: { edgeId: string }) {
    const sigma = useSigmaInstance();
    const closeDrawer = useCloseDrawer();
    const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
    const [typeFilter, setTypeFilter] = useState("");
    const [familyFilter, setFamilyFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_EDGES);
    const [expandedEdgeId, setExpandedEdgeId] = useState<string | null>(null);

    const edgeInfo = useMemo(() => {
        if (!sigma) return null;

        const graph = sigma.getGraph();
        if (!graph.hasEdge(edgeId)) return null;

        const edgeAttributes = graph.getEdgeAttributes(edgeId);
        const rawEdges = Array.isArray(edgeAttributes.rawEdges)
            ? edgeAttributes.rawEdges as GraphEdge[]
            : [];
        const sourceNodeId = graph.source(edgeId);
        const targetNodeId = graph.target(edgeId);
        const sourceAttributes = graph.getNodeAttributes(sourceNodeId) as Record<string, unknown>;
        const targetAttributes = graph.getNodeAttributes(targetNodeId) as Record<string, unknown>;

        const edgeTypes = countBy(rawEdges.map((edge) => edge.type));
        const relationFamilies = countBy(rawEdges.map((edge) => edge.relationFamily));
        const sourceSystems = countBy(rawEdges.map((edge) => edge.sourceSystem));
        const txCount = sumNumber(rawEdges, "txCount");
        const txSum = sumNumber(rawEdges, "txSum");
        const weight = sumNumber(rawEdges, "weight");
        const evidenceCount = sumNumber(rawEdges, "evidenceCount");
        const strengthScore = averageNumber(rawEdges, "strengthScore");
        const firstSeenAt = minString(rawEdges.map((edge) => edge.firstSeenAt));
        const lastSeenAt = maxString(rawEdges.map((edge) => edge.lastSeenAt));
        const visualEdgeCount = typeof edgeAttributes.edgeCount === "number" ? edgeAttributes.edgeCount : rawEdges.length;

        return {
            directed: edgeAttributes.directed === true,
            sourceNodeId,
            targetNodeId,
            sourceName: displayNodeName(sourceAttributes, sourceNodeId),
            targetName: displayNodeName(targetAttributes, targetNodeId),
            rawEdges,
            edgeTypes,
            relationFamilies,
            sourceSystems,
            stats: [
                { label: "Связей", value: visualEdgeCount },
                ...(txCount > 0 ? [{ label: "Операций", value: txCount }] : []),
                ...(txSum > 0 ? [{ label: "Сумма", value: txSum }] : []),
                ...(weight > 0 ? [{ label: "Вес", value: weight }] : []),
                ...(evidenceCount > 0 ? [{ label: "Evidence", value: evidenceCount }] : []),
                ...(strengthScore > 0 ? [{ label: "Strength avg", value: strengthScore }] : []),
            ],
            period: [
                ...(firstSeenAt ? [{ label: "Первое", value: firstSeenAt }] : []),
                ...(lastSeenAt ? [{ label: "Последнее", value: lastSeenAt }] : []),
            ],
        };
    }, [edgeId, sigma]);

    if (!edgeInfo) {
        return (
            <>
                <header className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>EDGE INFO</div>
                        <h2 className={styles.title}>Информация</h2>
                    </div>

                    <button type="button" onClick={closeDrawer} className={styles.closeButton} aria-label="Закрыть информацию">
                        X
                    </button>
                </header>

                <div className={styles.content}>
                    <div className={styles.errorState}>Ребро не найдено в текущем графе.</div>
                </div>
            </>
        );
    }

    const filteredEdges = edgeInfo.rawEdges.filter((edge) => {
        return (!typeFilter || edge.type === typeFilter) &&
            (!familyFilter || edge.relationFamily === familyFilter) &&
            (!sourceFilter || edge.sourceSystem === sourceFilter);
    });
    const visibleEdges = filteredEdges.slice(0, visibleLimit);

    const resetFilters = () => {
        setTypeFilter("");
        setFamilyFilter("");
        setSourceFilter("");
        setVisibleLimit(INITIAL_VISIBLE_EDGES);
        setExpandedEdgeId(null);
    };

    return (
        <>
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>EDGE INFO</div>
                    <h2 className={styles.title}>Информация</h2>
                </div>

                <button type="button" onClick={closeDrawer} className={styles.closeButton} aria-label="Закрыть информацию">
                    X
                </button>
            </header>

            <section className={styles.heroCard}>
                <div className={styles.route}>
                    <span>{edgeInfo.sourceName}</span>
                    <span className={styles.routeArrow}>{edgeInfo.directed ? "->" : "--"}</span>
                    <span>{edgeInfo.targetName}</span>
                </div>
                <div className={styles.nodePair}>{edgeInfo.sourceNodeId} / {edgeInfo.targetNodeId}</div>
                <div className={styles.typePill}>{edgeInfo.directed ? "DIRECTED" : "UNDIRECTED"} BUNDLE</div>
            </section>

            <div className={styles.tabs} role="tablist" aria-label="Разделы информации о ребре">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "summary"}
                    onClick={() => setActiveTab("summary")}
                    className={`${styles.tabButton} ${activeTab === "summary" ? styles.tabButtonActive : ""}`}
                >
                    Сводка
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "edges"}
                    onClick={() => setActiveTab("edges")}
                    className={`${styles.tabButton} ${activeTab === "edges" ? styles.tabButtonActive : ""}`}
                >
                    Связи
                </button>
            </div>

            <div className={styles.tabPanels}>
                <div
                    role="tabpanel"
                    className={`${styles.tabPanel} ${activeTab === "summary" ? styles.tabPanelActive : ""}`}
                    aria-hidden={activeTab !== "summary"}
                >
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Ключевые показатели</div>
                        <div className={styles.statsGrid}>
                            {edgeInfo.stats.map((stat) => (
                                <div key={stat.label} className={styles.statItem}>
                                    <span className={styles.statValue}>{formatValue(stat.value)}</span>
                                    <span className={styles.statLabel}>{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {edgeInfo.period.length > 0 && (
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Период</div>
                            <FieldList fields={edgeInfo.period.map((item) => ({ key: item.label, value: item.value }))} emptyText="Даты не указаны." />
                        </section>
                    )}

                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Типы связей</div>
                        <CountList items={edgeInfo.edgeTypes} emptyText="Типы связей не указаны." />
                    </section>

                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Семейства</div>
                        <CountList items={edgeInfo.relationFamilies} emptyText="Семейства связей не указаны." />
                    </section>

                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Источники</div>
                        <CountList items={edgeInfo.sourceSystems} emptyText="Источники не указаны." />
                    </section>
                </div>

                <div
                    role="tabpanel"
                    className={`${styles.tabPanel} ${activeTab === "edges" ? styles.tabPanelActive : ""}`}
                    aria-hidden={activeTab !== "edges"}
                >
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Фильтры</div>
                        <div className={styles.filters}>
                            <FilterSelect label="Тип" value={typeFilter} options={uniqueValues(edgeInfo.edgeTypes)} onChange={setTypeFilter} />
                            <FilterSelect label="Семейство" value={familyFilter} options={uniqueValues(edgeInfo.relationFamilies)} onChange={setFamilyFilter} />
                            <FilterSelect label="Источник" value={sourceFilter} options={uniqueValues(edgeInfo.sourceSystems)} onChange={setSourceFilter} />
                        </div>

                        <button type="button" onClick={resetFilters} className={styles.secondaryButton}>
                            Сбросить
                        </button>
                    </section>

                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>Все связи</div>
                            <div className={styles.resultCount}>{filteredEdges.length}</div>
                        </div>

                        {visibleEdges.length > 0 ? (
                            <div className={styles.edgeList}>
                                {visibleEdges.map((edge) => {
                                    const isExpanded = expandedEdgeId === edge.edgeId;
                                    const fields = [
                                        { key: "edgeId", value: edge.edgeId },
                                        { key: "fromNodeId", value: edge.fromNodeId },
                                        { key: "toNodeId", value: edge.toNodeId },
                                        { key: "type", value: edge.type },
                                        { key: "relationFamily", value: edge.relationFamily },
                                        { key: "directed", value: edge.directed },
                                        { key: "weight", value: edge.weight },
                                        { key: "sourceSystem", value: edge.sourceSystem },
                                        { key: "firstSeenAt", value: edge.firstSeenAt },
                                        { key: "lastSeenAt", value: edge.lastSeenAt },
                                    ].filter((field) => field.value !== undefined && field.value !== null && field.value !== "");

                                    return (
                                        <article key={edge.edgeId} className={styles.edgeItem}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedEdgeId(isExpanded ? null : edge.edgeId)}
                                                className={styles.edgeItemButton}
                                            >
                                                <span className={styles.edgeItemType}>{edge.type || "UNKNOWN"}</span>
                                                <span className={styles.edgeItemId}>{edge.edgeId}</span>
                                            </button>

                                            {isExpanded && (
                                                <div className={styles.edgeDetails}>
                                                    <FieldList fields={fields} emptyText="Основные поля не указаны." />
                                                    <div className={styles.subsectionTitle}>Атрибуты</div>
                                                    <FieldList fields={toFields(edge.attributes)} emptyText="Атрибуты не указаны." />
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className={styles.emptyState}>Связи не найдены по выбранным фильтрам.</div>
                        )}

                        {filteredEdges.length > visibleEdges.length && (
                            <button
                                type="button"
                                onClick={() => setVisibleLimit((limit) => limit + INITIAL_VISIBLE_EDGES)}
                                className={styles.primaryButton}
                            >
                                Показать еще
                            </button>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
