import { fitViewportToNodes } from "@sigma/utils";
import type { Sigma } from "sigma";
import { create } from "zustand";
import { circular } from 'graphology-layout';
import type { GraphResponse } from "../services/types";

//#region Functions
const randomNumber = () => {
    return Math.floor(Math.random() * 255);
}

const randomColor = () => {
    return `rgb(${randomNumber()}, ${randomNumber()}, ${randomNumber()})`;
};
//#endregion

type ClientStore = {
    sigma: Sigma | null;
    isMockDataUsed: boolean;
    openedNode: string | null;
    layoutVersion: number;
    graphVersion: number;
    isLayoutRunning: boolean;
    isNeedToBeReload: boolean;
    graphResponse: GraphResponse | null;

    setSigma: (sigma: Sigma) => void;
    setIsMockDataUsed: () => void;
    setGraphResponse: (response: GraphResponse) => void;
    setOpenedNode: (node: string | null) => void;
    setIsLayoutRunning: (isRunning: boolean) => void;
    setIsNeedToBeReload: (need: boolean) => void;

    placeSeedNode: () => boolean;
    removeSeedNode: () => void;
    resetCamera: () => void;
    one_hop: (node: string) => void;
    expandGraph: () => void;
    appendLayoutVersion: () => void;
    appendGraphVersion: () => void;
}

const useClientStore = create<ClientStore>((set, get) => ({
    sigma: null,
    isMockDataUsed: false,
    openedNode: null,
    layoutVersion: 0,
    graphVersion: 0,
    isLayoutRunning: false,
    isNeedToBeReload: false,
    graphResponse: null,

//#region Setters
    setSigma: (sigma) => set(() => ({sigma: sigma})),
    setIsMockDataUsed: () => set(() => ({isMockDataUsed: true})),
    setGraphResponse: (response) => set(() => ({graphResponse: response})),
    setOpenedNode: (node) => {
        const { sigma } = get();
        if (!sigma) return;
        
        if (node){
            const camera = sigma.getCamera();
            const display = sigma.getNodeDisplayData(node);
            
            if (!display) return;

            camera.animate(
                {
                    x: display.x,
                    y: display.y,
                    ratio: 0.2,
                },
                { duration: 500 }
            ).then(() => set(() => ({openedNode: node})));
        } else set(() => ({openedNode: node}));
    },
    setIsLayoutRunning: (isRunning) => set(() => ({isLayoutRunning: isRunning})),
    setIsNeedToBeReload: (need) => set(() => ({isNeedToBeReload: need})),
//#endregion

//#region Actions
    placeSeedNode: () => {
        const { sigma, setOpenedNode } = get();
        if (!sigma) return false;
        
        const graph = sigma.getGraph();
        
        if (!graph.hasNode("seedNode")) {
            graph.addNode("seedNode", {x: 0, y: 0, size: 10, color: "gray"});
            set((state) => ({layoutVersion: state.layoutVersion + 1}));
        } else {
            setOpenedNode("seedNode");
        }


        return true;
    },

    removeSeedNode: () => {
        const { sigma, appendLayoutVersion } = get();
        if (!sigma) return;
        
        const graph = sigma.getGraph();
        if (graph.hasNode("seedNode")) {
            graph.dropNode("seedNode");
        }

        appendLayoutVersion();
    },

    resetCamera: () => {
        const { sigma } = get();
        if (!sigma) return;

        sigma.setCustomBBox(null);
        sigma.refresh();

        fitViewportToNodes(
            sigma,
            sigma.getGraph().nodes(),
            { animate: true }
        );
    },

    one_hop: (selectedNode: string) => {
        const { sigma, graphResponse, removeSeedNode, appendGraphVersion } = get();
        if (!sigma || !graphResponse) return;

        const graph = sigma.getGraph();

        const colorForNodes = randomColor();

        const seedNodeAttributes = graph.getNodeAttributes("seedNode");
        const baseX = seedNodeAttributes.x ?? 0;
        const baseY = seedNodeAttributes.y ?? 0;
        const radius = 2;
        const number_of_nodes = graphResponse.nodes.length;

        graphResponse.nodes.forEach((node, index) => {
            if (!graph.hasNode(node.nodeId)) {
                const angle = (Math.PI * 2 * index) / number_of_nodes;

                if (selectedNode === node.nodeId) {
                    graph.addNode(node.nodeId, {...seedNodeAttributes, color: colorForNodes, size: 5});
                } else {
                    graph.addNode(node.nodeId, {
                    x: baseX + Math.cos(angle) * radius,
                    y: baseY + Math.sin(angle) * radius,
                    size: 5,
                    color: colorForNodes,
                })
                }
            }
        });

        graphResponse.edges.forEach((edge) => {
            if (!graph.hasEdge(edge.edgeId) && graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
                graph.addEdgeWithKey(edge.edgeId, edge.source, edge.target)
            };
        });

        removeSeedNode();
        appendGraphVersion();
    },

    expandGraph: () => {
        const { sigma, graphResponse, openedNode, appendLayoutVersion, appendGraphVersion } = get();

        if (!sigma || !graphResponse || !openedNode) return;

        const graph = sigma.getGraph();

        const colorForNodes = randomColor();
        // const sizeForNodes = Math.floor(Math.random() * 25 + 1);

        const nodeAttributes = graph.getNodeAttributes(openedNode);
        const baseX = nodeAttributes.x ?? 0;
        const baseY = nodeAttributes.y ?? 0;
        const radius = 2;
        const number_of_nodes = graphResponse.nodes.length;

        graphResponse.nodes.forEach((node, index) => {
            if (!graph.hasNode(node.nodeId)) {
                const angle = (Math.PI * 2 * index) / number_of_nodes;
                graph.addNode(node.nodeId, {
                    x: baseX + Math.cos(angle) * radius,
                    y: baseY + Math.sin(angle) * radius,
                    size: 5,
                    color: colorForNodes,
                })
            }
        });

        graphResponse.edges.forEach((edge) => {
            if (!graph.hasEdge(edge.edgeId) && graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
                graph.addEdgeWithKey(edge.edgeId, edge.source, edge.target)
            };
        });

        appendLayoutVersion();
        appendGraphVersion();
    },

    appendLayoutVersion: () => {
        set((state) => ({layoutVersion: state.layoutVersion + 1}));
    },

    appendGraphVersion: () => {
        console.log("oskar");
        
        set((state) => ({graphVersion: state.graphVersion + 1}))
    },
//#endregion
}));

