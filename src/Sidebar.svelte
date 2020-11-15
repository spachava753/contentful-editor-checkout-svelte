<script>
  import {onMount, onDestroy} from 'svelte';
  import {isEqual, isEmpty} from 'lodash-es';
  import {fade} from 'svelte/transition';

  const EntryState = {
    EDITABLE: "EDITABLE",
    EDITING: "EDITING",
    READ_ONLY: "READ_ONLY"
  };

  export let sdk;
  const {url, apiKey} = sdk.parameters.installation;
  $: console.log(`Params: ${JSON.stringify({url, apiKey})}`);
  let beforeCheckoutFieldValues = getFieldData(sdk.entry.fields);
  let entryState = EntryState.EDITABLE;
  $: console.log(`entryState: ${entryState}`);
  const detachFieldHandlers = [];
  let resettingValue = false;
  let fetchedInitialEntryData = false;

  onMount(
    async () => {
      console.log('starting window resizer');
      sdk.window.startAutoResizer();
      // register handlers to reset values
      for (const fieldsKey in sdk.entry.fields) {
        const field = sdk.entry.fields[fieldsKey];
        detachFieldHandlers.push(
          field.onValueChanged(value => {
            // if we are in a readonly state, don't save any changes
            if (
              (entryState == EntryState.EDITABLE || entryState == EntryState.READ_ONLY) &&
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
                if (typeof value == 'string' && value.includes('untitled')) {
                  beforeCheckoutFieldValues[field.id] = (beforeCheckoutFieldValues[field.id]).substr(9);
                  return;
                }
                resettingValue = true;
                field.setValue(beforeCheckoutFieldValues[field.id]).then(() => {
                  resettingValue = false;
                });
                let message = "";
                if (entryState == EntryState.EDITABLE)
                  message = 'You are viewing the current entry in read only mode!';
                else if (entryState == EntryState.READ_ONLY)
                  message = 'Some else is editing!';
                sdk.dialogs.openAlert({
                  title: 'Warning!',
                  message: message,
                  shouldCloseOnOverlayClick: false
                });
              }
            }
          })
        );
      }
      // call api to check if entry is editable
      try {
        const response = await fetch(url + `${sdk.entry.getSys().id}/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          }
        });
        const data = await response.json();
        console.log(`Fetched remote data: ${JSON.stringify(data)}`);

        if (data.entryState == 'EDITING') {
          // current user has previously checked out
          if (data.userId == sdk.user.sys.id) {
            entryState = EntryState.EDITING;
            beforeCheckoutFieldValues = data.initialValues;
          }
        }
      } catch (err) {
        // entry doesn't exist in db
        console.log(`Error calling api ${url + `${sdk.entry.getSys().id}/status`}`);
      }

      fetchedInitialEntryData = true;
    }
  );

  onDestroy(() => {
    console.log('stopping window resizer');
    sdk.window.stopAutoResizer();
    detachFieldHandlers.forEach(detachHandler => {
      detachHandler();
    });
  });

  function getFieldData(fields) {
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
  };

  async function lockEntry(data) {
    console.group("lockEntry");
    console.log("Locking entry");
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({...data, details: 'status', entryState: EntryState.EDITING})
    });
    console.log("Entry Locked");
    console.groupEnd();
    return response.json();
  }

  async function unlockEntry(data) {
    console.group("lockEntry");
    console.log("Unlocking entry");
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({...data, details: 'status', entryState: EntryState.EDITABLE})
    });
    console.log("Entry Unlocked");
    console.groupEnd();
    return response.json();
  }

  const commit = () => {
    console.group("Commit");
    console.log("Commiting data");
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        entryId: sdk.entry.getSys().id,
        details: Date.now().toString(),
        data: getFieldData(sdk.entry.fields)
      })
    }).then(() => {
      unlockEntry({
        userId: sdk.user.sys.id,
        entryId: sdk.entry.getSys().id
      }).then(() => {
        entryState = EntryState.EDITABLE;
        beforeCheckoutFieldValues = getFieldData(sdk.entry.fields);
      });
    });
    console.log("Data commited");
    console.groupEnd();
  };

  const rollback = () => {
    const setFieldPromises = [];
    for (const fieldsKey in sdk.entry.fields) {
      setFieldPromises.push(
        sdk.entry.fields[fieldsKey].setValue(beforeCheckoutFieldValues[fieldsKey])
      );
    }
    Promise.all(setFieldPromises).then(() =>
      unlockEntry({
        userId: sdk.user.sys.id,
        entryId: sdk.entry.getSys().id
      }).then(() => entryState = EntryState.EDITABLE)
    );
  };

</script>

<div class="container">
  {#if !fetchedInitialEntryData}
    <p>Loading...</p>
  {:else}
    {#if entryState == EntryState.READ_ONLY}
      Some else is editing this entry!
    {:else if entryState == EntryState.EDITABLE}
      <button in:fade="{{duration: 300}}" id="checkout-btn" on:click={() => {lockEntry({
            userId: sdk.user.sys.id,
            entryId: sdk.entry.getSys().id,
            initialValues: beforeCheckoutFieldValues
          }).then(() => {
            entryState = EntryState.EDITING;
          }).catch(e => {
            console.log(e)
          })}}>Checkout
      </button>
    {:else if entryState == EntryState.EDITING}
      <button in:fade="{{duration: 300}}" id="checkin-btn" on:click={commit}>Checkin</button>
      <button in:fade="{{duration: 300}}" id="discard-btn" on:click={rollback}>Discard</button>
    {/if}
  {/if}
</div>

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