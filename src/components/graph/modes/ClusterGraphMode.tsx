import { ClusterContextMenus } from "../clusters/ClusterContextMenus";
import { ClusterGraphEvents } from "../clusters/ClusterGraphEvents";
import { ClusterHighlightController } from "../clusters/ClusterHighlightController";
import { ClusterHoverDetails } from "../clusters/ClusterHoverDetails";
import { ClustersList } from "../clusters/ClustersList";

export function ClusterGraphMode() {
    return (
        <>
            <ClusterGraphEvents />
            <ClusterHighlightController />
            <ClusterContextMenus />
            <ClusterHoverDetails />
            <ClustersList />
        </>
    );
}
