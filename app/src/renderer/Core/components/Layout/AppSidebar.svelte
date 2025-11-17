<script lang="ts">
  import { useNotebookManager } from '@deta/services/notebooks'
  import { useViewManager, ViewType } from '@deta/services/views'
  import { useBrowser } from '@deta/services/browser'
  import { Button } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import WebContentsView from '../WebContentsView.svelte'
  import NavigationBar from '../NavigationBar/NavigationBar.svelte'
  import NavigationBarGroup from '../NavigationBar/NavigationBarGroup.svelte'
  import { useKVTable, type BaseKVItem } from '@deta/services'
  import { onMount } from 'svelte'
  import { isInternalRendererURL, useDebounce } from '@deta/utils'
  import { useResourceManager } from '@deta/services/resources'
  import { writable } from 'svelte/store'
  import { NotebookDefaults, ViewLocation } from '@deta/types'

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const browser = useBrowser()
  const viewManager = useViewManager()
  const sidebarStore = useKVTable<
    {
      siderbar_width: number
      sidebar_location: string
    } & BaseKVItem
  >('notebook_sidebar')

  const activeSidebarView = $derived(viewManager.activeSidebarView)
  const activeSidebarLocation = $derived(activeSidebarView?.url ?? writable(null))

  const MIN_SIDEBAR_WIDTH = 420
  const MAX_SIDEBAR_WIDTH = 900
  const DEFAULT_SIDEBAR_WIDTH = 670

  let sidebarWidth = $state(DEFAULT_SIDEBAR_WIDTH)
  let isResizing = $state(false)
  let containerEl: HTMLDivElement
  let sidebarStoreReady = false

  const clampSidebarWidth = (value: number) =>
    Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, value))

  const debouncedSaveWidth = useDebounce((width: number) => {
    if (!sidebarStoreReady) return
    sidebarStore.update('cfg', { siderbar_width: width })
  }, 200)

  const updateWidthFromPointer = (event: MouseEvent) => {
    if (!containerEl) return
    const { right } = containerEl.getBoundingClientRect()
    const newWidth = clampSidebarWidth(right - event.clientX)
    sidebarWidth = newWidth
    debouncedSaveWidth(newWidth)
  }

  const startResize = (event: MouseEvent) => {
    event.preventDefault()
    isResizing = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    updateWidthFromPointer(event)
  }

  const stopResize = () => {
    if (!isResizing) return
    isResizing = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const handleNewNote = async () => {
    let notebookId: string | undefined = undefined
    const { type, id } = activeSidebarView.typeDataValue
    if (type === ViewType.Notebook && id) {
      notebookId = id
    }

    await browser.createAndOpenNote(undefined, { target: 'sidebar', notebookId })
  }

  const handleSearchInput = useDebounce((value: string) => {
    viewManager.activeSidebarView?.webContents.updatePageQuery(value)
  }, 100)

  const debouncedSaveLocation = useDebounce((location: string) => {
    if (location === undefined || location === null || location.length <= 0) return
    sidebarStore.update('cfg', { sidebar_location: location })
  }, 250)

  $effect(() => {
    debouncedSaveLocation($activeSidebarLocation)
  })

  $effect(() => {
    if (viewManager.sidebarViewOpen && viewManager.activeSidebarView === null) {
      viewManager.setSidebarState({
        view: viewManager.create({ url: 'surf://notebook', permanentlyActive: true })
      })
    }
  })

  onMount(async () => {
    if ((await sidebarStore.read('cfg')) === undefined) {
      await sidebarStore.create({
        id: 'cfg',
        siderbar_width: DEFAULT_SIDEBAR_WIDTH,
        sidebar_location: 'surf://new'
      })
    }

    const cfg = await sidebarStore.read('cfg')
    sidebarStoreReady = true
    sidebarWidth = clampSidebarWidth(cfg?.siderbar_width ?? DEFAULT_SIDEBAR_WIDTH)

    // NOTE: We could move the initialization into core so that it loads a bit faster on first open
    if (viewManager.activeSidebarView === undefined) {
      viewManager.setSidebarState({
        open: false,
        view: viewManager.create({ url: cfg.sidebar_location, permanentlyActive: true })
      })
    }
  })

  onMount(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return
      updateWidthFromPointer(event)
    }

    const handleMouseUp = () => {
      if (!isResizing) return
      stopResize()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  })
