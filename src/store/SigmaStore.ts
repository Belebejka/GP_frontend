import { fitViewportToNodes } from "@sigma/utils";
import type { Sigma } from "sigma";
import { create } from "zustand";

type SigmaStore = {
    sigma: Sigma | null;
    openedNode: string | null;
    layoutVersion: number;
    isLayoutRunning: boolean;
    isNeedToBeReload: boolean;
    setSigma: (sigma: Sigma) => void;
    setOpenedNode: (node: string | null) => void;
    setIsLayoutRunning: (isRunning: boolean) => void;
    setIsNeedToBeReload: (need: boolean) => void;
    resetCamera: () => void;
    expandGraph: () => void;
    appendLayoutVersion: () => void;
}

const useSigmaStore = create<SigmaStore>((set, get) => ({
    sigma: null,
    openedNode: null,
    layoutVersion: 0,
    isLayoutRunning: false,
    isNeedToBeReload: false,

//#region Setters
    setSigma: (sigma) => set(() => ({sigma: sigma})),
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
    resetCamera: () => {
        const { sigma } = get();
        if (!sigma) return;

        sigma.setCustomBBox(null);
        sigma.refresh();

        fitViewportToNodes(
            sigma,
            sigma.getGraph().nodes(),
            { animate: true}
        );
    },

    expandGraph: () => {
        const { sigma, openedNode } = get();

        if (!sigma || !openedNode) return;

        const graph = sigma.getGraph();
        const nodeAttributes = graph.getNodeAttributes(openedNode);

        const baseX = nodeAttributes.x ?? 0;
        const baseY = nodeAttributes.y ?? 0;
        const radius = 10;

        for (let i = 0; i < 3; i++) {
            const newNodeId = `${openedNode}${i + 1}`;
            if (graph.hasNode(newNodeId)) continue;

            const angle = (Math.PI * 2 * i) / 3;

            graph.addNode(newNodeId, {
                ...nodeAttributes,
                x: baseX + Math.cos(angle) * radius,
                y: baseY + Math.sin(angle) * radius,
                fixed: false,
            });

            graph.addEdge(openedNode, newNodeId);
        }
        graph.addEdge(`${openedNode}${1}`, `${openedNode}${2}`)

        set((state) => ({layoutVersion: state.layoutVersion + 1}));
    },

    appendLayoutVersion: () => {
        set((state) => ({layoutVersion: state.layoutVersion + 1}));
    },
//#endregion
}));

//#region Hooks for getters
export const useOpenedNode = () => useSigmaStore((state) => {
    return state.openedNode;
});

export const useLayoutVersion = () => useSigmaStore((state) => {
    return state.layoutVersion;
});

export const useIsLayoutRunning = () => useSigmaStore((state) => {
    return state.isLayoutRunning;
});

export const useIsNeedToBeReload = () => useSigmaStore((state) => {
    return state.isNeedToBeReload;
});
//#endregion

//#region Hooks for setters
export const useSetSigma = () => useSigmaStore((state) => {
    return state.setSigma;
});

export const useSetOpenedNode = () => useSigmaStore((state) => {
    return state.setOpenedNode;
})

export const useSetIsLayoutRunning = () => useSigmaStore((state => {
    return state.setIsLayoutRunning;
}))

export const useSetIsNeedToBeReload = () => useSigmaStore((state) => {
    return state.setIsNeedToBeReload;
})

//#endregion

//#region Hooks for actions
export const useExpandGraph = () => useSigmaStore((state) => {
    return state.expandGraph;
});

export const useResetCamera = () => useSigmaStore((state) => {
    return state.resetCamera;
});

export const useAppendLayoutVersion = () => useSigmaStore((state) => {
    return state.appendLayoutVersion;
})
//#endregion