import { EntryState } from "./entrystate";

export function getFieldData(fields) {
    console.group("getFieldData");
    const fieldsData = {};
    for (const fieldsKey in fields) {
        const field = fields[fieldsKey];
        fieldsData[fieldsKey] = field.getValue();
        console.log(`Currently setting initial state for ${fieldsKey}`);
        console.log(fieldsData[fieldsKey]);
    }
    console.groupEnd();
    return fieldsData;
}

export async function lockEntry(url, apiKey, data) {
    console.group("lockEntry");
    console.log("Locking entry");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
        },
        body: JSON.stringify({
            ...data,
            details: "status",
            entryState: EntryState.EDITING,
        }),
    });
    console.log("Entry Locked");
    console.groupEnd();
    return response.json();
}

export async function unlockEntry(url, apiKey, data) {
    console.group("unlockEntry");
    console.log("Unlocking entry");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
        },
        body: JSON.stringify({
            ...data,
            details: "status",
            entryState: EntryState.EDITABLE,
        }),
    });
    console.log("Entry Unlocked");
    console.groupEnd();
    return response.json();
}