import { useSigma } from "@react-sigma/core";
import { useEffect, useMemo, useState } from "react";
import {
    useClusterIdsByNodeId,
    useClusters,
    useHoveredNode,
    useSelectedClusterId,
} from "../../../store/ClientStore";
import styles from "./ClusterHoverDetails.module.css";

const GAP = 18;

export function ClusterHoverDetails() {
    const sigma = useSigma();
    const hoveredNode = useHoveredNode();
    const clustersById = useClusters();
    const clusterIdsByNodeId = useClusterIdsByNodeId();
    const selectedClusterId = useSelectedClusterId();
    const [cameraVersion, setCameraVersion] = useState(0);

    useEffect(() => {
        const camera = sigma.getCamera();
        const updatePosition = () => setCameraVersion((version) => version + 1);

        camera.on("updated", updatePosition);

        return () => {
            camera.off("updated", updatePosition);
        };
    }, [sigma]);

    const cluster = useMemo(() => {
        if (!hoveredNode) return null;

        const clusterIds = Array.from(clusterIdsByNodeId.get(hoveredNode) ?? []);
        if (clusterIds.length === 0) return null;

        if (selectedClusterId && clusterIds.includes(selectedClusterId)) {
            return clustersById.get(selectedClusterId) ?? null;
        }

        return clustersById.get(clusterIds[0]) ?? null;
    }, [clusterIdsByNodeId, clustersById, hoveredNode, selectedClusterId]);

    if (!hoveredNode || !cluster) return null;

    const display = sigma.getNodeDisplayData(hoveredNode);
    if (!display) return null;

    const viewportPosition = sigma.framedGraphToViewport(display);

    return (
        <div
            className={styles.card}
            style={{
                left: viewportPosition.x + GAP,
                top: viewportPosition.y + GAP,
            }}
            data-camera-version={cameraVersion}
        >
            <div className={styles.title}>{cluster.name}</div>
            <div className={styles.stats}>
                <div className={styles.stat}>
                    <div className={styles.value}>{cluster.nodeIds.length}</div>
                    <div className={styles.label}>ноды</div>
                </div>
                <div className={styles.stat}>
                    <div className={styles.value}>{cluster.edgeIds.length}</div>
                    <div className={styles.label}>связи</div>
                </div>
            </div>
        </div>
    );
}