</script>

{#if viewManager.sidebarViewOpen && viewManager.activeSidebarView}
  <div class="container" bind:this={containerEl} style:--sidebarWidth={sidebarWidth + 'px'}>
    <div
      class="resize-handle"
      class:resizing={isResizing}
      onmousedown={startResize}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
    ></div>
    <aside class:open={viewManager.sidebarViewOpen}>
      <div class="sidebar-content">
        {#if viewManager.activeSidebarView}
          <NavigationBar
            view={viewManager.activeSidebarView}
            readonlyLocation
            hideNavigationControls
            onsearchinput={handleSearchInput}
            roundRightCorner
          >
            {#snippet leftChildren()}
              <NavigationBarGroup slim>
                <!-- TODO: Implement sth like surf://new -->
                <Button size="md" square onclick={handleNewNote}>
                  <Icon name="edit" size="1.2em" />
                </Button>
              </NavigationBarGroup>
            {/snippet}

            {#snippet rightChildren()}
              <NavigationBarGroup slim>
                <Button
                  size="md"
                  square
                  onclick={() => viewManager.setSidebarState({ open: false })}
                >
                  <Icon name="close" size="1.2em" />
                </Button>
              </NavigationBarGroup>
            {/snippet}
          </NavigationBar>
          <div style="position:relative;height:100%;">
            {#key viewManager.activeSidebarView.id}
              <WebContentsView
                view={viewManager.activeSidebarView}
                location={ViewLocation.Sidebar}
                active
              />
            {/key}
          </div>
        {/if}
      </div>
    </aside>
  </div>
{/if}

<style lang="scss">
  .container {
    display: flex;
    position: relative;
    width: var(--sidebarWidth);
    min-width: var(--sidebarWidth);
    flex-shrink: 0;
    --fold-width: 0.5rem;

    //&::before {
    //  content: '';
    //  position: absolute;
    //  z-index: 3;
    //  pointer-events: none;
    //  top: 0;
    //  left: 0;
    //  bottom: 0;
    //  width: var(--fold-width);
    //  background: linear-gradient(to bottom, rgba(250, 250, 250, 1) 0%, #fff 10%);

    //  --darkness: 240;
    //  background: linear-gradient(
    //    to right,
    //    rgba(255, 255, 255, 1) 0%,
    //    rgba(var(--darkness), var(--darkness), var(--darkness), 1) 50%,
    //    rgba(255, 255, 255, 1) 100%
    //  );
    //  background: linear-gradient(
    //    to right,
    //    rgba(255, 255, 255, 0) 20%,
    //    rgba(var(--darkness), var(--darkness), var(--darkness), 1) 50%,
    //    rgba(255, 255, 255, 0) 80%
    //  );
    //}
    //&::after {
    //  content: '';
    //  position: absolute;
    //  z-index: 0;
    //  pointer-events: none;
    //  top: 0;
    //  left: 0;
    //  bottom: 0;
    //  width: var(--fold-width);

    //  background: rgba(255, 255, 255, 1);
    //  box-shadow:
    //    //0 -0.5px 1px 0 rgba(250, 250, 250, 1) inset,
    //    //0 1px 1px 0 #fff inset,
    //    0 -3px 1px 0 rgba(0, 0, 0, 0.025),
    //    0 -2px 1px 0 rgba(9, 10, 11, 0.01),
    //    0 -1px 1px 0 rgba(9, 10, 11, 0.03);
    //}
  }

  .resize-handle {
    width: 6px;
    cursor: col-resize;
    flex-shrink: 0;
    position: relative;
    height: 100%;
    z-index: 2;
    margin-left: -3px;
    border-radius: 999px;
    background: transparent;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: light-dark(#d9d9d944, rgba(255, 255, 255, 0.08));
      box-shadow: 0 0 0 1px light-dark(#ffffff55, rgba(0, 0, 0, 0.25));
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    &:hover::before,
    &.resizing::before {
      opacity: 1;
    }
  }

  aside {
    display: flex;
    width: 100%;

    .sidebar-content {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    //transition: width 20034ms ease-out;
    transition-property: width, display;
    transition-duration: 123ms;
    transition-timing-function: ease-out;
    interpolate-size: allow-keywords;
  }
</style>
