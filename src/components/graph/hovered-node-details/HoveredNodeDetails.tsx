import { useSigma } from "@react-sigma/core";
import { useLayoutEffect, useRef, useState } from "react";
import { useActiveOverlay, useHoveredNode, useShowHoveredNodeDetails } from "../../../store/ClientStore";
import { getHoveredNodeDetails, getHoveredNodeStatuses } from "../HoveredNodeDetalization";
import styles from "./HoveredNodeDetails.module.css";

export function HoveredNodeDetails() {
    const sigma = useSigma();
    const activeOverlay = useActiveOverlay();
    const hoveredNode = useHoveredNode();
    const showHoveredNodeDetails = useShowHoveredNodeDetails();
    const cardRef = useRef<HTMLElement | null>(null);
    const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!cardRef.current) return;

        const { width, height } = cardRef.current.getBoundingClientRect();
        setCardSize({ width, height });
    }, [hoveredNode]);

    if (activeOverlay !== "hoveredNode" || !showHoveredNodeDetails || !hoveredNode || hoveredNode === "seedNode") return null;

    const graph = sigma.getGraph();
    if (!graph.hasNode(hoveredNode)) return null;

    const attributes = graph.getNodeAttributes(hoveredNode);
    const x = attributes.x;
    const y = attributes.y;
    if (typeof x !== "number" || typeof y !== "number") return null;

    const position = sigma.graphToViewport({ x, y });
    const details = getHoveredNodeDetails(attributes);
    const statuses = getHoveredNodeStatuses(attributes);
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
                <div className={styles.title}>{String(attributes.displayName ?? hoveredNode)}</div>
                <div className={styles.type}>{String(attributes.nodeType ?? "UNKNOWN")}</div>
            </div>

            {statuses.length > 0 && (
                <div className={styles.statuses}>
                    {statuses.map((status) => <span key={status} className={styles.status}>{status}</span>)}
                </div>
            )}

            {details.length > 0 && (
                <dl className={styles.details}>
                    {details.map((detail) => (
                        <div key={detail.label} className={styles.detailRow}>
                            <dt>{detail.label}</dt>
                            <dd>{detail.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </aside>
    );
}
