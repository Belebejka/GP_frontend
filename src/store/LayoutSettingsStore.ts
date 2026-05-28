import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import { create } from "zustand";

type LayoutSettingsStore = {
    settings: ForceAtlas2Settings;
    timeOfWorking: number;

    setSettings: (newSettings: ForceAtlas2Settings) => void;
    setTimeOfWorking: (newTime: number) => void;
}

const useLayoutSettingsStore = create<LayoutSettingsStore>((set) => ({
    settings: { 
        slowDown: 10,
        scalingRatio: 50,
        gravity: 10,
        strongGravityMode: false,
        adjustSizes: true,
        edgeWeightInfluence: 0,
    },
    timeOfWorking: 5000,

    setSettings: (newSettings) => set(() => ({settings: newSettings})),
    setTimeOfWorking: (newTime) => set(() => ({timeOfWorking: newTime})),
}));

export const useSettingsOfLayout = () => useLayoutSettingsStore((state) => state.settings);
export const useTimeOfWorking = () => useLayoutSettingsStore((state) => state.timeOfWorking);

export const useSetSettingsOfLayout = () => useLayoutSettingsStore((state) => state.setSettings);
export const useSetTimeOfWorking = () => useLayoutSettingsStore((state) => state.setTimeOfWorking);
