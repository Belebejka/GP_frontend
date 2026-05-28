import { useSigma } from "@react-sigma/core";
import type { Sigma } from "sigma";
import {
    useClusterContextMenu,
    useClusterIdsByNodeId,
    useClusters,
    useCloseOneHopContext,
    useDeleteSelectedCluster,
    useDeleteSelectedClusterNodes,
    useMoveNodeToCluster,
    useOneHopContext,
    useOpenClusterPickerFromOneHop,
    useOpenOneHopContext,
    useOpenSingleNodeClusterPicker,
    useRemoveNodeFromCluster,
    useSelectedClusterId,
    useSetClusterContextMenu,
    useSetNodesToResetCamera,
    useSetSelectedCluster,
} from "../../../store/ClientStore";
import { ContextMenu, contextMenuStyles as styles } from "../context-menu/ContextMenu";

function getNodeGraphPosition(sigma: Sigma, nodeId: string) {
    const graph = sigma.getGraph();
    if (!graph.hasNode(nodeId)) return null;

    const attributes = graph.getNodeAttributes(nodeId);
    if (typeof attributes.x !== "number" || typeof attributes.y !== "number") return null;

    return { x: attributes.x, y: attributes.y };
}

function ClusterNodeContextMenu() {
    const sigma = useSigma();
    const context = useClusterContextMenu();
    const clustersById = useClusters();
    const clusterIdsByNodeId = useClusterIdsByNodeId();
    const selectedClusterId = useSelectedClusterId();
    const setSelectedCluster = useSetSelectedCluster();
    const setClusterContextMenu = useSetClusterContextMenu();
    const openSingleNodeClusterPicker = useOpenSingleNodeClusterPicker();
    const removeNodeFromCluster = useRemoveNodeFromCluster();
    const moveNodeToCluster = useMoveNodeToCluster();
    const openOneHopContext = useOpenOneHopContext();

    if (context?.type !== "node") return null;

    const position = getNodeGraphPosition(sigma, context.nodeId);
    if (!position) return null;

    const [clusterId] = Array.from(clusterIdsByNodeId.get(context.nodeId) ?? []);
    const cluster = clusterId ? clustersById.get(clusterId) : undefined;
    const isClustered = Boolean(cluster);

    const addToCluster = () => {
        if (selectedClusterId) {
            moveNodeToCluster(context.nodeId, selectedClusterId);
        } else {
            openSingleNodeClusterPicker(context.nodeId);
        }
        setClusterContextMenu(null);
    };

    const selectCluster = () => {
        if (!cluster) return;

        setSelectedCluster(cluster.clusterId);
        setClusterContextMenu({
            type: "selectedCluster",
            nodeId: context.nodeId,
            clusterId: cluster.clusterId,
        });
    };

    const removeFromCluster = () => {
        removeNodeFromCluster(context.nodeId);
        setClusterContextMenu(null);
    };

    const openOneHop = () => {
        openOneHopContext(context.nodeId);
        setClusterContextMenu(null);
    };

    return (
        <ContextMenu graphPosition={position}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <div>
                        <div className={styles.title}>Нода кластера</div>
                        <div className={styles.subtitle}>{cluster?.name ?? "Без кластера"}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setClusterContextMenu(null)}
                        className={styles.closeButton}
                        aria-label="Закрыть меню ноды кластера"
                    >
                        X
                    </button>
                </header>

                <div className={styles.actions}>
                    {!isClustered && (
                        <button type="button" onClick={addToCluster} className={styles.previewButton}>
                            Добавить в кластер
                        </button>
                    )}

                    {isClustered && (
                        <button type="button" onClick={selectCluster} className={styles.primaryButton}>
                            Выбрать кластер
                        </button>
                    )}

                    {isClustered && (
                        <button type="button" onClick={removeFromCluster} className={styles.dangerButton}>
                            Удалить из кластера
                        </button>
                    )}

                    <button type="button" onClick={openOneHop} className={styles.secondaryButton}>
                        1-hop
                    </button>
                </div>
            </div>
        </ContextMenu>
    );
}

function ClusterOneHopContextMenu() {
    const sigma = useSigma();
    const oneHopContext = useOneHopContext();
    const setNodesToResetCamera = useSetNodesToResetCamera();
    const openClusterPickerFromOneHop = useOpenClusterPickerFromOneHop();
    const setClusterContextMenu = useSetClusterContextMenu();
    const closeOneHopContext = useCloseOneHopContext();

    if (!oneHopContext) return null;

    const position = getNodeGraphPosition(sigma, oneHopContext.sourceNodeId);
    if (!position) return null;

    return (
        <ContextMenu graphPosition={position}>
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
                        onClick={() => {
                            closeOneHopContext();
                            setClusterContextMenu(null);
                        }}
                        className={styles.closeButton}
                        aria-label="Закрыть 1-hop"
                    >
                        X
                    </button>
                </header>

                <div className={styles.actions}>
                    <button
                        type="button"
                        onClick={() => setNodesToResetCamera(oneHopContext.nodeIds)}
                        className={styles.primaryButton}
                    >
                        Приблизить
                    </button>
                    <button
                        type="button"
                        onClick={() => openClusterPickerFromOneHop(false)}
                        className={styles.previewButton}
                    >
                        Добавить в кластер
                    </button>
                    <button
                        type="button"
                        onClick={() => openClusterPickerFromOneHop(true)}
                        className={styles.dangerButton}
                    >
                        Очистить и добавить
                    </button>
                </div>
            </div>
        </ContextMenu>
    );
}

function SelectedClusterContextMenu() {
    const sigma = useSigma();
    const context = useClusterContextMenu();
    const clustersById = useClusters();
    const deleteSelectedCluster = useDeleteSelectedCluster();
    const deleteSelectedClusterNodes = useDeleteSelectedClusterNodes();
    const setClusterContextMenu = useSetClusterContextMenu();
    const setSelectedCluster = useSetSelectedCluster();

    if (context?.type !== "selectedCluster") return null;

    const cluster = clustersById.get(context.clusterId);
    const position = getNodeGraphPosition(sigma, context.nodeId);
    if (!cluster || !position) return null;

    return (
        <ContextMenu graphPosition={position}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <div>
                        <div className={styles.title}>{cluster.name}</div>
                        <div className={styles.subtitle}>
                            {cluster.nodeIds.length} нод / {cluster.edgeIds.length} связей
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setClusterContextMenu(null)}
                        className={styles.closeButton}
                        aria-label="Закрыть меню выбранного кластера"
                    >
                        X
                    </button>
                </header>

                <div className={styles.actions}>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedCluster(null);
                            setClusterContextMenu(null);
                        }}
                        className={styles.secondaryButton}
                    >
                        Снять выбор
                    </button>
                    <button type="button" onClick={deleteSelectedCluster} className={styles.dangerButton}>
                        Удалить кластер
                    </button>
                    <button type="button" onClick={deleteSelectedClusterNodes} className={styles.dangerButton}>
                        Удалить ноды
                    </button>
                </div>
            </div>
        </ContextMenu>
    );
}

export function ClusterContextMenus() {
    const oneHopContext = useOneHopContext();

    if (oneHopContext) {
        return <ClusterOneHopContextMenu />;
    }

    return (
        <>
            <SelectedClusterContextMenu />
            <ClusterNodeContextMenu />
        </>
    );
}
