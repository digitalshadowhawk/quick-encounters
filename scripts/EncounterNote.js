import {QuickEncounter, QE, Dialog3} from './QuickEncounter.js';

//Expand the available list of Note icons
const moreNoteIcons = {
    "Acid" : "icons/svg/acid.svg",
    "Angel" : "icons/svg/angel.svg",
    "Aura" : "icons/svg/aura.svg",
    "Blind" : "icons/svg/blind.svg",
    "Blood" : "icons/svg/blood.svg",
    "Bones" : "icons/svg/bones.svg",
    "Circle" : "icons/svg/circle.svg",
    "Clockwork" : "icons/svg/clockwork.svg",
    "Combat" : "icons/svg/combat.svg",
    "Cowled" : "icons/svg/cowled.svg",
    "Daze" : "icons/svg/daze.svg",
    "Deaf" : "icons/svg/deaf.svg",
    "Direction" : "icons/svg/direction.svg",
    "Door-Closed" : "icons/svg/door-closed.svg",   
    "Door-Exit" : "icons/svg/door-exit.svg",    
    "Down" : "icons/svg/down.svg",
    "Explosion" : "icons/svg/explosion.svg",
    "Eye" : "icons/svg/eye.svg",
    "Falling" : "icons/svg/falling.svg",    
    "Frozen" : "icons/svg/frozen.svg",
    "Hazard" : "icons/svg/hazard.svg",
    "Heal" : "icons/svg/heal.svg",
    "Holy Shield" : "icons/svg/holy-shield.svg",
    "Ice Aura" : "icons/svg/ice-aura.svg",
    "Lightning" : "icons/svg/lightning.svg",
    "Net" : "icons/svg/net.svg",
    "Padlock" : "icons/svg/padlock.svg",   
    "Paralysis" : "icons/svg/paralysis.svg",
    "Poison" : "icons/svg/poison.svg",
    "Radiation" : "icons/svg/radiation.svg",
    "Sleep" : "icons/svg/sleep.svg",
    "Sound" : "icons/svg/sound.svg",  
    "Sun" : "icons/svg/sun.svg",
    "Terror" : "icons/svg/terror.svg",   
    "Up" : "icons/svg/up.svg",
    "Wing" : "icons/svg/wing.svg"      
}
Object.assign(CONFIG.JournalEntry.noteIcons, moreNoteIcons);



export class EncounterNoteConfig extends NoteConfig {
    /** @override  */
    //WARNING: Do not add submitOnClose=true because that will create a submit loop
    static get defaultOptions() {
        let defaultOptions;
        const addedOptions = {
            id : "encounter-note-config",
            title : game.i18n.localize( "QE.Config.TITLE")
        }
        if (QuickEncounter.isFoundryV12Plus) {
            defaultOptions = foundry.utils.mergeObject(super.defaultOptions, addedOptions); 
        } else {
            defaultOptions = mergeObject(super.defaultOptions, addedOptions);
        }
        return defaultOptions;
    }
}

export class EncounterNote {
    static async create(quickEncounter, noteAnchor) {
        if (!quickEncounter) {return;}

        const journalEntry = quickEncounter.journalEntry;
        //1.0.4k: REMOVED IN 1.1.5: Use parent (which is what is saved to the map) if this is JournalEntryPage
        //1.0.7a: Check for FoundryV10
        //1.1.5a: Remove defaulting to parent, but if it's a page you have to reference the parent JournalEntry and page reference
        let noteJournalEntry = (journalEntry instanceof JournalEntryPage) ? journalEntry.parent : journalEntry;
        // Create Note data
        //1.2.3: This data structure supposedly deprecated since v10, so change now
        const noteData = {
              entryId: noteJournalEntry.id,
              x: noteAnchor.x,
              y: noteAnchor.y,
              texture: {
                src: CONFIG.JournalEntry.noteIcons.Combat,
                tint: "#FF0000",  //Red
              },
              iconSize: 80,
              //Don't specify the name so it inherits from the Journal
              textAnchor: CONST.TEXT_ANCHOR_POINTS.TOP,
              fontSize: 24
        };
        if (journalEntry instanceof JournalEntryPage) {noteData.pageId = journalEntry.id;}

        //v0.5.0: Switch to Note.create() to bypass the Note dialog
        //This is different from the JournalEntry._onDropData approach
        //0.9.3f: Remove deprecation warning by using createEmbeddedDocuments()
        let newNote = QuickEncounter.isFoundryV8Plus ? await canvas.scene.createEmbeddedDocuments("Note",[noteData]) : await Note.create(noteData);
        //1.0.2c: createEmbeddedDocuments returns an array, and we just want a single element
        if (Array.isArray(newNote)) {newNote = newNote[0];}
        newNote._sheet = new EncounterNoteConfig(newNote);
        return newNote;
    }

