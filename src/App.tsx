import { useEffect, useState } from "react";
import GraphComponent from "./components/graph/GraphComponent";
import ToolsPanel from "./components/tools/ToolsPanel";
import { Drawer } from "./components/drawer/Drawer";
import { useCloseDrawer, useDrawerState, useGraphMode } from "./store/ClientStore";
import styles from "./App.module.css";
import { worker } from "./mock/browser";
import { setApiBaseUrl } from "./services/responses";

function DeveloperScreen({ setIsReady }) {
    const onMock = async () => {
        setApiBaseUrl();

        if (import.meta.env.DEV) {
            await worker.start({
                onUnhandledRequest(request, print) {
                    const url = new URL(request.url);

                    if (!url.pathname.startsWith("/api/")) {
                        return;
                    }

                    print.warning();
                },
            });
        }

        setIsReady(true);
    }

    const onRealApi = () => {
        setApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
        setIsReady(true);
    }

    return <div className={styles.developerScreen}>
        <div className={styles.developerCard}>
            <p className={styles.developerEyebrow}>режим разработчика</p>
            <h1 className={styles.developerTitle}>Graph project</h1>
            <p className={styles.developerSubtitle}>Выбрать источник данных перед запуском приложения</p>

            <div className={styles.developerActions}>
                <button className={styles.developerButton} onClick={onMock}>
                    Mock
                </button>
                <button className={styles.developerButton} onClick={onRealApi}>
                    Реальный API
                </button>
            </div>
        </div>
    </div>

}

function MainScreen() {
    const drawerState = useDrawerState();
    const closeDrawer = useCloseDrawer();
    const graphMode = useGraphMode();
    const isDrawerOpened = Boolean(drawerState);

    useEffect(() => {
        window.dispatchEvent(new Event("resize"));
    }, [isDrawerOpened]);

    return (
        <div className={styles.shell} data-graph-mode={graphMode}>
            <div className={styles.mainArea}>
                <div className={styles.panelArea}>
                    <ToolsPanel />
                </div>

                <div className={styles.graphArea}>
                    <GraphComponent />
                </div>

                {isDrawerOpened && (
                    <button
                        type="button"
                        className={styles.backdrop}
                        onClick={closeDrawer}
                        aria-label="Закрыть панель"
                    />
                )}
            </div>

            {isDrawerOpened && <Drawer />}
        </div>
    );
}

function App() {
    const [isReady, setIsReady] = useState(false)

    if (!isReady) {
        return (
            <DeveloperScreen setIsReady={setIsReady}/>
        )
    }

    return <MainScreen />
}

export default App;
