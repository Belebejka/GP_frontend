import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useFullGraphMutation } from "../../services/queries";
import {
    useClusterFocusOnSelect,
    useClusters,
    useFocusOnSelect,
    useGraphMode,
    useGrowNodesOnZoom,
    useIsLayoutRunning,
    usePlaceSeedNode,
    useReplaceGraph,
    useSetAllNodesToReload,
    useSetAllNodesToResetCamera,
    useSetClusterFocusOnSelect,
    useSetFocusOnSelect,
    useSetGrowNodesOnZoom,
    useSetNodesToReload,
    useSetOpenedNode,
    useSetShowHoveredEdgeDetails,
    useSetShowHoveredNodeDetails,
    useShowHoveredEdgeDetails,
    useShowHoveredNodeDetails,
} from "../../store/ClientStore";
import { useTimeOfWorking } from "../../store/LayoutSettingsStore";
import styles from "./ToolsPanel.module.css";

const formatLayoutDuration = (duration: number) => {
    if (duration < 1000) return `${duration} ms`;
    if (duration < 60000) return `${duration / 1000} s`;
    if (duration < 3600000) return `${duration / 60000} min`;

    return `${duration / 3600000} h`;
};

function PlaceSeedNodeButton() {
    const placeSeedNode = usePlaceSeedNode();
    const setOpenedNode = useSetOpenedNode();
    const setNodesToReload = useSetNodesToReload();
    const isLayoutRunning = useIsLayoutRunning();
    const [isPlaced, setIsPlaced] = useState(false);

    useEffect(() => {
        if (!isPlaced) return;  

        const timeOut = setTimeout(() => {
            setNodesToReload([]);
            setOpenedNode("seedNode");
            setIsPlaced(false);
            
        }, 1000);

        return () => clearTimeout(timeOut);
    }, [isPlaced]);

    return (
        <button
            disabled={isLayoutRunning}
            onClick={() => setIsPlaced(placeSeedNode())}
            className={styles.button}
        >
            использовать опорный узел
        </button>
    );
}

export function LoadFullGraphButton() {
    const fullGraphMutation = useFullGraphMutation();
    const replaceGraph = useReplaceGraph();
    const isLayoutRunning = useIsLayoutRunning();

    const loadFullGraph = async () => {
        try {
            const data = await fullGraphMutation.mutateAsync();
            replaceGraph(data);
        } catch (error) {
            let message = "Не удалось загрузить весь граф.";

            if (axios.isAxiosError(error)) {
                const response = error.response?.data as { message?: string; detail?: string; traceId?: string } | undefined;
                message = response?.message ?? response?.detail ?? message;
                if (response?.traceId) {
                    message = `${message} (traceId: ${response.traceId})`;
                }
            }

            window.alert(message);
            console.error("Full graph loading failed", error);
        }
    };

    return (
        <button
            disabled={isLayoutRunning || fullGraphMutation.isPending}
            onClick={loadFullGraph}
            className={styles.button}
        >
            {fullGraphMutation.isPending ? "Загружаем..." : "Загрузить весь граф"}
        </button>
    );
}