    static async delete(journalEntry) {
        //1.0.4k: This should always be a real parent JournalEntry
        
        if (!game.user.isGM) {return;}
        //Create filtered array of matching Notes for each scene
        let matchingNoteIds;
        let numNotesDeleted = 0;
        for (const scene of game.scenes) {
            if (QuickEncounter.isFoundryV10Plus) {
                matchingNoteIds = Array.from(scene.notes?.values()).filter(nd => nd.entryId === journalEntry.id).map(note => note.id);
            } else if (QuickEncounter.isFoundryV8Plus) {
                matchingNoteIds = Array.from(scene.data.notes.values()).filter(nd => nd.data.entryId === journalEntry.id).map(note => note.id);
            } else {
                matchingNoteIds = scene.data.notes.filter(nd => nd.entryId === journalEntry.id).map(note => note._id);
            }
            if (!matchingNoteIds?.length) {continue;}
            //Deletion is triggered by Scene (because that's where the notes are stored)
            //v0.8.3a: If Foundry v0.8.x then don't delete the Note in the viewed Scene because the Journal._onDelete() trigger does that
            //v0.9.1b: Issue #57 Reintroduce deleltion of notes; doesn't seem to be handled in Foundry 0.8.9
            scene.deleteEmbeddedDocuments("Note", matchingNoteIds);
            numNotesDeleted += matchingNoteIds.length;
        }

        if (numNotesDeleted) {
            //0.4.2: Replaces Dialog.prompt from Foundry 0.7.2
            EncounterNote.dialogPrompt({
                title: game.i18n.localize("QE.DeletedJournalNote.TITLE"),
                content: game.i18n.format("QE.DeletedJournalNote.Multiple.CONTENT",{numNotesDeleted}),
                label : "",
                callback : () => {console.log(`Deleted ${numNotesDeleted} Map Note(s)`);},
                options: {
                top:  window.innerHeight - 350,
                left: window.innerWidth - 720,
                width: 400,
                jQuery: false
                }
            });
        }

    }

    static dialogPrompt({title, content, label, callback}={}, options={}) {
        return new Promise(resolve => {
          const dialog = new Dialog({
            title: title,
            content: content,
            buttons: {
              close: {
                icon: '<i class="fas fa-check"></i>',
                label: label,
                callback: callback
              }
            },
            default: "close",
            close: resolve
          }, options);
          dialog.render(true);
        });
    }

    static async place(quickEncounter, options={}) {
        if (!quickEncounter) {return;}
        let qeNote = null;
        //Create a Map Note for this encounter - the default is where the saved Tokens were
        let noteAnchor = {}
        if (quickEncounter.coords) {
            noteAnchor = {
                x: quickEncounter.coords.x,
                y: quickEncounter.coords.y
            }
        } else if (options.placeDefault) {
            //Otherwise, place it in the middle of the canvas stage (current view)
            noteAnchor = {
                x : canvas.stage.pivot.x,
                y : canvas.stage.pivot.y
            }
        } else {return;}
        // Validate the final position is in-bounds
        //1.0.4l: Use canvas.stage.hitArea in v10
        const hitArea = QuickEncounter.isFoundryV10Plus ? canvas.stage.hitArea : canvas.grid.hitArea;
        if (hitArea.contains(noteAnchor.x, noteAnchor.y)) {
            // Create a Note; we don't pop-up the Note sheet because we really want this Note to be placed
            //(they can always edit it afterwards)
            qeNote = await EncounterNote.create(quickEncounter, noteAnchor);
        }
        return qeNote;
    }

    static getEncounterScene(journalEntry) {
        if (!journalEntry) {return null;}
        //1.0.4k: Use parent (which is what is saved to the map) if this is JournalEntryPage
        //1.0.7a: Check for FoundryV10
        const parentJournalEntry = (QuickEncounter.isFoundryV10Plus && (journalEntry instanceof JournalEntryPage)) ? journalEntry.parent : journalEntry;
        //if sceneNote is available, then we're in the Note Scene already
        if (parentJournalEntry.sceneNote) {return game.scenes.viewed;}
        else {          
            //Now we need to search through the available scenes to find a note with this Journal Entry
            for (const scene of game.scenes) {
                let notes;
                if (QuickEncounter.isFoundryV10Plus) {
                    notes = scene.notes;
                } else {
                    notes = scene.data.notes;
                }
                let foundNote;
                if (QuickEncounter.isFoundryV10Plus) {
                    foundNote = Array.from(notes.values()).find(nd => nd.entryId === parentJournalEntry.id);
                } else if (QuickEncounter.isFoundryV8Plus) {
                    foundNote = Array.from(notes.values()).find(nd => nd.data.entryId === parentJournalEntry.id);
                } else {
                    foundNote = notes.find(note => note.entryId === parentJournalEntry.id);
                }
                if (foundNote) {
                    return scene;
                }
            }
        }
        return null;
    }

