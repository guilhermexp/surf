<script lang="ts">
  import { Switch } from '@deta/ui/legacy'
  import { Icon, type Icons } from '@deta/icons'
  import { openDialog } from '@deta/ui'
  import { createEventDispatcher } from 'svelte'
  import { translator as t } from '../../Core/i18n'

  const dispatch = createEventDispatcher<{ update: boolean }>()

  export let value: boolean | undefined = undefined
  export let title: string
  export let description: string | undefined = undefined
  export let icon: Icons | undefined = undefined
  export let showConfirmDialog: ((newValue: boolean) => boolean) | undefined = undefined
  export let getDialogMessage:
    | ((newValue: boolean) => {
        title: string
        message: string
      })
    | undefined = undefined

  let localValue = value

  async function handleValueChange(newValue: boolean) {
    // reset local value to match parent value
    localValue = value

    if (!showConfirmDialog || !showConfirmDialog(newValue)) {
      value = newValue
      localValue = newValue
      dispatch('update', newValue)
      return
    }

    const { title, message } = getDialogMessage
      ? getDialogMessage(newValue)
      : { title: $t('dialogs.confirm.title'), message: $t('dialogs.confirm.message') }
    const { closeType: confirmed } = await openDialog({
      title: title,
      message: message,
      actions: [
        { title: $t('common.actions.cancel'), type: 'reset' },
        { title: $t('common.actions.confirm'), type: 'submit' }
      ]
    })

    if (confirmed) {
      value = newValue
      localValue = newValue
      dispatch('update', newValue)
    } else {
      // reset the switch to original value if cancelled
      localValue = value
    }
  }
  // keep local value in sync when parent value changes
  $: localValue = value
</script>

<div class="setting">
  <section class="section">
    <div class="info">
      <div class="title">
        {#if icon}
          <Icon name={icon} size="20px" />
        {/if}

        <h2>{title}</h2>
      </div>

      <slot name="description">
        <p>{@html description}</p>
      </slot>
    </div>

    {#if value !== undefined}
      <Switch
        color="#ffffff"
        bind:checked={localValue}
        on:update={(e) => handleValueChange(e.detail)}
      />
    {/if}
  </section>
  <slot />
</div>

<style lang="scss">
  .setting {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;

    & :global(.section) {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .title {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        h2 {
          font-size: 1.2rem;
          font-weight: 500;
          color: light-dark(var(--color-text), var(--on-surface-dark, #e4e7f2));
        }
      }

      p {
        font-size: 1.1rem;
        opacity: 0.6;
        color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #9da4c4));
      }
    }
  }
</style>
