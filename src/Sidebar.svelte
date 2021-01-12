<script>
  import { onMount, onDestroy } from "svelte";
  import { isEqual } from "lodash-es";
  import { fade } from "svelte/transition";
  import { getFieldData, lockEntry, unlockEntry } from "./utils";
  import { EntryState } from "./entrystate";

  export let sdk;
  const { url, apiKey } = sdk.parameters.installation;
  $: console.log(`Params: ${JSON.stringify({ url, apiKey })}`);
  let beforeCheckoutFieldValues = getFieldData(sdk.entry.fields);
  let entryState = EntryState.EDITABLE;
  $: console.log(`entryState: ${entryState}`);
  const detachFieldHandlers = [];
  let resettingValue = false;
  let fetchedInitialEntryData = false;

  let disableButton = false;

  function assignFieldHandlers() {
    // register handlers to reset values
    for (const fieldsKey in sdk.entry.fields) {
      const field = sdk.entry.fields[fieldsKey];
      detachFieldHandlers.push(
        field.onValueChanged((value) => {
          // if we are in a readonly state, don't save any changes
          if (
            (entryState == EntryState.EDITABLE ||
              entryState == EntryState.READ_ONLY) &&
            !isEqual(value, beforeCheckoutFieldValues[fieldsKey])
          ) {
            console.group("Value changed");
            console.log(`Detected change in field: ${fieldsKey}`);
            console.log(`New value is ${value}`);
            console.log(`Old value is ${beforeCheckoutFieldValues[fieldsKey]}`);
            console.log(`Entry state is ${entryState}`);
            console.groupEnd();
            if (!resettingValue) {
              // special case to deal with slugs in newly created entries
              if (typeof value == "string" && value.includes("untitled")) {
                beforeCheckoutFieldValues[field.id] = beforeCheckoutFieldValues[
                  field.id
                ].substr(9);
                return;
              }
              resettingValue = true;
              field.setValue(beforeCheckoutFieldValues[field.id]).then(() => {
                resettingValue = false;
              });
              let message = "";
              if (entryState == EntryState.EDITABLE)
                message =
                  "You are viewing the current entry in read only mode!";
              else if (entryState == EntryState.READ_ONLY)
                message = "Some else is editing!";
              sdk.dialogs.openAlert({
                title: "Warning!",
                message: message,
                shouldCloseOnOverlayClick: false,
              });
            }
          }
        })
      );
    }
  }

  async function checkEntry() {
    try {
      const response = await fetch(url + `${sdk.entry.getSys().id}/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      });
      const data = await response.json();
      console.log(`Fetched remote data: ${JSON.stringify(data)}`);

      if (data.entryState == "EDITING") {
        // current user has previously checked out
        if (data.userId == sdk.user.sys.id) {
          entryState = EntryState.EDITING;
          beforeCheckoutFieldValues = data.initialValues;
        } else {
          entryState = EntryState.READ_ONLY;
        }
      }
    } catch (err) {
      // entry doesn't exist in db
      console.log(
        `Error calling api ${url + `${sdk.entry.getSys().id}/status`}`
      );
    }
  }

  onMount(async () => {
    console.log("Starting window resizer");
    sdk.window.startAutoResizer();
    assignFieldHandlers();

    // call api to check if entry is editable
    await checkEntry();

    fetchedInitialEntryData = true;
  });

  onDestroy(() => {
    console.log("stopping window resizer");
    sdk.window.stopAutoResizer();
    detachFieldHandlers.forEach((detachHandler) => {
      detachHandler();
    });
  });

  async function checkout() {
    console.group("checkout");
    console.log("checking entry");
    await checkEntry();
    if (entryState == EntryState.READ_ONLY) {
      console.groupEnd();
      return;
    }
    await lockEntry(url, apiKey, {
      userId: sdk.user.sys.id,
      entryId: sdk.entry.getSys().id,
      initialValues: beforeCheckoutFieldValues,
    });
    entryState = EntryState.EDITING;
    console.groupEnd();
  }

  async function commit() {
    console.group("Commit");
    console.log("checking entry");
    await checkEntry();
    if (entryState == EntryState.READ_ONLY) return;
    console.log("Commiting data");
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        entryId: sdk.entry.getSys().id,
        details: Date.now().toString(),
        data: getFieldData(sdk.entry.fields),
      }),
    }).then(() => {
      unlockEntry(url, apiKey, {
        userId: sdk.user.sys.id,
        entryId: sdk.entry.getSys().id,
      }).then(() => {
        entryState = EntryState.EDITABLE;
        beforeCheckoutFieldValues = getFieldData(sdk.entry.fields);
      });
    });
    console.log("Data commited");
    console.groupEnd();
  }

  async function rollback() {
    console.group("Rollback");
    console.log("checking entry");
    await checkEntry();
    if (entryState == EntryState.READ_ONLY) return;
    console.log("Rolling back data");
    const setFieldPromises = [];
    for (const fieldsKey in sdk.entry.fields) {
      setFieldPromises.push(
        sdk.entry.fields[fieldsKey].setValue(
          beforeCheckoutFieldValues[fieldsKey]
        )
      );
    }
    await Promise.all(setFieldPromises);
    await unlockEntry(url, apiKey, {
      userId: sdk.user.sys.id,
      entryId: sdk.entry.getSys().id,
    });
    entryState = EntryState.EDITABLE;
    console.log("Rolled back data");
    console.groupEnd();
  }
</script>

<style>
  .container {
    display: flex; /* or inline-flex */
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-evenly;
  }

  .container > button {
    flex-grow: 1;
    display: inline;
    padding: 0.7rem;
    border-radius: 3px;
  }

  #checkout-btn {
    color: var(--color-white);
    background-color: var(--color-green-mid);
    border-color: var(--color-green-mid);
  }

  #checkout-btn:hover {
    color: var(--color-white);
    background-color: var(--color-green-dark);
    border-color: var(--color-green-dark);
  }

  #checkin-btn {
    color: var(--color-white);
    background-color: var(--color-blue-mid);
    border-color: var(--color-blue-mid);
    margin-right: 0.1rem;
  }

  #checkin-btn:hover {
    color: var(--color-white);
    background-color: var(--color-blue-dark);
    border-color: var(--color-blue-dark);
  }

  #discard-btn {
    color: var(--color-white);
    background-color: var(--color-red-mid);
    border-color: var(--color-red-mid);
    margin-left: 0.1rem;
  }

  #discard-btn:hover {
    color: var(--color-white);
    background-color: var(--color-red-base);
    border-color: var(--color-red-base);
  }
</style>

<div class="container">
  {#if !fetchedInitialEntryData}
    <p>Loading...</p>
  {:else if entryState == EntryState.READ_ONLY}
    Some else is editing this entry!
  {:else if entryState == EntryState.EDITABLE}
    <button
      in:fade={{ duration: 300 }}
      id="checkout-btn"
      disabled={disableButton}
      on:click={() => {
        disableButton = !disableButton;
        checkout().then(() => {
          disableButton = !disableButton;
        });
      }}>Checkout
    </button>
  {:else if entryState == EntryState.EDITING}
    <button
      in:fade={{ duration: 300 }}
      id="checkin-btn"
      disabled={disableButton}
      on:click={() => {
        disableButton = !disableButton;
        commit().then(() => {
          disableButton = !disableButton;
        });
      }}>Check In</button>
    <button
      in:fade={{ duration: 300 }}
      id="discard-btn"
      disabled={disableButton}
      on:click={() => {
        disableButton = !disableButton;
        rollback().then(() => {
          disableButton = !disableButton;
        });
      }}>Discard</button>
  {/if}
</div>
