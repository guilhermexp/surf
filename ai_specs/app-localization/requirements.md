# Requirements: app-localization

## 1. Overview

Goal: Allow changing the Surf desktop app language between English (existing default) and Portuguese (new), starting with full support for both languages in the main UI and settings.
User Problem: Non-English-speaking users, especially Portuguese speakers, currently see the entire interface only in English, which makes adoption and everyday use harder.

## 2. Functional Requirements

### 2.1 Core Features

FR-1: Global language switching

- User Story: As a Surf user, I want to be able to change the application language between English and Portuguese from the Settings page, so that I can use the app in my preferred language.
- Acceptance Criteria (EARS):
  1. WHEN the user opens the Settings page THEN the system SHALL display a language selection control listing at least English and Portuguese.
  2. WHEN the user changes the selected language in Settings THEN the system SHALL persist the chosen language so that it is remembered across restarts.
  3. WHEN the user selects a different language THEN the system SHALL apply the new language to all localized UI texts according to the selected language.
  4. IF the user has never selected a language preference THEN the system SHALL default to English.

FR-2: UI strings localization

- User Story: As a Surf user, I want all visible interface texts (navigation, dialogs, buttons, labels, tooltips, error messages) to appear in the selected language, so that I have a consistent experience in my language.
- Acceptance Criteria (EARS):
  1. WHEN the application renders the main window THEN the system SHALL obtain all user-facing texts from the localization layer instead of using hard-coded strings.
  2. WHEN the user changes the language THEN the system SHALL render the Settings page, navigation, and main workspace using the newly selected language.
  3. WHEN a localized string key is missing in the selected language THEN the system SHALL fall back to English for that specific string.
  4. WHILE the application is running THEN the system SHALL ensure that localized strings remain consistent for the currently selected language across navigation.

FR-3: Language persistence and defaults

- User Story: As a Surf user, I want the application to remember my language choice across sessions, so that I dont have to configure it every time I open the app.
- Acceptance Criteria (EARS):
  1. WHEN the user selects a language in Settings THEN the system SHALL store the language preference in a persistent config (e.g., file or local store) associated with the user profile.
  2. WHEN the application starts THEN the system SHALL read the stored language preference and initialize the localization layer with that language.
  3. IF the stored language is invalid or not supported THEN the system SHALL gracefully fall back to English and log a diagnostic message.

FR-4: Initial language scope

- User Story: As a product owner, I want the first localization version to cover the most-used parts of the Surf UI, so that we can deliver value quickly while keeping the scope manageable.
- Acceptance Criteria (EARS):
  1. WHEN the feature is released THEN the system SHALL provide English and Portuguese translations for at least: app shell (menus, title bar, main navigation), Settings page, welcome/onboarding view (if present), and common dialogs (open, save, error messages).
  2. WHEN a UI area is not yet localized THEN the system SHALL display texts in English and mark it as pending localization in the internal task list (not visible to end users).

### 2.2 Additional User Stories

FR-5: Safe fallback behavior

- User Story: As a cautious user, I want the language feature to never break the UI, so that I can safely change languages without causing errors or unreadable screens.
- Acceptance Criteria (EARS):
  1. IF a translation file fails to load THEN the system SHALL fall back to English and keep the UI functional.
  2. IF a specific translation key is missing in both the selected language and English THEN the system SHALL display a safe placeholder (e.g., the key name) instead of crashing.

FR-6: Future language extensibility

- User Story: As a developer, I want the localization system to support adding more languages later, so that we can expand to other locales with minimal code changes.
- Acceptance Criteria (EARS):
  1. WHEN a new language file is added following the agreed structure THEN the system SHALL be able to load it without requiring changes in application logic.
  2. WHEN the Settings page is updated to list a new supported language THEN the system SHALL treat it like any other language (persistence, switching, fallback).

## 3. Technical Requirements

### 3.1 Localization infrastructure

TR-1: Localization library

- WHEN initializing the front-end application THEN the system SHALL use a dedicated localization layer (for example, a Svelte-compatible i18n library or a custom store) to manage translations and current language.

TR-2: Translation resources format

- WHEN storing translation texts THEN the system SHALL organize them in language-specific resource files (e.g., JSON or JS/TS modules) with hierarchical keys that map closely to UI areas (e.g., settings.general.languageLabel).

TR-3: Key-based access

- WHEN UI components render text THEN the system SHALL use translation keys (e.g., "settings.language.selectLabel") instead of hard-coded literal strings.

TR-4: Runtime language switching

- WHILE the application is running THEN the localization layer SHALL support updating the current language and triggering reactive updates in visible components without requiring a full application restart, unless a restart is explicitly chosen in the design.

### 3.2 Persistence and configuration

TR-5: Language preference storage

- WHEN persisting language preference THEN the system SHALL use the existing configuration mechanism for Surf desktop (e.g., config file, local storage, or Electron store) without introducing conflicting duplication of user settings.

TR-6: Default language handling

- IF no language preference is found on startup THEN the system SHALL default to English and be ready to switch to Portuguese or other supported languages when configured.

### 3.3 Performance and reliability

TR-7: Performance impact

- WHILE loading translation resources THEN the system SHALL keep startup performance within acceptable limits (no noticeable delay compared to the current version), for example by lazy-loading translation files or bundling them efficiently.

TR-8: Error handling

- WHEN translation resources are missing or malformed THEN the system SHALL log an informative error (for developers) and fall back to a safe language (English) without blocking the UI.

## 4. Non-Functional Requirements

NFR-1: Usability

- WHEN users open the Settings page THEN the language selection control SHALL be clearly labeled and easy to understand for non-technical users.

NFR-2: Consistency

- WHILE using the application in a given language THEN the terminology and style SHALL remain consistent across different screens and dialogs.

NFR-3: Accessibility

- WHEN localization is applied THEN the system SHALL ensure that translated texts fit within existing UI layouts and remain readable (no truncation or overlapping in common resolutions).

NFR-4: Maintainability

- WHEN developers update or add new UI texts THEN the process SHALL require only adding or updating translation keys and resource files, without needing widespread code changes.

NFR-5: Testability

- WHEN writing tests for localized behavior THEN the system SHALL expose a way to programmatically set and query the current language and to verify that specific keys resolve to expected texts.

## 5. Out of Scope

OOS-1: Automatic locale detection

- Automatic detection of system locale and auto-switching language on first run is out of scope for the initial version. The user will manually choose the language in Settings.

OOS-2: Right-to-left languages

- Support for right-to-left languages (e.g., Arabic, Hebrew) is out of scope for this version.

OOS-3: Documentation localization

- Translating product documentation, help content, or external websites is out of scope; this feature only covers the in-app UI.

OOS-4: Backend/service messages localization

- Localization of backend logs, internal service messages, or API error payloads is out of scope, unless they are directly surfaced as user-facing text in the UI.
