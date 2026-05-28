import { useSigma } from "@react-sigma/core";
import {
    useDeleteNode,
    useIsLayoutRunning,
    useOpenedNode,
    useOpenExpandPreview,
    useOpenNodeInfo,
    useOpenOneHopContext,
    useSetOpenedNode,
} from "../../../../store/ClientStore";
import { ContextMenu, contextMenuStyles as styles } from "../ContextMenu";

export function NodeContextMenu() {
    const sigma = useSigma();
    const openedNode = useOpenedNode();
    const isLayoutRunning = useIsLayoutRunning();

    const setOpenedNode = useSetOpenedNode();
    const openExpandPreview = useOpenExpandPreview();
    const openNodeInfo = useOpenNodeInfo();
    const openOneHopContext = useOpenOneHopContext();
    const deleteNode = useDeleteNode();

    if (!openedNode || openedNode === "seedNode") return null;

    const graph = sigma.getGraph();
    if (!graph.hasNode(openedNode)) return null;

    const attributes = graph.getNodeAttributes(openedNode);
    if (typeof attributes.x !== "number" || typeof attributes.y !== "number") return null;

    const openInfo = () => {
        setOpenedNode(null);
        openNodeInfo(openedNode);
    };

    const openExpansion = () => {
        setOpenedNode(null);
        openExpandPreview(openedNode);
    };

    const removeNode = () => {
        setOpenedNode(null);
        deleteNode(openedNode);
    };

    const openOneHop = () => {
        setOpenedNode(null);
        openOneHopContext(openedNode);
    };

    return (
        <ContextMenu graphPosition={{ x: attributes.x, y: attributes.y }}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <div className={styles.title}>Действия</div>

                    <button
                        type="button"
                        onClick={() => setOpenedNode(null)}
                        className={styles.closeButton}
                        aria-label="Закрыть"
                    >
                        X
                    </button>
                </header>

                <div className={styles.actions}>
                    <button
                        type="button"
                        onClick={openInfo}
                        className={styles.primaryButton}
                    >
                        Информация
                    </button>

                    <button
                        type="button"
                        disabled={isLayoutRunning}
                        onClick={openOneHop}
                        className={styles.secondaryButton}
                    >
                        1-hop
                    </button>

                    <button
                        type="button"
                        disabled={isLayoutRunning}
                        onClick={openExpansion}
                        className={styles.previewButton}
                    >
                        Расширение
                    </button>

                    <button
                        type="button"
                        onClick={removeNode}
                        className={styles.dangerButton}
                    >
                        Удалить
                    </button>
                </div>
            </div>
        </ContextMenu>
    );
}