    static async switchToMapNoteScene(qeScene, qeJournalEntry) {
        if (!qeScene) {return null;}
        await qeScene.view();
        //bail out if the Map Note hasn't been placed after 2s
        let timer = null;
        for (let count=0; count<10; count++) {
            timer = setTimeout(() => {},200);
            if (qeJournalEntry.sceneNote) {break;}
        }
        clearTimeout(timer);
        return qeJournalEntry.sceneNote;
    }

    //1.0.2c: Changed to sync operation (only called if there is no map note when you run)
    static noMapNoteDialog(quickEncounter, event, options) {
        Dialog.confirm({
            title: game.i18n.localize("QE.NoMapNote.TITLE"),
            content : game.i18n.localize("QE.NoMapNote.CONTENT"),
            yes : () => {
                //1.1.5e: Place a default MapNote and then call run() again
                EncounterNote.place(quickEncounter, {placeDefault : true}).then(() => {
                    //New approach - just pop up a prompt dialog
                    EncounterNote.dialogPrompt({
                        title: game.i18n.localize("QE.CreatedMapNote.TITLE"),
                        content: game.i18n.localize("QE.CreatedMapNote.CONTENT"),
                        label: "",
                        options: {
                            top: window.innerHeight - 350,
                            left: window.innerWidth - 720,
                            width: 400,
                            jQuery: false
                        }
                    });
                });
                return true;
            }
        });
    }

    static async mapNoteIsPlaced(qeScene, journalEntry) {
        //Get the scene for this Quick Encounter (can't use sceneNote if we're in the wrong scene)
        if (!qeScene || !journalEntry) {return false;}
        //1.0.4k: Use parent (which is what is saved to the map) if this is JournalEntryPage
        //1.0.7a: Check for FoundryV10
        const parentJournalEntry = (QuickEncounter.isFoundryV10Plus && (journalEntry instanceof JournalEntryPage)) ? journalEntry.parent : journalEntry;
        //If we're viewing the relevant scene and the map note was placed, then good
        if (parentJournalEntry.sceneNote) {return true;}

        //Otherwise ask if you want to switch to the scene - default is No/false
        let shouldSwitch = false;
        //v0.6.12: Testing parameterization of i18n strings, using Localization.format()
        // If there is an 0612 version use that with a parameter, otherwise there isn't a parameter yet and we do it the pre-0.6.12 way
        let content; 
        if (game.i18n.has("QE.SwitchScene.CONTENT_v0612", false)) {
            content = game.i18n.format("QE.SwitchScene.CONTENT_v0612", {sceneName : qeScene.name});
        } else {
            content = game.i18n.localize("QE.SwitchScene.CONTENT") + qeScene.name + "?";
        }
        await Dialog.confirm({
            title: game.i18n.localize("QE.SwitchScene.TITLE"),
            content : content,
            //0.5.0 Need the Yes response to wait until we are in the correct scene (so don't make it async)
            //and in particular, the Journal Note has been drawn
            yes : () => {shouldSwitch = true},
            no : () => {shouldSwitch = false}
        });
        if (shouldSwitch) {return EncounterNote.switchToMapNoteScene(qeScene, parentJournalEntry);}
        else {return false;}
    }

    static async checkForInstantEncounter(quickEncounter, qeAnchor) {
        //already confirmed that the setting is there
        const dialogData = {
            title: game.i18n.localize("QE.CheckInstantEncounter.TITLE"),
            content : game.i18n.localize("QE.CheckInstantEncounter.CONTENT"),
            button1cb : (html, event) => {
                const options = {
                    isInstantEncounter : true,
                    qeAnchor: qeAnchor
                }
                quickEncounter.run(event, options) 
            },
            button2cb : () => EncounterNote.create(quickEncounter, qeAnchor),
            button3cb : null,
            buttonLabels :  [game.i18n.localize("QE.CheckInstantEncounter.BUTTON.RUN_INSTANT"),
                            game.i18n.localize("QE.CheckInstantEncounter.BUTTON.CREATE_QE"),""],
            options : {}
        }

        Dialog3.buttons3(dialogData);
    }//end checkForInstantEncounter()

