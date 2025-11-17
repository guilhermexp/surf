<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { translator as t } from '../../Core/i18n'

  export let value: 'auto' | 'always_ask' | 'always_search' = 'auto'
  const dispatch = createEventDispatcher<{ update: string }>()

  const AVAILABLE_OPTIONS = [
    {
      key: 'auto',
      labelKey: 'settings.teletype.options.auto.label',
      descriptionKey: 'settings.teletype.options.auto.description'
    },
    {
      key: 'always_ask',
      labelKey: 'settings.teletype.options.ask.label',
      descriptionKey: 'settings.teletype.options.ask.description'
    },
    {
      key: 'always_search',
      labelKey: 'settings.teletype.options.search.label',
      descriptionKey: 'settings.teletype.options.search.description'
    }
  ]
</script>

<div class="wrapper">
  <div class="header">
    <h3>{$t('settings.teletype.title')}</h3>
    <p class="description">{$t('settings.teletype.description')}</p>
  </div>
  <select bind:value on:change={(e) => dispatch('update', e.target.value)}>
    {#each AVAILABLE_OPTIONS as option}
      <option value={option.key}>{$t(option.labelKey)}</option>
    {/each}
  </select>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 1rem;
  }

  .header {
    flex: 1;
  }

  h3 {
    line-height: 1;
    font-size: 1.2rem;
    font-weight: 500;
    color: light-dark(var(--color-text), var(--on-surface-dark, #e4e7f2));
    margin: 0 0 0.25rem 0;
  }

  .description {
    font-size: 0.9rem;
    color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #9da4c4));
    margin: 0;
    line-height: 1.3;
  }

  select {
    font-size: 1.1rem;
    line-height: 1;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid light-dark(var(--color-border), var(--settings-dark-border));
    background: light-dark(var(--color-background), var(--surface-elevated-dark, #1a1a1a));
    color: light-dark(var(--color-text), var(--on-surface-dark, #e4e7f2));
    min-width: 24ch;
    flex-shrink: 0;
  }
</style>
