import { useState } from "react";
import {
    useAddPickerContextToCluster,
    useCloseClusterPicker,
    useClusterPickerContext,
    useClusters,
    useCreateClusterFromPicker,
} from "../../../store/ClientStore";
import styles from "./ClusterPickerDialog.module.css";

export function ClusterPickerDialog() {
    const pickerContext = useClusterPickerContext();
    const clustersById = useClusters();
    const closeClusterPicker = useCloseClusterPicker();
    const createClusterFromPicker = useCreateClusterFromPicker();
    const addPickerContextToCluster = useAddPickerContextToCluster();
    const [clusterName, setClusterName] = useState("");

    if (!pickerContext) return null;

    const clusters = Array.from(clustersById.values());

    const createCluster = () => {
        createClusterFromPicker(clusterName);
        setClusterName("");
    };

    return (
        <div
            className={styles.overlay}
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) closeClusterPicker();
            }}
        >
            <section
                className={styles.dialog}
                aria-label="Выбор кластера"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <header className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Добавить в кластер</h2>
                        <div className={styles.subtitle}>
                            {pickerContext.nodeIds.length} нод / {pickerContext.edgeIds.length} связей
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeClusterPicker}
                        className={styles.closeButton}
                        aria-label="Закрыть выбор кластера"
                    >
                        X
                    </button>
                </header>

                <div className={styles.list}>
                    {clusters.length === 0 ? (
                        <div className={styles.empty}>Кластеров пока нет</div>
                    ) : clusters.map((cluster) => (
                        <button
                            key={cluster.clusterId}
                            type="button"
                            onClick={() => addPickerContextToCluster(cluster.clusterId)}
                            className={styles.clusterButton}
                            title={cluster.name}
                        >
                            <span className={styles.swatch} style={{ backgroundColor: cluster.color }} />
                            <span className={styles.clusterName}>{cluster.name}</span>
                            <span className={styles.clusterMeta}>{cluster.nodeIds.length} нод</span>
                        </button>
                    ))}
                </div>

                <div className={styles.form}>
                    <input
                        value={clusterName}
                        onChange={(event) => setClusterName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") createCluster();
                        }}
                        className={styles.input}
                        placeholder={`Кластер ${clusters.length + 1}`}
                    />
                    <button
                        type="button"
                        onClick={createCluster}
                        className={styles.actionButton}
                    >
                        Создать
                    </button>
                </div>
            </section>
        </div>
    );
}