//#region Hooks for getters
export const useIsMockDataUsed = () => useClientStore((state) => {
    return state.isMockDataUsed;
});

export const useOpenedNode = () => useClientStore((state) => {
    return state.openedNode;
});

export const useLayoutVersion = () => useClientStore((state) => {
    return state.layoutVersion;
});

export const useGraphVersion = () => useClientStore((state) => {
    return state.graphVersion;
})

export const useIsLayoutRunning = () => useClientStore((state) => {
    return state.isLayoutRunning;
});

export const useIsNeedToBeReload = () => useClientStore((state) => {
    return state.isNeedToBeReload;
});
//#endregion

//#region Hooks for setters
export const useSetIsMockDataUsed = () => useClientStore((state) => {
    return state.setIsMockDataUsed;
})

export const useSetSigma = () => useClientStore((state) => {
    return state.setSigma;
});

export const useSetGraphResponse = () => useClientStore((state) => {
    return state.setGraphResponse;
});

export const useSetOpenedNode = () => useClientStore((state) => {
    return state.setOpenedNode;
})

export const useSetIsLayoutRunning = () => useClientStore((state => {
    return state.setIsLayoutRunning;
}))

export const useSetIsNeedToBeReload = () => useClientStore((state) => {
    return state.setIsNeedToBeReload;
})

//#endregion

//#region Hooks for actions
export const usePlaceSeedNode = () => useClientStore((state) => {
    return state.placeSeedNode;
});

export const useExpandGraph = () => useClientStore((state) => {
    return state.expandGraph;
});

export const useOneHop = () => useClientStore((state) => {
    return state.one_hop;
})

export const useResetCamera = () => useClientStore((state) => {
    return state.resetCamera;
});

export const useAppendLayoutVersion = () => useClientStore((state) => {
    return state.appendLayoutVersion;
})
//#endregion