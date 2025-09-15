export function registerHooks() {
  // Always delegate to modular registration
  (async () => {
    try {
      const { registerHooks: registerModular } = await import('./hooks/registration.js');
      registerModular();

      const { registerSettings } = await import('./settings.js');
      registerSettings();
    } catch (e) {
      console.error('PF2E Visioner: failed to register modular hooks', e);
    }
  })();
}