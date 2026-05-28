import { useEffect } from "react";
import {
    useActiveOverlay,
    useOneHopContext,
    useOpenedEdge,
    useOpenedNode,
    useSetNodesToReload,
} from "../../../store/ClientStore";
import { EdgeContextMenu } from "./edge/EdgeContextMenu";
import { NodeContextMenu } from "./node/NodeContextMenu";
import { OneHopContextMenu } from "./one-hop/OneHopContextMenu";
import { SeedNodeContextMenu } from "./seed-node/SeedNodeContextMenu";

export function GraphContextMenus() {
    const activeOverlay = useActiveOverlay();
    const openedNode = useOpenedNode();
    const openedEdge = useOpenedEdge();
    const oneHopContext = useOneHopContext();
    const setNodesToReload = useSetNodesToReload();

    useEffect(() => {
        if (!openedNode) {
            const timeout = setTimeout(() => {
                setNodesToReload([]);
            }, 1000);

            return () => clearTimeout(timeout);
        }
    }, [openedNode, setNodesToReload]);
    

    if (activeOverlay === "oneHop" && oneHopContext) {
        return <OneHopContextMenu />;
    }

    if (activeOverlay === "openedEdge" && openedEdge) {
        return <EdgeContextMenu />;
    }

    if (activeOverlay === "openedNode" && openedNode === "seedNode") {
        return <SeedNodeContextMenu />;
    }

    if (activeOverlay === "openedNode" && openedNode) {
        return <NodeContextMenu />;
    }

    return null;
}
