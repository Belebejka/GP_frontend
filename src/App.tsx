import GraphComponent from "./graph/GraphComponent"; 
import { useExpandGraph, useIsLayoutRunning, useResetCamera, useSetIsNeedToBeReload } from "./store/SigmaStore";

function FiltersComponent() {
const resetCamera = useResetCamera();
const setIsNeedToBeReload = useSetIsNeedToBeReload();
const isLayoutRunning = useIsLayoutRunning();

return <div style={{
  height: "100vh",
  width: "500px",
  backgroundColor: "lightgray",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-around",
}}>
  <button onClick={() => {
    resetCamera();
  }}>
    reset
  </button>
  <button disabled={isLayoutRunning} onClick={() => {
    setIsNeedToBeReload(true);
  }}>
    reloadLayot
  </button>
</div>
} 

function App() {
  return <div style={{
    display: "flex",
    margin: 0,
  }}>
    <FiltersComponent />
    <GraphComponent />
  </div>
}

export default App
