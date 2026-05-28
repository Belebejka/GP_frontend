import { useDrawerState } from "../../store/ClientStore";
import { EdgeInfoContent } from "./edge-info/EdgeInfoContent";
import { ExpandPreviewContent } from "./expand-preview/ExpandPreviewContent";
import { NodeInfoContent } from "./node-info/NodeInfoContent";
import styles from "./Drawer.module.css";

export function Drawer() {
    const drawerState = useDrawerState();

    if (!drawerState) return null;

    const themeClass = drawerState.type === "nodeInfo"
        ? styles.nodeInfoTheme
        : drawerState.type === "edgeInfo"
            ? styles.edgeInfoTheme
            : styles.expandTheme;

    return (
        <aside className={`${styles.drawer} ${themeClass}`} aria-label="Рабочая панель">
            {drawerState.type === "expandPreview" && <ExpandPreviewContent nodeId={drawerState.nodeId} />}
            {drawerState.type === "nodeInfo" && <NodeInfoContent nodeId={drawerState.nodeId} />}
            {drawerState.type === "edgeInfo" && <EdgeInfoContent edgeId={drawerState.edgeId} />}
        </aside>
    );
}
