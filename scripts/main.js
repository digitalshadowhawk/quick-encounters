import { registerSettings } from "./settings.js"
import { registerHooks } from './hooks.js';

Hooks.once('init', async () => {
    try {
        // Register settings and keybindings
        registerSettings();

        // Register hooks
        registerHooks();
    }  catch (error) {
    console.error('Quick Encounters: Initialization failed:', error.message);
    console.error('Quick Encounters: Full error details:', error);
    console.error('Quick Encounters: Stack trace:', error.stack);

    // Try to show a user notification if possible
    if (typeof ui !== 'undefined' && ui.notifications) {
      ui.notifications.error(`Quick Encounters failed to initialize: ${error.message}`);
    }
  }
});