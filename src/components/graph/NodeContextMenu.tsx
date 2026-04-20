import { useSigma } from "@react-sigma/core";
import { useExpandGraph, useIsLayoutRunning, useIsMockDataUsed, useOpenedNode, useSetGraphResponse, useSetIsMockDataUsed, useSetOpenedNode } from "../../store/ClientStore";
import { useExpandGraphQuery } from "../../services/queries";
import { MockHandler } from "./MockHandler";

function ContextMenu() {
    const openedNode = useOpenedNode();
    const sigma = useSigma();
    const isLayoutRunning = useIsLayoutRunning();

    const setOpenedNode = useSetOpenedNode();
    const setGraphResponse = useSetGraphResponse();
    const expandGraph = useExpandGraph();

    const {data} = useExpandGraphQuery({nodeIds: [openedNode ?? ""]});
    if (data) setGraphResponse(data);

    if (!openedNode) return null;
    if (!sigma.getGraph().hasNode(openedNode)) return null;
    const {x, y} = sigma.getGraph().getNodeAttributes(openedNode);
    const pos = sigma.graphToViewport({x, y});

    return <>
        {openedNode === "seedNode" 
        ? 
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
            <MockHandler />
        </div>
        :
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
        }
    </>
}

export default function NodeContextMenu() {
    const isMockDataUsed = useIsMockDataUsed();    

    return <>
        {isMockDataUsed ? <ContextMenu /> : <></>}
    </>
}