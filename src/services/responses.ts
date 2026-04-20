import axios from "axios"
import type { GraphSearchRequest, GraphResponse, ExpandRequest } from "./types";

export async function searchGraph(payload: GraphSearchRequest) {
    try {
        const { data } : {data: GraphResponse} = await axios.post('/api/v1/graph/search', payload);
        
        return data;
    } catch (e) {
    }
}

export async function getExpandPreview(payload: ExpandRequest) {
    try {
        const { data } = await axios.post('/api/v1/graph/expand-preview', payload);
        return data;
    } catch (e) {
    }

}

export async function expandGraph(payload: ExpandRequest) {
    try {
        const { data } : {data: GraphResponse} = await axios.post('/api/v1/graph/expand', payload);
        return data;
    } catch (e) {
        console.log(e);
    }
}

//#region Only mock
export type MockRootItem = {
  nodeId: string
  entityType: string
  displayName: string
}

export type MockRootsResponse = {
  items: MockRootItem[]
  meta: {
    total: number
  }
}

export async function getMockRoots(limit = 50) {
    try {
        const { data } : {data: MockRootsResponse} = await axios.get(`/api/v1/graph/mock-roots?limit=${limit}`);
        return data;
    } catch (e) {
        console.log(e);
    }


}
//#endregion