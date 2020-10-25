<script lang="ts">
  // this component is mostly used for routing to proper children components
  import {init, locations} from 'contentful-ui-extensions-sdk';
  import Config from './Config.svelte';
  import Sidebar from "./Sidebar.svelte";

  let sdk;

  init(s => {
    sdk = s;
  });
</script>

<main>
    {#if sdk != undefined}
        {#if sdk.location.is(locations.LOCATION_APP_CONFIG)}
            <Config sdk={sdk}/>
        {:else if sdk.location.is(locations.LOCATION_ENTRY_SIDEBAR)}
            <Sidebar sdk={sdk}/>
        {/if}
    {:else}
        Loading screen
    {/if}
</main>