function ReloadLayout({
    getNodeIdsToReload,
    disabled = false,
}: {
    getNodeIdsToReload?: () => string[];
    disabled?: boolean;
}) {
    const isLayoutRunning = useIsLayoutRunning();
    const setAllNodesToReload = useSetAllNodesToReload();
    const setNodesToReload = useSetNodesToReload();
    const defaultLayoutTime = useTimeOfWorking();

    const options = [500, 1000, 5000, 15000, 60000, 300000, 3600000];
    const [selectedOption, setSelectedOption] = useState(defaultLayoutTime);
    const [reloadTrigger, setReloadTrigger] = useState(true);
    const [isPaused, setIsPaused] = useState(true);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (isPaused) return;

        if (getNodeIdsToReload) {
            setNodesToReload(getNodeIdsToReload());
        } else {
            setAllNodesToReload();
        }
        setProgress(100);

        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.max(0, 100 - (elapsed / selectedOption) * 100);
            setProgress(newProgress);
        }, 25);

        const timeout = setTimeout(() => {
            setNodesToReload([]);
            setIsPaused(true);
            clearInterval(interval);
            setProgress(100);
        }, selectedOption);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [getNodeIdsToReload, isPaused, reloadTrigger, selectedOption, setAllNodesToReload, setNodesToReload]);

    const handleStart = () => {
        if (disabled) return;
        setIsPaused(false);
        setReloadTrigger((value) => !value);
    };

    const handlePause = () => {
        setIsPaused(true);
        setNodesToReload([]);
        setProgress(100);
    };

    return (
        <div className={styles.reloadLayout}>
            <div className={styles.progressTrack}>
                <div
                    className={styles.progressFill}
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className={styles.controlsRow}>
                {!isPaused ? (
                    <button
                        className={styles.iconButton}
                        onClick={handlePause}
                        title="Стоп"
                    >
                        ⏸
                    </button>
                ) : (
                    <button
                        className={styles.iconButton}
                        disabled={isLayoutRunning || disabled}
                        onClick={handleStart}
                        title="Погнали"
                    >
                        ▶
                    </button>
                )}
                <select
                    value={selectedOption}
                    onChange={(event) => setSelectedOption(Number(event.target.value))}
                    className={styles.select}
                >
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {formatLayoutDuration(option)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function HoverNodeDetailsToggle() {
    const showHoveredNodeDetails = useShowHoveredNodeDetails();
    const setShowHoveredNodeDetails = useSetShowHoveredNodeDetails();

    return (
        <label className={styles.checkboxLabel}>
            <input
                type="checkbox"
                checked={showHoveredNodeDetails}
                onChange={(event) => setShowHoveredNodeDetails(event.target.checked)}
                className={styles.checkbox}
            />
            <span>Показывать hover-карточку для нод</span>
        </label>
    );
}

function HoverEdgeDetailsToggle() {
    const showHoveredEdgeDetails = useShowHoveredEdgeDetails();
    const setShowHoveredEdgeDetails = useSetShowHoveredEdgeDetails();

    return (
        <label className={styles.checkboxLabel}>
            <input
                type="checkbox"
                checked={showHoveredEdgeDetails}
                onChange={(event) => setShowHoveredEdgeDetails(event.target.checked)}
                className={styles.checkbox}
            />
            <span>Показывать hover-карточку для рёбер</span>
        </label>
    );
}

function FocusOnSelectToggle() {
    const focusOnSelect = useFocusOnSelect();
    const setFocusOnSelect = useSetFocusOnSelect();

    return (
        <label className={styles.checkboxLabel}>
            <input
                type="checkbox"
                checked={focusOnSelect}
                onChange={(event) => setFocusOnSelect(event.target.checked)}
                className={styles.checkbox}
            />
            <span>Приближать к ноде/ребру по нажатию</span>
        </label>
    );
}

function ClusterFocusOnSelectToggle() {
    const clusterFocusOnSelect = useClusterFocusOnSelect();
    const setClusterFocusOnSelect = useSetClusterFocusOnSelect();

    return (
        <label className={styles.checkboxLabel}>
            <input
                type="checkbox"
                checked={clusterFocusOnSelect}
                onChange={(event) => setClusterFocusOnSelect(event.target.checked)}
                className={styles.checkbox}
            />
            <span>Приближать к выбранному кластеру</span>
        </label>
    );
}

function GrowNodesOnZoomToggle() {
    const growNodesOnZoom = useGrowNodesOnZoom();
    const setGrowNodesOnZoom = useSetGrowNodesOnZoom();

    return (
        <label className={styles.checkboxLabel}>
            <input
                type="checkbox"
                checked={growNodesOnZoom}
                onChange={(event) => setGrowNodesOnZoom(event.target.checked)}
                className={styles.checkbox}
            />
            <span>Установить динамический размер нод</span>
        </label>
    );
}

function HoverSettingsSections() {
    return (
        <>
            <div className={styles.section}>
                <div className={styles.card}>
                    <FocusOnSelectToggle />
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.card}>
                    <HoverNodeDetailsToggle />
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.card}>
                    <HoverEdgeDetailsToggle />
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.card}>
                    <GrowNodesOnZoomToggle />
                </div>
            </div>
        </>
    );
}

function CenteredText({ children }: { children: string }) {
    return (
        <div
            className={styles.centeredText}
            style={{
                border: "none",
                margin: "0",
                padding: "16px 0",
            }}
        >
            {children}
        </div>
    );
}

