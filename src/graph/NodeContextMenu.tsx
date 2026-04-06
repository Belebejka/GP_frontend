import { useSigma } from "@react-sigma/core";
import { useExpandGraph, useIsLayoutRunning, useOpenedNode, useSetOpenedNode } from "../store/SigmaStore";

export default function NodeContextMenu() {
    const openedNode = useOpenedNode();
    const sigma = useSigma();
    const setOpenedNode = useSetOpenedNode();
    const expandGraph = useExpandGraph();
    const isLayoutRunning = useIsLayoutRunning();

    if (!openedNode) return null;

    const {x, y} = sigma.getGraph().getNodeAttributes(openedNode);
    const pos = sigma.graphToViewport({x, y});

    return (
    <div
        style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        background: "#fff",
        border: "1px solid #ccc",
        padding: 8,
        zIndex: 1000,
        }}
    >
        <button onClick={() => setOpenedNode(null)}>Close</button>
        <button disabled={isLayoutRunning} onClick={
            () => {
                expandGraph();
            }
        }>Expand</button>
    </div>
    );
}