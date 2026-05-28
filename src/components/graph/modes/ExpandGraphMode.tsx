import { GraphEvents } from "../GraphEvents";
import { GraphContextMenus } from "../context-menu/GraphContextMenus";
import { HoveredEdgeDetails } from "../hovered-edge-details/HoveredEdgeDetails";
import { HoveredNodeDetails } from "../hovered-node-details/HoveredNodeDetails";
import { NodesList } from "../nodes-list/NodesList";

export function ExpandGraphMode() {
    return (
        <>
            <GraphEvents />
            <GraphContextMenus />
            <HoveredNodeDetails />
            <HoveredEdgeDetails />
            <NodesList />
        </>
    );
}
