import { useMemo } from "react";
import { useCloseDrawer, useSigmaInstance } from "../../../store/ClientStore";
import styles from "./NodeInfoContent.module.css";

type Field = {
    key: string;
    value: unknown;
};

const CORE_KEYS = new Set([
    "attributes",
    "displayName",
    "identifiers",
    "label",
    "nodeId",
    "nodeType",
    "rawNode",
    "statuses",
]);

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toFields = (value: unknown): Field[] => {
    if (!isRecord(value)) return [];

    return Object.entries(value)
        .filter(([, fieldValue]) => fieldValue !== undefined && fieldValue !== null && fieldValue !== "")
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([key, fieldValue]) => ({ key, value: fieldValue }));
};

const formatValue = (value: unknown): string => {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value);
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(formatValue).join(", ");

    return JSON.stringify(value, null, 2) ?? String(value);
};

function FieldList({ fields, emptyText }: { fields: Field[]; emptyText: string }) {
    if (!fields.length) {
        return <div className={styles.emptyState}>{emptyText}</div>;
    }

    return (
        <dl className={styles.fieldList}>
            {fields.map((field) => {
                const isComplex = isRecord(field.value) || Array.isArray(field.value);

                return (
                    <div key={field.key} className={`${styles.fieldRow} ${isComplex ? styles.fieldRowStacked : ""}`}>
                        <dt>{field.key}</dt>
                        <dd className={isComplex ? styles.codeValue : ""}>{formatValue(field.value)}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

export function NodeInfoContent({ nodeId }: { nodeId: string }) {
    const sigma = useSigmaInstance();
    const closeDrawer = useCloseDrawer();

    const nodeInfo = useMemo(() => {
        if (!sigma) return null;

        const graph = sigma.getGraph();
        if (!graph.hasNode(nodeId)) return null;

        const graphAttributes = graph.getNodeAttributes(nodeId) as Record<string, unknown>;
        const rawNode = isRecord(graphAttributes.rawNode) ? graphAttributes.rawNode : {};

        const displayName = String(graphAttributes.displayName ?? rawNode.displayName ?? nodeId);
        const type = String(graphAttributes.nodeType ?? rawNode.nodeType ?? "UNKNOWN");
        const identifiers = graphAttributes.identifiers ?? rawNode.identifiers;
        const statuses = Array.isArray(graphAttributes.statuses)
            ? graphAttributes.statuses
            : Array.isArray(rawNode.statuses)
                ? rawNode.statuses
                : [];
        const attributes = graphAttributes.attributes ?? rawNode.attributes;
        const sourceFields = toFields(rawNode).filter((field) => !CORE_KEYS.has(field.key));
        const technicalFields = toFields(graphAttributes).filter((field) => !CORE_KEYS.has(field.key));

        return {
            displayName,
            type,
            identifiers: toFields(identifiers),
            statuses: statuses.filter((status): status is string => typeof status === "string"),
            attributes: toFields(attributes),
            sourceFields,
            technicalFields,
        };
    }, [nodeId, sigma]);

    if (!nodeInfo) {
        return (
            <>
                <header className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>NODE INFO</div>
                        <h2 className={styles.title}>Информация</h2>
                    </div>

                    <button type="button" onClick={closeDrawer} className={styles.closeButton} aria-label="Закрыть информацию">
                        X
                    </button>
                </header>

                <div className={styles.content}>
                    <div className={styles.errorState}>Нода не найдена в текущем графе.</div>
                </div>
            </>
        );
    }

    return (
        <>
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>NODE INFO</div>
                    <h2 className={styles.title}>Информация</h2>
                </div>

                <button type="button" onClick={closeDrawer} className={styles.closeButton} aria-label="Закрыть информацию">
                    X
                </button>
            </header>

            <div className={styles.content}>
                <section className={styles.heroCard}>
                    <div className={styles.nodeName}>{nodeInfo.displayName}</div>
                    <div className={styles.nodeId}>{nodeId}</div>
                    <div className={styles.typePill}>{nodeInfo.type}</div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionTitle}>Статусы</div>
                    {nodeInfo.statuses.length > 0 ? (
                        <div className={styles.chips}>
                            {nodeInfo.statuses.map((status) => <span key={status} className={styles.chip}>{status}</span>)}
                        </div>
                    ) : (
                        <div className={styles.emptyState}>Статусы не указаны.</div>
                    )}
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionTitle}>Идентификаторы</div>
                    <FieldList fields={nodeInfo.identifiers} emptyText="Идентификаторы не указаны." />
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionTitle}>Атрибуты</div>
                    <FieldList fields={nodeInfo.attributes} emptyText="Атрибуты не указаны." />
                </section>

                {nodeInfo.sourceFields.length > 0 && (
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Исходные поля</div>
                        <FieldList fields={nodeInfo.sourceFields} emptyText="Дополнительных исходных полей нет." />
                    </section>
                )}

                {nodeInfo.technicalFields.length > 0 && (
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>Поля графа</div>
                        <FieldList fields={nodeInfo.technicalFields} emptyText="Дополнительных полей нет." />
                    </section>
                )}
            </div>
        </>
    );
}
