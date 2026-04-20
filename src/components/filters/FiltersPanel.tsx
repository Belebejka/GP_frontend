import { useResetCamera, useSetIsNeedToBeReload, useIsLayoutRunning, useIsMockDataUsed, useSetIsMockDataUsed, usePlaceSeedNode, useSetOpenedNode } from "../../store/ClientStore";
import { worker } from "../../mock/browser";
import { useEffect, useState } from "react";
import { useSetTimeOfWorking, useTimeOfWorking } from "../../store/LayoutSettingsStore";

async function enableMocking(setUseMockData) {
	if (import.meta.env.DEV) {
        await worker.start();
		setUseMockData();
	}
}

function PlaceSeedNodeButton() {
    const placeSeedNode = usePlaceSeedNode();
    const setOpenedNode = useSetOpenedNode();

    const isLayoutRunning = useIsLayoutRunning();

    const [isPlaced, setIsPlaced] = useState(false);

    useEffect(() => {
        if (isPlaced && !isLayoutRunning) {
            setOpenedNode("seedNode");
            setIsPlaced(false);
        } 
    }, [isLayoutRunning]);

    return <button onClick={() => {
        setIsPlaced(placeSeedNode());
    }}>
        get seed node
    </button>
}

function ReloadLayout() {
    const isLayoutRunning = useIsLayoutRunning();

    const setIsNeedToBeReload = useSetIsNeedToBeReload();

    const options = [500, 1000, 1500, 2000, 5000];
    
    const timeOfWorking = useTimeOfWorking();
    const setTimeOfWorking = useSetTimeOfWorking();

    return <div>
        <button style={{margin: "10px"}} disabled={isLayoutRunning} onClick={() => {
            setIsNeedToBeReload(true);
        }}>
            reloadLayot
        </button>
        <select value={timeOfWorking} onChange={(e) => {
            const time = e.target.value as unknown as number;
            if (time) setTimeOfWorking(time);
        }}>
            {options.map((option) => {
                return <option>
                    {option}
                </option>
            })}
        </select>
    </div>
}

export default function FiltersPanel() {
    const isMockDataUsed = useIsMockDataUsed();
    const setIsMockDataUsed = useSetIsMockDataUsed();

    const resetCamera = useResetCamera();

    return <div style={{
        height: "100vh",
        width: "500px",
        backgroundColor: "lightgray",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-around",
    }}>
        {isMockDataUsed 
        ?
        <>
            <PlaceSeedNodeButton />
        </>
        : 
        <button onClick={() => enableMocking(setIsMockDataUsed)}>use mock</button>
        }
        <button onClick={() => {
            resetCamera();
        }}>
            reset
        </button>
        <ReloadLayout />
    </div>
}