import { setupWorker } from "msw/browser";
import { graphHandlers } from "./handlers/graph";

export const worker = setupWorker(...graphHandlers);