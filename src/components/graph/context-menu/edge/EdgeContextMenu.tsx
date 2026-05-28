import { useSigma } from "@react-sigma/core";
import { useOpenedEdge, useOpenEdgeInfo, useSetOpenedEdge } from "../../../../store/ClientStore";
import { ContextMenu, contextMenuStyles as styles } from "../ContextMenu";

export function EdgeContextMenu() {
    const sigma = useSigma();
    const openedEdge = useOpenedEdge();
    const setOpenedEdge = useSetOpenedEdge();
    const openEdgeInfo = useOpenEdgeInfo();

    if (!openedEdge) return null;

    const graph = sigma.getGraph();
    if (!graph.hasEdge(openedEdge)) return null;

    const source = graph.getNodeAttributes(graph.source(openedEdge));
    const target = graph.getNodeAttributes(graph.target(openedEdge));
    if (
        typeof source.x !== "number" ||
        typeof source.y !== "number" ||
        typeof target.x !== "number" ||
        typeof target.y !== "number"
    ) {
        return null;
    }

    const closeMenu = () => {
        setOpenedEdge(null);
    };

    const openInfo = () => {
        closeMenu();
        openEdgeInfo(openedEdge);
    };

    return (
        <ContextMenu
            graphPosition={{
                x: (source.x + target.x) / 2,
                y: (source.y + target.y) / 2,
            }}
        >
            <div className={styles.content}>
                <header className={styles.header}>
                    <div className={styles.title}>Действия</div>

                    <button
                        type="button"
                        onClick={closeMenu}
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
                        className={styles.edgeInfoButton}
                    >
                        Информация
                    </button>
                </div>
            </div>
        </ContextMenu>
    );
}
