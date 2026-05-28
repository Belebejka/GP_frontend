import { useSigma } from "@react-sigma/core";
import { useState } from "react";
import { useSearchNodesMutation, useSearchNodesQuery } from "../../../../services/queries";
import {
    useOpenedNode,
    useRemoveSeedNode,
    useReplaceSeedNode,
    useSetOpenedNode,
} from "../../../../store/ClientStore";
import type { GraphNode } from "../../../../types";
import { ContextMenu, contextMenuStyles } from "../ContextMenu";
import styles from "./SeedNodeContextMenu.module.css";

export function SeedNodeContextMenu() {
    const sigma = useSigma();
    const openedNode = useOpenedNode();
    const setOpenedNode = useSetOpenedNode();
    const removeSeedNode = useRemoveSeedNode();
    const replaceSeedNode = useReplaceSeedNode();
    const searchNodesMutation = useSearchNodesMutation();

    const [query, setQuery] = useState("");
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

    const searchQuery = useSearchNodesQuery(query);
    const nodes = searchQuery.data?.nodes ?? [];

    const handleDelete = () => {
        removeSeedNode();
        setOpenedNode(null);
    };

    const handleQueryChange = (value: string) => {
        setQuery(value);
        setSelectedNode(null);
    };

    const handleApply = async () => {
        if (!selectedNode) return;

        const data = await searchNodesMutation.mutateAsync({
            query: selectedNode.nodeId,
            options: {
                includeAttributes: true,
                limit: 1,
            },
        });
        const [node] = data.nodes;
        if (!node) return;

        setOpenedNode(null);
        replaceSeedNode(node);
    };

    if (openedNode !== "seedNode") return null;

    const graph = sigma.getGraph();
    if (!graph.hasNode(openedNode)) return null;

    const attributes = graph.getNodeAttributes(openedNode);
    if (typeof attributes.x !== "number" || typeof attributes.y !== "number") return null;

    return (
        <ContextMenu graphPosition={{ x: attributes.x, y: attributes.y }}>
            <div className={styles.container}>
                <header className={contextMenuStyles.header}>
                    <div>
                        <div className={styles.eyebrow}>НАЧАЛЬНАЯ НОДА</div>
                        <h3 className={contextMenuStyles.title}>Начальная точка</h3>
                    </div>

                    <button
                        type="button"
                        className={contextMenuStyles.closeButton}
                        onClick={() => setOpenedNode(null)}
                        aria-label="Закрыть поиск начальной точки"
                    >
                        X
                    </button>
                </header>

                <label className={styles.field}>
                    <span className={styles.label}>ID или идентификатор</span>
                    <input
                        value={query}
                        onChange={(event) => handleQueryChange(event.target.value)}
                        className={styles.input}
                        placeholder="Например PERSON_000001"
                        autoFocus
                    />
                </label>

                <div className={styles.results}>
                    {searchQuery.isFetching ? (
                        <div className={styles.status}>Ищем...</div>
                    ) : query.trim() && !nodes.length ? (
                        <div className={styles.status}>Ничего не найдено</div>
                    ) : (
                        nodes.map((node) => {
                            const isSelected = selectedNode?.nodeId === node.nodeId;

                            return (
                                <button
                                    key={node.nodeId}
                                    type="button"
                                    className={`${styles.resultItem} ${isSelected ? styles.resultItemSelected : ""}`}
                                    onClick={() => setSelectedNode(node)}
                                >
                                    <span className={styles.resultName}>{node.displayName}</span>
                                    <span className={styles.resultMeta}>
                                        {node.nodeId} · {node.nodeType ?? "НЕИЗВЕСТНО"}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={contextMenuStyles.primaryButton}
                        disabled={!selectedNode || searchNodesMutation.isPending}
                        onClick={handleApply}
                    >
                        {searchNodesMutation.isPending ? "Применяем..." : "Применить"}
                    </button>

                    <button
                        type="button"
                        className={contextMenuStyles.dangerButton}
                        onClick={handleDelete}
                    >
                        Удалить
                    </button>
                </div>
            </div>
        </ContextMenu>
    );
}
