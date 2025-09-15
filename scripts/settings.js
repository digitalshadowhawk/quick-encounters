import { MODULE_ID, MODULE_VERSION } from "./constants.js"

export function registerSettings() {
    game.settings.register(MODULE_ID, "quickEncountersVersion", {
        name: "Quick Encounters Version",
        hint: "",
        scope: "system",
        config: false,
        default: MODULE_VERSION,
        type: String
    });
    game.settings.register(MODULE_ID, "freezeCapturedTokens", {
        name: "QE.FreezeCapturedTokens.NAME",
        hint: "QE.FreezeCapturedTokens.HINT",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register(MODULE_ID, "showQEAutomatically", {
        name: "QE.Setting.ShowQEAutomatically.NAME",
        hint: "QE.Setting.ShowQEAutomatically.HINT",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    game.settings.register(MODULE_ID, "defaultQEFolder", {
        name: "QE.Setting.DefaultQEFolder.NAME",
        hint: "QE.Setting.DefaultQEFolder.HINT",
        scope: "world",
        config: true,
        default: null,
        type: String
    });
    game.settings.register(MODULE_ID, "displayXPAfterCombat", {
        name: "QE.DisplayXPAfterCombat.NAME",
        hint: "QE.DisplayXPAfterCombat.HINT",
        scope: "world",
        config: true,
        visible: game.system.id === "dnd5e",
        default: true,
        type: Boolean
    });
    //v0.9.0 Delete tokens by default after the Add/Link
    game.settings.register(MODULE_ID, "deleteTokensAfterAdd", {
        name: "QE.Setting.DeleteTokensAfterAdd.NAME",
        hint: "QE.Setting.DeleteTokensAfterAdd.HINT",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    //v0.9.0 Show Delete Hostile Tokens Dialog after Combat
    game.settings.register(MODULE_ID, "showDeleteTokensDialogAfterCombat", {
        name: "QE.Setting.ShowDeleteTokensDialogAfterCombat.NAME",
        hint: "QE.Setting.ShowDeleteTokensDialogAfterCombat.HINT",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });
    //v0.9.3 Show Add to Combat Tracker checkboxes in QE dialog
    game.settings.register(MODULE_ID, "showAddToCombatTrackerCheckbox", {
        name: "QE.Setting.ShowAddToCombatTrackerCheckbox.NAME",
        hint: "QE.Setting.ShowAddToCombatTrackerCheckbox.HINT",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    //v1.0. Check for Instant Encounters when you drag a JE to the Scene to create a Note
    game.settings.register(MODULE_ID, "checkForInstantEncounter", {
        name: "QE.Setting.CheckInstantEncounter.NAME",
        hint: "QE.Setting.CheckInstantEncounter.HINT",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    //v1.1.1 Extract Actor RollTables into QEs
    game.settings.register(MODULE_ID, "extractActorRollTables", {
        name: "QE.Setting.ExtractActorRollTables.NAME",
        hint: "QE.Setting.ExtractActorRollTables.HINT",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    //v1.2.0 Automatically add player tokens to Combat Tracker
    game.settings.register(MODULE_ID, "addPlayerTokensToCT", {
        name: "QE.Setting.AddPlayerTokensToCombatTracker.NAME",
        hint: "QE.Setting.AddPlayerTokensToCombatTracker.HINT",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "no": "QE.Setting.AddPlayerTokensToCombatTracker.OPTION.No",
            "inScene": "QE.Setting.AddPlayerTokensToCombatTracker.OPTION.InScene",
            "loggedIn": "QE.Setting.AddPlayerTokensToCombatTracker.OPTION.LoggedIn"
        },
        default: "no"
    });
}