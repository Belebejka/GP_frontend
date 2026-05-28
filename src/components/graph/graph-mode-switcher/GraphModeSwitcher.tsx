import asteriskIcon from "bootstrap-icons/icons/asterisk.svg?url";
import plusIcon from "bootstrap-icons/icons/plus-lg.svg?url";

import { useGraphMode, useSetGraphMode } from "../../../store/ClientStore";
import styles from "./GraphModeSwitcher.module.css";

const modes = [
    {
        id: "expand",
        icon: plusIcon,
        label: "Main graph mode",
    },
    {
        id: "cluster",
        icon: asteriskIcon,
        label: "Cluster mode",
    },
] as const;

export function GraphModeSwitcher() {
    const graphMode = useGraphMode();
    const setGraphMode = useSetGraphMode();

    return (
        <div className={styles.switcher} aria-label="Graph mode">
            {modes.map((mode) => {
                const isActive = graphMode === mode.id;

                return (
                    <button
                        key={mode.id}
                        type="button"
                        className={`${styles.button} ${isActive ? styles.buttonActive : ""}`}
                        onClick={() => setGraphMode(mode.id)}
                        aria-label={mode.label}
                        aria-pressed={isActive}
                        title={mode.label}
                    >
                        <img className={styles.icon} src={mode.icon} alt="" aria-hidden="true" />
                    </button>
                );
            })}
        </div>
    );
}
