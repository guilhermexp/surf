<script lang="ts">
  import { translator as t, getSupportedLocales, setLocale, type Locale } from '../../Core/i18n'
  import type { UserSettings } from '@deta/types'

  export let settings: UserSettings | undefined

  const availableLocales: Locale[] = getSupportedLocales()
  let selectedLanguage: Locale = 'en'

  $: selectedLanguage = (settings?.language as Locale) ?? 'en'

  const handleLanguageChange = async (event: Event) => {
    if (!settings) return

    const target = event.target as HTMLSelectElement
    const nextLocale = target.value as Locale

    if (!nextLocale || nextLocale === settings.language) {
      return
    }

    try {
      selectedLanguage = nextLocale
      await setLocale(nextLocale)
      settings.language = nextLocale
      await window.api.updateUserConfigSettings(settings)
    } catch (error) {
      console.error('Failed to change language', error)
      selectedLanguage = (settings.language as Locale) ?? 'en'
    }
  }
</script>

{#if settings}
  <div class="language-wrapper">
    <div class="info">
      <div class="title">
        <h2>{$t('settings.general.language.label')}</h2>
      </div>
      <p>{$t('settings.general.language.description')}</p>
    </div>

    <div class="language-select">
      <select
        data-testid="language-select"
        bind:value={selectedLanguage}
        on:change={handleLanguageChange}
      >
        {#each availableLocales as option}
          <option value={option}>
            {$t(`settings.general.language.options.${option}`)}
          </option>
        {/each}
      </select>
    </div>
  </div>
{/if}

<style lang="scss">
  .language-wrapper {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: radial-gradient(
      290.88% 100% at 50% 0%,
      rgba(237, 246, 255, 0.96) 0%,
      rgba(246, 251, 255, 0.93) 100%
    );
    border: 0.5px solid rgba(255, 255, 255, 0.8);
    border-radius: 11px;
    padding: 1rem;
    margin: 1rem 0;
    box-shadow:
      0 -0.5px 1px 0 rgba(255, 255, 255, 0.1) inset,
      0 1px 1px 0 #fff inset,
      0 3px 3px 0 rgba(62, 71, 80, 0.02),
      0 1px 2px 0 rgba(62, 71, 80, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.05),
      0 0 1px 0 rgba(0, 0, 0, 0.09);
    transition:
      background-color 90ms ease-out,
      box-shadow 90ms ease-out;

    @media (prefers-color-scheme: dark) {
      background: var(--settings-dark-card);
      border: 0.5px solid var(--settings-dark-border);
      box-shadow: var(--settings-dark-card-shadow);
    }
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

  .language-select {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    margin-top: 0.75rem;
  }

  .language-select select {
    min-width: 180px;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid light-dark(var(--color-border), var(--settings-dark-border));
    background: light-dark(var(--color-background-light), #1b1b1f);
    color: light-dark(var(--color-text), var(--on-surface-dark, #e4e7f2));
    font-size: 1rem;
  }

  .language-select select:focus {
    outline: none;
    border-color: light-dark(var(--color-border-dark), var(--settings-dark-border-strong));
  }
</style>