    //1.1.5 Created to handle JE or JEPage for hook on dropCanvasData - recloned NotesLayer._onDropData()
    static async checkForQEAndCreateNote(journalEntry, data) {
        //Takes either a JournalEntry or JournalEntryPage that is being dropped onto the canvas
        let journalEntryOrJEPage = journalEntry;
        console.warn("Replaced Journal Entry drag-and-drop with QuickEncounter.EncounterNote handling");

        //JournalEntry: Check if this is from a Compendium and also for migration from pre-v10 Foundry
        let quickEncounter;
        if (journalEntryOrJEPage instanceof JournalEntry) {
            if (journalEntryOrJEPage.compendium ) {
                //If it's a Compendium JE, have to create one before dropping
                const journalData = game.journal.fromCompendium(journalEntryOrJEPage);
                journalEntryOrJEPage = JournalEntry.implementation.create(journalData);
            }

            quickEncounter = QuickEncounter.extractQuickEncounterFromJEOrEmbedded(journalEntryOrJEPage);
            //Pre-v10 QEs are dynamically moved onto JournalEntryPage0 so check for that
            if (!quickEncounter && QuickEncounter.isFoundryV10Plus) {
                //1.0.4m We have to check at least the first JournalEntryPage (we know that we have dropped a Journal Entry)
                const journalEntryPage0 = journalEntryOrJEPage.pages?.values().next().value;
                quickEncounter = QuickEncounter.extractQuickEncounterFromJEOrEmbedded(journalEntryPage0);
            }
        } else { //JournalEntryPage 
            quickEncounter = QuickEncounter.extractQuickEncounterFromJEOrEmbedded(journalEntryOrJEPage);
        }

        //Get the world-transformed drop position - fortunately these have already been placed in (data.x,data.y) by Canvas._onDrop
        const noteAnchor = {x: data?.x, y: data?.y}
        if (quickEncounter) {
            //Confirmed this is a Quick Encounter
            //If we're checking for Instant Encounters, then pop a dialog
            if (game.settings.get(QE.MODULE_NAME, "checkForInstantEncounter")) {
                EncounterNote.checkForInstantEncounter(quickEncounter, noteAnchor);
            } else {
                EncounterNote.create(quickEncounter, noteAnchor);
            }
        } else {
            //create a normal Journal Entry Note
            const noteData = {entryId: journalEntryOrJEPage.id, x: noteAnchor.x, y: noteAnchor.y}
            //Another hack - because we don't have event we recover the raw drop location
            const clientX = (noteAnchor.x * canvas.stage.scale.x) + canvas.notes.worldTransform.tx;
            const clientY = (noteAnchor.y * canvas.stage.scale.y) + canvas.notes.worldTransform.ty;
            return canvas.notes._createPreview(noteData, {top: clientY - 20, left: clientX + 40});
        }
    }//end async checkForQEAndCreateNote()
}

//Delete any corresponding Map Notes if you delete the Journal Entry
Hooks.on("deleteJournalEntry", EncounterNote.delete);

//Pretty up the first Map Note (hopefully we can do the same for others)
Hooks.on(`renderEncounterNoteConfig`, async (noteConfig, html, data) => {
    const updateEncounterMapNote = game.i18n.localize("QE.UpdateEncounterMapNote.BUTTON");
    html.find('button[name="submit"]').text(updateEncounterMapNote);
});

//1.0.1: Instant Encounters - intercept Note creation and check if it's an Instant Encounter (initially with a dialog)
//If you drag a Quick Encounter Journal Entry to the Scene, then intercept it to render it similarly,
//and also ask about Instant Encounters
//Note that intercepting preCreateNoteDocument is too late because we are approving the preview at that point
//and renderNoteConfig it's too difficult to change the form of the Note
Hooks.on(`dropCanvasData`, (canvas, data) => {
    //This is a hack because we're basically replicating canvas.notes._onDropData()
    // Acquire Journal entry 
    //- because it's async and this hook can't be (otherwise it prematurely returns true and creates a preview) use .then chaining
    //1.1.5 check for either JournalEntry OR JournalEntryPage
    if ((data?.type === "JournalEntry") || (data?.type === "JournalEntryPage")) {
        let cls;
        if (QuickEncounter.isFoundryV12Plus) {
            cls = getDocumentClass(data?.type);
        } else if (data?.type === "JournalEntry") {
            cls = JournalEntry;
        } else if (data?.type === "JournalEntryPage") {
            cls = JournalEntryPage;
        }
        cls.fromDropData(data).then(j => {
            EncounterNote.checkForQEAndCreateNote(j, data);
        });
    } else {return true;}   //handle dropping something else
    return false;   //stop processing - we're replacing Journal Note creation entirely
});
