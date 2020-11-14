<script>
  import {onMount} from 'svelte';
  import {isEmpty} from 'lodash-es';

  export let sdk;
  let name = "world";
  const app = sdk.app;

  let url = '';
  let apiKey = '';

  onMount(() => {
    app.setReady();
  });

  const storeParams = async (url, apiKey) => {
    const parameters = {url, apiKey};
    console.log(`Saving app params as: ${JSON.stringify(parameters)}`);
    await app.onConfigure(async () => {
      const {items: contentTypes} = await sdk.space.getContentTypes();
      // @ts-ignore
      const contentTypeIds = contentTypes.map(ct => ct.sys.id);
      console.log(`Content types to configure: ${contentTypeIds}`);
      const editorInterface = contentTypeIds.reduce((acc, id) => {
        // Insert the app as the first item in sidebars
        // of all content types.
        return {...acc, [id]: {sidebar: {position: 0}}};
      }, {});
      console.log(`Editor Interface: ${JSON.stringify(editorInterface)}`);

      return {
        parameters: parameters,
        targetState: {
          EditorInterface: editorInterface
        }
      };
    });
  };

  $: storeParams(url, apiKey);

  // steps
  // 1. get app params, if applicable. App params contain urls to call for fetching data
  // 2. Use async/await to fetch data for

  async function getParams() {
    const params = await app.getParameters();
    console.log(`Fetched app params are ${JSON.stringify(params)}`);
    if (!isEmpty(params)) {
      url = params.url;
      apiKey = params.apiKey;
    }
    return new Promise(resolve => {
      resolve(params);
    });
  }
</script>

<div id="config">
    <h1>
        Config
    </h1>

    {#await getParams()}
        Fetching app params
    {:then n}
        <label for="endpointInput">
            API Gateway Endpoint
        </label>
        <input id="endpointInput" type="text" bind:value={url}>
        <label for="apiKeyInput">
            API Key
        </label>
        <input id="apiKeyInput" type="text" bind:value={apiKey}>
    {/await}
</div>

<style>
    #config {
        margin: auto;
        width: fit-content;
    }

    label {
        margin-bottom: 0.5rem;
    }

    input {
        width: 20rem;
        margin-bottom: 2rem;
    }
</style>