<script lang="ts">
  import { Switch } from '@deta/ui/legacy'
  import SettingsOption from './SettingsOption.svelte'
  import type { UserSettings } from '@deta/types'
  import { Icon } from '@deta/icons'
  import { createEventDispatcher } from 'svelte'
  import { openDialog } from '@deta/ui'
  import { translator as t } from '../../Core/i18n'

  export let userConfigSettings: UserSettings

  const dispatch = createEventDispatcher<{ update: boolean }>()

  let expanded = false
  let localUseSidebar = userConfigSettings.experimental_notes_chat_sidebar

  const handleToggleNotesSidebar = async (e: CustomEvent<boolean>) => {
    const value = e.detail

    const { closeType: confirmed } = await openDialog({
      icon: 'sidebar.right',
      title: value
        ? $t('settings.smartNotes.dialog.enableTitle')
        : $t('settings.smartNotes.dialog.disableTitle'),
      message: value
        ? $t('settings.smartNotes.dialog.enableMessage')
        : $t('settings.smartNotes.dialog.disableMessage'),
      actions: [
        { title: $t('common.actions.cancel'), type: 'reset' },
        {
          title: value
            ? $t('settings.smartNotes.dialog.enableAction')
            : $t('settings.smartNotes.dialog.disableAction'),
          type: 'submit',
          kind: value ? 'submit' : 'danger'
        }
      ]
    })

    if (confirmed) {
      localUseSidebar = value
      userConfigSettings.experimental_notes_chat_sidebar = value
      dispatch('update', value)
    } else {
      localUseSidebar = userConfigSettings.experimental_notes_chat_sidebar
    }
  }

  $: localUseSidebar = userConfigSettings.experimental_notes_chat_sidebar
</script>

<SettingsOption icon="file-text-ai" title={$t('settings.smartNotes.title')} on:update>
  <p slot="description">
    {$t('settings.smartNotes.description')}
    <a href="https://deta.notion.site/Smart-Notes-17da5244a717805c8525eec0d42f7598" target="_blank"
      >{$t('settings.smartNotes.moreInfo')}</a
    >
  </p>

  <section class="section big-section">
    <div class="info">
      <div class="title">
        <Icon name="sidebar.right" size="20px" stroke-width="2" />
        <h3>{$t('settings.smartNotes.sidebar.title')}</h3>
      </div>
      <p>{$t('settings.smartNotes.sidebar.description')}</p>
    </div>

    <Switch color="#ffffff" bind:checked={localUseSidebar} on:update={handleToggleNotesSidebar} />
  </section>

  {#if userConfigSettings.experimental_notes_chat_sidebar}
    <section class="section big-section">
      <div class="info">
        <div class="title">
          <Icon name="chat" size="20px" stroke-width="2" />
          <h3>{$t('settings.smartNotes.chatInput.title')}</h3>
        </div>
        <p>{$t('settings.smartNotes.chatInput.description')}</p>
      </div>

      <Switch
        color="#ffffff"
        bind:checked={userConfigSettings.experimental_notes_chat_input}
        on:update
      />
    </section>
  {/if}
</SettingsOption>

<style lang="scss">
  .big-section {
    margin-top: 0.25rem;
    margin-bottom: 0.75rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  h3 {
    font-size: 1.1rem;
    color: var(--color-text);
    font-weight: 500;
  }
</style>
