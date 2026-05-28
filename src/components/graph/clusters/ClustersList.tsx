import { useState } from "react";
import {
    useClusterFocusOnSelect,
    useClusters,
    useDeleteCluster,
    useSelectedClusterId,
    useSetNodesToResetCamera,
    useSetSelectedCluster,
} from "../../../store/ClientStore";
import styles from "./ClustersList.module.css";

function ToggleListButton({
    isOpened,
    onToggleOpened,
}: {
    isOpened: boolean;
    onToggleOpened: () => void;
}) {
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

export function ClustersList() {
    const [isOpened, setIsOpened] = useState(false);
    const clustersById = useClusters();
    const selectedClusterId = useSelectedClusterId();
    const setSelectedCluster = useSetSelectedCluster();
    const setNodesToResetCamera = useSetNodesToResetCamera();
    const deleteCluster = useDeleteCluster();
    const clusterFocusOnSelect = useClusterFocusOnSelect();

    const clusters = Array.from(clustersById.values());

    const selectCluster = (clusterId: string) => {
        const cluster = clustersById.get(clusterId);
        if (!cluster) return;

        setSelectedCluster(selectedClusterId === clusterId ? null : clusterId);
        if (clusterFocusOnSelect) {
            setNodesToResetCamera(cluster.nodeIds);
        }
    };

    return (
        <aside className={`${styles.aside} ${isOpened ? styles.opened : ""}`}>
            <div className={styles.titleRow}>
                <div className={styles.title}>КЛАСТЕРЫ</div>
            </div>

            <div className={styles.count}>
                {`${clusters.length} шт.`}
            </div>

            <ToggleListButton
                isOpened={isOpened}
                onToggleOpened={() => setIsOpened((prev) => !prev)}
            />

            {isOpened && (
                <div className={styles.list}>
                    {clusters.length === 0 ? (
                        <div className={styles.empty}>Кластеров нет</div>
                    ) : clusters.map((cluster) => {
                        const isSelected = selectedClusterId === cluster.clusterId;

                        return (
                            <div
                                key={cluster.clusterId}
                                role="button"
                                tabIndex={0}
                                onClick={() => selectCluster(cluster.clusterId)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        selectCluster(cluster.clusterId);
                                    }
                                }}
                                className={`${styles.cluster} ${isSelected ? styles.clusterSelected : ""}`}
                                style={{ borderLeftColor: isSelected ? cluster.activeColor : cluster.color }}
                                title={cluster.name}
                            >
                                <span
                                    className={styles.swatch}
                                    style={{ backgroundColor: isSelected ? cluster.activeColor : cluster.color }}
                                />
                                <span className={styles.name}>{cluster.name}</span>
                                <span className={styles.meta}>{cluster.nodeIds.length}</span>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        deleteCluster(cluster.clusterId);
                                    }}
                                    className={styles.deleteButton}
                                    title="Удалить кластер"
                                    aria-label={`Удалить ${cluster.name}`}
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </aside>
    );
}
