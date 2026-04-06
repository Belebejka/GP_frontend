import Graph from "graphology";
import { random } from "graphology-layout";

export function getGraph() {
    const graph = new Graph();
    graph.addNode("siska", {
        color: "#ffe76f", 
        size: 5,
    });

    graph.addNode("piska", {
        color: "#ffe76f",
        size: 5,
    });

    graph.addNode("pipiska", {
        color: "#ffe76f",
        size: 5,
    });

    graph.addEdge("pipiska", "piska")
    graph.addEdge("piska", "siska")
    graph.addEdge("siska", "pipiska")

    random.assign(graph, { scale: 10 });

    return graph;
}