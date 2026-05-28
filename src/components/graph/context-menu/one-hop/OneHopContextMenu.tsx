import { useSigma } from "@react-sigma/core";
import {
    useCloseOneHopContext,
    useOneHopContext,
    useOpenClusterPickerFromOneHop,
    useSetNodesToResetCamera,
} from "../../../../store/ClientStore";
import { ContextMenu, contextMenuStyles as styles } from "../ContextMenu";

export function OneHopContextMenu() {
    const sigma = useSigma();
    const oneHopContext = useOneHopContext();
    const setNodesToResetCamera = useSetNodesToResetCamera();
    const closeOneHopContext = useCloseOneHopContext();
    const openClusterPickerFromOneHop = useOpenClusterPickerFromOneHop();

    if (!oneHopContext) return null;

    const graph = sigma.getGraph();
    if (!graph.hasNode(oneHopContext.sourceNodeId)) return null;

    const attributes = graph.getNodeAttributes(oneHopContext.sourceNodeId);
    if (typeof attributes.x !== "number" || typeof attributes.y !== "number") return null;

    const zoomToOneHop = () => {
        setNodesToResetCamera(oneHopContext.nodeIds);
    };

    return (
        <ContextMenu graphPosition={{ x: attributes.x, y: attributes.y }}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <div>
                        <div className={styles.title}>1-hop</div>
                        <div className={styles.subtitle}>
                            {oneHopContext.nodeIds.length} нод / {oneHopContext.edgeIds.length} связей
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeOneHopContext}
                        className={styles.closeButton}
                        aria-label="Закрыть 1-hop"
                    >
                        X
                    </button>
                </header>

                <div className={styles.actions}>
                    <button
                        type="button"
                        onClick={zoomToOneHop}
                        className={styles.primaryButton}
                    >
                        Приблизить
                    </button>

                    <button
                        type="button"
                        onClick={() => openClusterPickerFromOneHop(false)}
                        className={styles.previewButton}
                        title="Добавить текущий 1-hop в кластер"
                    >
                        Добавить в кластер
                    </button>
                </div>
            </div>
        </ContextMenu>
    );
}
