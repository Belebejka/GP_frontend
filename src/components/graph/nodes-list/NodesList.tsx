import { useSigma } from "@react-sigma/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDeletedGraph, useGraphVersion, useReturnNode, useSetNodesToReload, useSetOpenedNode } from "../../../store/ClientStore";
import styles from "./NodesList.module.css";

const normalizeSearchValue = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(normalizeSearchValue).join(" ");
    if (typeof value === "object") return Object.values(value).map(normalizeSearchValue).join(" ");

    return String(value);
};

const normalizeSearchQuery = (value: string) => value.trim().toLowerCase();

function ToggleListButton({ isOpened, onToggleOpened }) {
    return (
        <button
            type="button"
            onClick={onToggleOpened}
            className={`${styles.toggleButton} ${isOpened ? styles.toggleButtonOpened : ""}`}
        >
            {isOpened ? "▲ скрыть" : "▼ показать"}
        </button>
    );
}

function ExistNodesList({ isOpened, onToggleOpened, onSwitchMode }) {
    const sigma = useSigma();
    const graph = sigma.getGraph();

    const graphVersion = useGraphVersion();
    const setOpenedNode = useSetOpenedNode();

    const [nodes, setNodes] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        setNodes(graph.nodes());
    }, [graphVersion, graph]);

    const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
    const filteredNodes = useMemo(() => {
        if (!normalizedSearchQuery) return nodes;

        return nodes.filter((node) => {
            const attributes = graph.hasNode(node) ? graph.getNodeAttributes(node) : {};
            const searchableText = normalizeSearchValue({
                nodeId: node,
                ...attributes,
            }).toLowerCase();

            return searchableText.includes(normalizedSearchQuery);
        });
    }, [graph, nodes, normalizedSearchQuery]);

    return (
        <>
            <div className={styles.titleRow}>
                <div className={styles.title}>НОДЫ</div>

                <button
                    onClick={onSwitchMode}
                    className={styles.modeButton}
                    title="Показать список удаленных нод"
                >
                    УД.
                </button>
            </div>

            <div className={styles.count}>
                {`${nodes.length} шт.`}
            </div>

            <ToggleListButton isOpened={isOpened} onToggleOpened={onToggleOpened} />

            {isOpened && (
                <>
                <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className={styles.searchInput}
                    placeholder="Поиск по нодам"
                />

                <div className={styles.list}>
                    {filteredNodes.map((node) => {
                        const displayName = graph.getNodeAttribute(node, "displayName");
                        const label = typeof displayName === "string" && displayName.trim() ? displayName : node;

                        return (
                            <div key={node}>
                                <span
                                    className={styles.node}
                                    onClick={() => setOpenedNode(node)}
                                    title={`${label} (${node})`}
                                >
                                    <span className={styles.nodeLabel}>{label}</span>
                                </span>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </>
    );
}

function getDeletedNodeLabel(node: { nodeId: string; displayName?: string; attributes?: Record<string, unknown> }) {
    const displayName = node.displayName ?? node.attributes?.displayName;
    return typeof displayName === "string" && displayName.trim() ? displayName : node.nodeId;
}

function DeletedNodesList({ isOpened, onToggleOpened, onSwitchMode }) {
    const deletedGraph = useDeletedGraph();
    const returnNode = useReturnNode();
    const setNodesToReload = useSetNodesToReload();
    const nodes = Array.from(deletedGraph.nodesById.values());
    const [searchQuery, setSearchQuery] = useState("");

    const nodeToReturn = useRef<string | undefined>(null);
    const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
    const filteredNodes = useMemo(() => {
        if (!normalizedSearchQuery) return nodes;

        return nodes.filter((node) => {
            const searchableText = normalizeSearchValue(node).toLowerCase();
            return searchableText.includes(normalizedSearchQuery);
        });
    }, [nodes, normalizedSearchQuery]);

    useEffect(() => {
        if (!nodeToReturn.current) return;

        const timeOut = setTimeout(() => {
            setNodesToReload([]);
        }, 1000);

        return () => {
            clearTimeout(timeOut);
        };
    }, [deletedGraph, setNodesToReload]);

    return (
        <>
            <div className={styles.titleRow}>
                <div className={styles.title}>УДАЛЕННЫЕ НОДЫ</div>

                <button
                    onClick={onSwitchMode}
                    className={styles.modeButton}
                    title="Показать существующие ноды"
                >
                    ↩
                </button>
            </div>

            <div className={styles.count}>
                {`${nodes.length} шт.`}
            </div>

            <ToggleListButton isOpened={isOpened} onToggleOpened={onToggleOpened} />

            {isOpened && (
                <>
                <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className={styles.searchInput}
                    placeholder="Поиск по удаленным нодам"
                />

                <div className={styles.list}>
                    {filteredNodes.map((node) => {
                        const label = getDeletedNodeLabel(node);
                        const edgeCount = deletedGraph.edgeIdsByNodeId.get(node.nodeId)?.size ?? 0;

                        return (
                            <div key={node.nodeId}>
                                <span
                                    className={`${styles.node} ${styles.deletedNode}`}
                                    title={`${label} (${node.nodeId}): ${edgeCount} edges`}
                                >
                                    <span className={styles.nodeLabel}>{label}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            returnNode(node.nodeId);
                                            nodeToReturn.current = node.nodeId;
                                        }}
                                        className={styles.returnButton}
                                        title="Вернуть ноду"
                                    >
                                        ↩
                                    </button>
                                </span>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </>
    );
}

export function NodesList() {
    const [isOpened, setIsOpened] = useState(false);
    const [isSelectedShowDeleted, setisSelectedShowDeleted] = useState(false);

    return (
        <aside className={`${styles.aside} ${isOpened ? styles.opened : ""}`}>
            {!isSelectedShowDeleted ? (
                <ExistNodesList
                    isOpened={isOpened}
                    onToggleOpened={() => setIsOpened((prev) => !prev)}
                    onSwitchMode={() => setisSelectedShowDeleted(true)}
                />
            ) : (
                <DeletedNodesList
                    isOpened={isOpened}
                    onToggleOpened={() => setIsOpened((prev) => !prev)}
                    onSwitchMode={() => setisSelectedShowDeleted(false)}
                />
            )}
        </aside>
    );
}
