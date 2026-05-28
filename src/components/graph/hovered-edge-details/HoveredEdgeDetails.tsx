import { useSigma } from "@react-sigma/core";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useActiveOverlay, useHoveredEdge, useShowHoveredEdgeDetails } from "../../../store/ClientStore";
import type { GraphEdge } from "../../../types";
import styles from "./HoveredEdgeDetails.module.css";

const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

const uniqueStrings = (values: Array<string | undefined>) => {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
};

const getNumberAttribute = (edge: GraphEdge, key: string) => {
    const value = edge.attributes[key];
    return typeof value === "number" ? value : 0;
};

export function HoveredEdgeDetails() {
    const sigma = useSigma();
    const activeOverlay = useActiveOverlay();
    const hoveredEdge = useHoveredEdge();
    const showHoveredEdgeDetails = useShowHoveredEdgeDetails();
    const cardRef = useRef<HTMLElement | null>(null);
    const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!cardRef.current) return;

        const { width, height } = cardRef.current.getBoundingClientRect();
        setCardSize({ width, height });
    }, [hoveredEdge]);

    const edgeData = useMemo(() => {
        if (!hoveredEdge) return null;

        const graph = sigma.getGraph();
        if (!graph.hasEdge(hoveredEdge)) return null;

        const attributes = graph.getEdgeAttributes(hoveredEdge);
        const rawEdges = Array.isArray(attributes.rawEdges)
            ? attributes.rawEdges as GraphEdge[]
            : [];

        return {
            source: graph.source(hoveredEdge),
            target: graph.target(hoveredEdge),
            edgeCount: typeof attributes.edgeCount === "number" ? attributes.edgeCount : rawEdges.length,
            edgeTypes: uniqueStrings(rawEdges.map((edge) => edge.type)),
            txCount: rawEdges.reduce((sum, edge) => sum + getNumberAttribute(edge, "txCount"), 0),
            txSum: rawEdges.reduce((sum, edge) => sum + getNumberAttribute(edge, "txSum"), 0),
        };
    }, [hoveredEdge, sigma]);

    if (activeOverlay !== "hoveredEdge" || !showHoveredEdgeDetails || !hoveredEdge || !edgeData) return null;

    const graph = sigma.getGraph();
    const source = graph.getNodeAttributes(edgeData.source);
    const target = graph.getNodeAttributes(edgeData.target);
    if (
        typeof source.x !== "number" ||
        typeof source.y !== "number" ||
        typeof target.x !== "number" ||
        typeof target.y !== "number"
    ) {
        return null;
    }

    const position = sigma.graphToViewport({
        x: (source.x + target.x) / 2,
        y: (source.y + target.y) / 2,
    });
    const container = sigma.getContainer();
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const gap = 18;
    const margin = 12;

    let left = position.x + gap;
    if (cardSize.width > 0 && left + cardSize.width > containerWidth - margin) {
        left = position.x - gap - cardSize.width;
    }

    let top = position.y - cardSize.height / 2;
    if (cardSize.height > 0 && top < margin) {
        top = position.y + gap;
    }
    if (cardSize.height > 0 && top + cardSize.height > containerHeight - margin) {
        top = position.y - gap - cardSize.height;
    }

    left = Math.min(Math.max(left, margin), Math.max(margin, containerWidth - cardSize.width - margin));
    top = Math.min(Math.max(top, margin), Math.max(margin, containerHeight - cardSize.height - margin));

    return (
        <aside ref={cardRef} className={styles.card} style={{ left, top }}>
            <div className={styles.header}>
                <div className={styles.title}>EDGE BUNDLE</div>
            </div>

            <div className={styles.typeCapsules}>
                {(edgeData.edgeTypes.length > 0 ? edgeData.edgeTypes : ["UNKNOWN"]).map((type) => (
                    <span key={type} className={styles.typeCapsule}>{type}</span>
                ))}
            </div>

            <dl className={styles.details}>
                <div className={styles.detailRow}>
                    <dt>Связей</dt>
                    <dd>{edgeData.edgeCount}</dd>
                </div>
                {edgeData.txCount > 0 && (
                    <div className={styles.detailRow}>
                        <dt>Операций</dt>
                        <dd>{formatNumber(edgeData.txCount)}</dd>
                    </div>
                )}
                {edgeData.txSum > 0 && (
                    <div className={styles.detailRow}>
                        <dt>Сумма</dt>
                        <dd>{formatNumber(edgeData.txSum)}</dd>
                    </div>
                )}
            </dl>
        </aside>
    );
}
