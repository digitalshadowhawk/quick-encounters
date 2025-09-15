import { QuickEncounter } from '../QuickEncounter.js'
import { registerUIHooks } from './ui.js'

export function registerHooks() {
    /** HOOKS */
    //0.6.13: Can't hook on actually clicking on the Note, so on hoverIn/hoverOut we record which Note we're on
    //and then set qeJournalEntry.clickedNote in the renderJournalEntry Hook
    Hooks.on("hoverNote", (note, startedHover) => {
        if (!note || !game.user.isGM) { return; }
        if (startedHover) {
            QuickEncounter.hoveredNote = note;
        } else {
            QuickEncounter.hoveredNote = null;
        }
    });

    registerUIHooks();

    //The Journal Sheet  looks to see if this is the Tutorial and deletes the Journal Entry if so
    //Placing a map Note is moved to when you actually run the Encounter
    Hooks.on('closeJournalSheet', async (journalSheet, html) => {
        if (!game.user.isGM) { return; }
        const journalEntry = journalSheet.object;

        //0.5.3: BUG: If you had the Tutorial JE open it would delete another Journal Entry when you closed it
        //This was happening because $("QuickEncountersTutorial") by itself was searching the whole DOM
        if (journalSheet.element.find("#QuickEncountersTutorial").length) {
            //This is the tutorial Journal Entry
            //v0.4.0 Check that we haven't already deleted this (because onDelete -> close)
            if (game.journal.get(journalEntry.id)) {
                //v0.8.3: Switch to use JournalEntry.deleteDocuments(ids)
                        await getDocumentClass("JournalEntry").deleteDocuments([journalEntry.id])
            }
        }

        //v0.6.1: If there's a QE dialog open, close that too
        if (journalSheet.qeDialog) {
            journalSheet.qeDialog.close();
            delete journalSheet.qeDialog;
        }

        //v1.0.5e: Close open Journal Page Sheet QEs - for some reason the journalEntryPage.sheet is not updated so we have to use the getPageSheet() method
        //v1.0.7a: Check for isFoundryV10Plus
            for (let journalEntryPageId of journalEntry.pages?.keys()) {
                const journalPageSheet = journalSheet.getPageSheet(journalEntryPageId);
                if (journalPageSheet?.qeDialog) {
                    journalPageSheet.qeDialog.close();
                    delete journalPageSheet.qeDialog;
                }
            }
        

        delete journalEntry.clickedNote;
    });


    //1.0.4c: Foundry v10.277 - support for multipage Journal
    Hooks.on(`renderJournalPageSheet`, QuickEncounter.onRenderJournalPageSheet)
    //Don't have to worry about Tutorial (deal with that on close Journal Entry)
    Hooks.on('closeJournalPageSheet', async (journalPageSheet, html) => {
        if (!game.user.isGM) { return; }
        const journalEntryPage = journalPageSheet.object;

        //v0.6.1: If there's a QE dialog open, close that too
        if (journalPageSheet.qeDialog) {
            journalPageSheet.qeDialog.close();
            delete journalPageSheet.qeDialog;
        }
        delete journalEntryPage.clickedNote;
    });


    Hooks.on("getJournalSheetHeaderButtons", QuickEncounter.getJournalSheetHeaderButtons);
    Hooks.on("init", QuickEncounter.init);
    //Hooks.on('getSceneControlButtons', QuickEncounter.getSceneControlButtons);
    Hooks.on("deleteCombat", (combat, options, userId) => {
        QuickEncounter.onDeleteCombat(combat, options, userId);
    });


    //0.9.1a: (from ironmonk88) Add a QE (crossed swords) control to the command palette for Monk's Enhanced Journal
    Hooks.on("activateControls", (journal, controls) => {
        controls.push({ id: 'quickencounter', text: "Quick Encounter", icon: 'fa-swords', conditional: game.user.isGM, callback: QuickEncounter.runAddOrCreate.bind(journal?.subsheet) });
    });
}