function ExpandToolsPanel() {
    const setAllNodesToResetCamera = useSetAllNodesToResetCamera();

    return (
        <div className={styles.panel}>
            <div className={styles.topGroup}>
                <p className={styles.panelTitle}>ИНСТРУМЕНТЫ</p>

                <div className={styles.section}>
                    <div className={styles.card}>
                        <PlaceSeedNodeButton />

                        <button
                            onClick={() => setAllNodesToResetCamera()}
                            className={styles.button}
                        >
                            показать граф
                        </button>
                    </div>
                </div>

                <HoverSettingsSections />
            </div>

            <CenteredText>wake up samurai</CenteredText>

            <div className={styles.section}>
                <div className={styles.card}>
                    <p className={styles.title}>перезагрузка layout</p>
                    <p className={styles.subtitle}>включение силового алгоритма для всех нод</p>
                    <ReloadLayout />
                </div>
            </div>
        </div>
    );
}

function ClusterLayoutReload() {
    const clustersById = useClusters();
    const clusters = useMemo(() => Array.from(clustersById.values()), [clustersById]);
    const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    useEffect(() => {
        const existingClusterIds = new Set(clustersById.keys());
        setSelectedClusterIds((current) => current.filter((clusterId) => existingClusterIds.has(clusterId)));
    }, [clustersById]);

    const selectedNodeIds = useMemo(() => {
        const nodeIds = selectedClusterIds.flatMap((clusterId) => clustersById.get(clusterId)?.nodeIds ?? []);
        return Array.from(new Set(nodeIds));
    }, [clustersById, selectedClusterIds]);

    const getNodeIdsToReload = () => selectedNodeIds;
    const isDisabled = selectedClusterIds.length === 0 || selectedNodeIds.length === 0;
    const selectedLabel = selectedClusterIds.length > 0
        ? `${selectedClusterIds.length} selected / ${selectedNodeIds.length} nodes`
        : "выбрать кластеры";

    return (
        <>
            <div className={styles.clusterPicker}>
                <button
                    type="button"
                    onClick={() => setIsPickerOpen((current) => !current)}
                    className={styles.button}
                >
                    {selectedLabel}
                </button>

                {isPickerOpen && (
                    <div className={styles.clusterPickerPopover}>
                        {clusters.length === 0 ? (
                            <div className={styles.emptyPicker}>no clusters</div>
                        ) : clusters.map((cluster) => {
                            const isSelected = selectedClusterIds.includes(cluster.clusterId);

                            return (
                                <label key={cluster.clusterId} className={styles.clusterPickerOption}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(event) => {
                                            setSelectedClusterIds((current) => event.target.checked
                                                ? [...current, cluster.clusterId]
                                                : current.filter((clusterId) => clusterId !== cluster.clusterId));
                                        }}
                                        className={styles.checkbox}
                                    />
                                    <span>{cluster.name}</span>
                                    <span className={styles.clusterPickerCount}>{cluster.nodeIds.length}</span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>

            <p className={styles.subtitle}>layout только для выбранных кластеров</p>
            <ReloadLayout getNodeIdsToReload={getNodeIdsToReload} disabled={isDisabled} />
        </>
    );
}

function ClusterToolsPanel() {
    const setAllNodesToResetCamera = useSetAllNodesToResetCamera();

    return (
        <div className={styles.panel}>
            <div className={styles.topGroup}>
                <p className={styles.panelTitle}>ИНСТРУМЕНТЫ</p>

                <div className={styles.section}>
                    <div className={styles.card}>
                        <button
                            onClick={() => setAllNodesToResetCamera()}
                            className={styles.button}
                        >
                            показать граф
                        </button>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.card}>
                        <ClusterFocusOnSelectToggle />
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.card}>
                        <GrowNodesOnZoomToggle />
                    </div>
                </div>
            </div>

            <CenteredText>we have a city to burn</CenteredText>

            <div className={styles.section}>
                <div className={styles.card}>
                    <p className={styles.title}>перезагрузка layout</p>
                    <ClusterLayoutReload />
                </div>
            </div>
        </div>
    );
}

export default function ToolsPanel() {
    const graphMode = useGraphMode();

    if (graphMode === "cluster") {
        return <ClusterToolsPanel />;
    }

    return <ExpandToolsPanel />;
}
