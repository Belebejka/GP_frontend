import { useState } from "react";
import { useGetMockRoots, useSearchGraphQuery } from "../../services/queries";
import { useOneHop, useSetGraphResponse } from "../../store/ClientStore";

export function MockHandler() {
    const setGraphResponse = useSetGraphResponse();
    const one_hop = useOneHop();

    const [selectedNodeId, setSelectedNodeId] = useState("");

    let mockRoots: any[] | undefined;

    const {data: roots} = useGetMockRoots();
    mockRoots = roots?.items;    

    const {data} = useSearchGraphQuery({nodeId: selectedNodeId});
    if (data) setGraphResponse(data);

    return <>
        <div style={{display:"flex", flexDirection:"column", alignItems: "center"}}>
            <select
                value={selectedNodeId}
                onChange={e => setSelectedNodeId(e.target.value)}
            >
                {mockRoots?.map((node) => (
                    <option key={node.nodeId} value={node.nodeId}>
                        {node.displayName} - {node.nodeId}
                    </option>
                ))}
            </select><br>
            </br>
            <button onClick={() => one_hop(selectedNodeId)}>
                1-hop
            </button>
        </div> 
    </>
}