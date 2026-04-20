import GraphComponent from "./components/graph/GraphComponent";
import FiltersPanel from "./components/filters/FiltersPanel";

function App() {
	return <div style={{
		display: "flex",
		margin: 0,
	}}>
		<FiltersPanel />
		<GraphComponent />
	</div>
}

export default App
