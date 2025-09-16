import { EncounterNote } from './EncounterNote.js';
import { QESheet } from './QESheet.js';
import { MODULE_ID, MODULE_VERSION, JSON_FLAG, TOKENS_FLAG, ACTOR, dieRollReg } from './constants.js';
import { AddToEncounter, LinkToEncounter } from './dialogs.js';

export class QuickEncounter {
    constructor(qeData = {}) {
        if (!qeData) { return; }
        this.journalEntry = qeData.journalEntry;        //1.0.4j: Preparatory to removing journalEntryId
        this.journalEntryId = qeData.journalEntryId;    //DEPRECATED
        //In v0.6 this contains savedTokensData
        this.extractedActors = qeData.extractedActors;
        //0.7 Now has tiles as well
        this.savedTilesData = qeData.savedTilesData;
        //1.1.1 Basic implementation of Actor RollTables support - should check here whether it's an Actor RollTable
        this.rollTables = qeData.extractedRollTables;
        this.hideQE = null;     //Means it has never been set, so follow the Auto flag

        if (this.extractedActors?.length) {
            for (const [i, eActor] of this.extractedActors.entries()) {
                if (!eActor.savedTokensData) { this.extractedActors[i].savedTokensData = []; }
            }
        }

        //VERSION 0.5 (or <= 0.6): savedTokens were stored separately
        if (!qeData.qeVersion || qeData.qeVersion < 0.6) {
            if (qeData.savedTokensData) {
                qeData.savedTokensData.forEach(td => { td.isSavedToken = true; })
                //0.6.8 Bug: If you have multiple of the same Actors, this was assocating saved Tokens with both
                //Instead "use up" the savedTokens for Actors of the same ID
                //Create a map of actors to tokens
                let actorToTokensMap = {}
                //FIXME: If you have multiple actors, this will reset the map multiple times  - must be a better way to do this                
                //0.8.0e: Was failing with "this.extractedActors not iterable"; non-fatal, but now check to be cleaner               
                if (!this.extractedActors) { return; }
                for (const eActor of this.extractedActors) {
                    actorToTokensMap[eActor.actorID] = qeData.savedTokensData.filter(td => (td.actorId === eActor.actorID));
                }
                //Now repeat the loop and assign the savedTokens
                for (const [i, eActor] of this.extractedActors.entries()) {
                    //If you have a non-numeric numActors (e.g. a dice roll) assign all the savedTokens
                    const numActors = (typeof eActor.numActors === "number") ? eActor.numActors : actorToTokensMap[eActor.actorID].length;
                    const savedTokensData = actorToTokensMap[eActor.actorID].slice(0, numActors);
                    this.extractedActors[i].savedTokensData = savedTokensData;
                    //And remove this from the map, so that any further Actor will only get what's left
                    //The side-effect will be that if you have too many tokens, you'll lose some
                    actorToTokensMap[eActor.actorID].splice(0, numActors);
                }

            }
        }
    }

    async serializeIntoJournalEntry(newJournalEntry = null) {
        console.log("serializing into journal entry");
        
        /*Handles three possibilities as a form of polymorphism:
        1. newJournalEntry is non-null => update this.journalEntry and the other variables
        2. newJournalEntry is null, but the qe.journalEntry is non-null - update the existing JE
        3. newJournalEntry is null, and qe.journalEntry is null - do nothing
        */
        // 1.0.4j: Save journalEntry so we can avoid serializing the whole object into the JSON
        //1.1.4b: Reversed this test so that newJournalEntry takes precedence (e.g. you're moving it onto Page0 from the JE)
        const qeJournalEntry = newJournalEntry ?? this.journalEntry;
        if (!qeJournalEntry) { return; }
        this.journalEntry = null;   //temporary until after serializing into JE

        //v0.6.1 - store created quickEncounter - but can't store object, so serialize data
        this.qeVersion = MODULE_VERSION;
        //0.7.3 When we've changed the Quick Encounter we want to force showing the QE dialog
        const qeJSON = JSON.stringify(this);
        this.journalEntry = qeJournalEntry;

        qeJournalEntry.showQEOnce = true;   //because we made a change
        await qeJournalEntry?.setFlag(MODULE_ID, JSON_FLAG, qeJSON);
    }

    static deserializeFromJournalEntry(journalEntry) {
        console.log("Attempting to deserialize from journal entry");
        //1.0.4e: Check for null journalEntry because we're removing the extractQuickEncounterFromJE
        if (!journalEntry) { return null; }
        let quickEncounter = new QuickEncounter();  //makes sure it has functions etc.
        let qeJSON = journalEntry?.getFlag(MODULE_ID, JSON_FLAG);
        if (qeJSON) try {
            const quickEncounterFromData = JSON.parse(qeJSON);
            //1.2.3d: Replace v12 mergeObject with foundry.utils version
            quickEncounter = foundry.utils.mergeObject(quickEncounter, quickEncounterFromData);

            //v0.6.1: Backwards compatibility - set the isSavedToken flag
            quickEncounter.extractedActors?.forEach(eActor => {
                eActor.savedTokensData?.forEach(td => { td.isSavedToken = true; });
            });

        } catch {
            console.log(`Invalid JSON: ${qeJSON}`);
        }
        //1.0.4j: Record journalEntry in preparation to eliminating lookup via journalEntryId
        quickEncounter.journalEntry = journalEntry;

        //quickEncounter will ALWAYS be non-null, but we want to make sure it has real data
        //0.7.0b Check now that either extractedActors or savedTiles is non-null
        //1.0.5f If this has isMigratedToV10 then it's a JE-level one that's been copied to the JournalEntryPage0
        if (quickEncounter.isMigratedToV10 || (!quickEncounter.extractedActors && !quickEncounter.savedTilesData)) {
            quickEncounter = null;
        }
        return quickEncounter;
    }
    update(newQEData) {
        //1.2.3d: Replace v12 mergeObject with foundry.utils version
        foundry.utils.mergeObject(this, newQEData);
        //Update into Journal Entry
        this.serializeIntoJournalEntry();
    }
    async remove(qeJournalEntry) {
        //DEPRECATED: Shouldn't need to pass this from QESheet
        await qeJournalEntry?.setFlag(MODULE_ID, JSON_FLAG, null);
    }

    checkAndFixOriginalNoteData(clickedNote) {
        //0.6.13: If originalNoteData is not set, we try to recover it from savedTokens
        if (!clickedNote || this.originalNoteData || !this.extractedActors?.length) { return false; }
        for (const eActor of this.extractedActors) {
            for (const std of eActor.savedTokensData) {
                if ((std.x === clickedNote.data.x) && (std.y === clickedNote.data.y)) {
                    this.originalNoteData = clickedNote.data;
                    return true;    //yes we were able to fix - serialize
                }
            }
        }
        return false;
    }


    static init() {
        //0.6.13 Initialize which Note you are hovering over
        QuickEncounter.hoveredNote = null;
    }

    static runAddOrCreate(event, clickedQuickEncounter) {
        //Will only have a clickedQuickEncounter when called from the QE dialog with the [Add tokens/tiles] button
        let FRIENDLY_TOKEN_DISPOSITIONS = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
        console.log("RunAddOrCreate")
        //Called when you press the Quick Encounters button (crossed-swords) from the sidebar
        //If you are controlling tokens it creates a new Quick Encounter Journal Entry
        //0.6.4: If there's an open Journal Entry it asks if you want to add the tokens to it or run it
        //Method 1: Get the selected tokens and the scene
        //Exclude friendly tokens unless you say yes to the dialog
        //Tokens
        const controlledTokens = Array.from(canvas.tokens?.controlled);
        let controlledNonFriendlyTokens;
        let controlledFriendlyTokens;
        //1.0.4l: .data is deprecated in v10
        controlledNonFriendlyTokens = controlledTokens?.filter(t => t.document.disposition !== FRIENDLY_TOKEN_DISPOSITIONS);
        controlledFriendlyTokens = controlledTokens?.filter(t => t.document.disposition === FRIENDLY_TOKEN_DISPOSITIONS);

        //Tiles
        //0.7.0b: Capture controlled tiles (will be one or the other of foreground or background, not both)
        //0.9.6b: Switch to using canvas.foreground and canvas.background because Tile.layer doesn't exist in Foundry 9
        //1.0.4l: Foundry v10 has controlled array like tokens
        let controlledTiles = Array.from(canvas.tiles?.controlled);
        let controlledAssets;
        //v0.6.1 If you have both controlledNonFriendly tokens AND an open Quick Encounter, ask if you want to add to it
        //0.7.0 Add tiles; can't have both simultaneously because you have to switch tools in the Control pallette to select tiles
        if (controlledTokens?.length || controlledTiles?.length) {
            controlledAssets = {
                tokens: controlledTokens,
                tiles: controlledTiles
            }
        }

        //1.0.5a, If clickedQuickEncounter is set, then just Add any controlled tokens/tiles to it
        if (clickedQuickEncounter) {
            if (controlledAssets) {
                clickedQuickEncounter.add(controlledAssets);
            } else {
                //No controlled Assets, so pop-up an alert saying so
                ui.notifications.warn(game.i18n.localize("QE.Notification.SelectTokensOrTiles.WARN"));
            }
        } else if (controlledAssets) {
            //See if the open QE method works
            //0.9.1a: (from ironmonk88) Pass this so we can check for Monk's Enhanced Journal 
            //1.1.4c: Return JournalEntry or JournalEntryPage instead of Sheet
            const candidateJEorQE = QuickEncounter.findQuickEncounter.call(this);
            const openQuickEncounter = (candidateJEorQE instanceof QuickEncounter) ? candidateJEorQE : null;
            const openJournalEntry = ((candidateJEorQE instanceof JournalEntry) ||
                (candidateJEorQE instanceof JournalEntryPage)
            ) ? candidateJEorQE : null;

            //Existing Quick Encounter: Ask whether to run, add new assets, or create one from scratch
            if (openQuickEncounter) {

                new AddToEncounter(event, openQuickEncounter, controlledAssets).render(true);


                /*Dialog3.buttons3({
                    title: game.i18n.localize("QE.AddToQuickEncounter.TITLE"),
                    content: game.i18n.localize("QE.AddToQuickEncounter.CONTENT"),
                    button1cb: () => {openQuickEncounter.run(event);},
                    button2cb: () => {openQuickEncounter.add(controlledAssets)},
                    button3cb: () => {QuickEncounter.createFrom(controlledAssets)},
                    buttonLabels : ["QE.AddToQuickEncounter.RUN",  "QE.AddToQuickEncounter.ADD",  "QE.AddToQuickEncounter.CREATE"]
                });*/
            } else if (openJournalEntry) {
                //Existing Journal Entry, ask if you want to create a Quick Encounter out of it
                new LinkToEncounter(event, openQuickEncounter, controlledAssets).render(true);

                /*Dialog3.buttons3({
                    title: game.i18n.localize("QE.LinkToQuickEncounter.TITLE"),
                    content: game.i18n.localize("QE.LinkToQuickEncounter.CONTENT"),
                    button1cb: () => {QuickEncounter.link(openJournalEntry,controlledAssets)},
                    button2cb: () => {QuickEncounter.createFrom(controlledAssets)},
                    button3cb: null,
                    buttonLabels : ["QE.LinkToQuickEncounter.LINK",  "QE.AddToQuickEncounter.CREATE"]
                });*/
            } else if (controlledFriendlyTokens?.length) {
                //Check whether you meant to add friendly tokens
                foundry.applications.api.DialogV2.confirm({
                    window: { title: game.i18n.localize("QE.IncludeFriendlies.TITLE") },
                    content: game.i18n.localize("QE.IncludeFriendlies.CONTENT"),
                    yes: () => { QuickEncounter.createFrom(controlledAssets) },
                    no: () => {
                        controlledAssets.tokens = controlledNonFriendlyTokens;
                        if (controlledNonFriendlyTokens?.length) { QuickEncounter.createFrom(controlledAssets); }
                    }
                });
            } else {
                QuickEncounter.createFrom(controlledAssets);
            }
        } else {
            //No selected tokens/tiles or open Journal Entry => show/reshow the Tutorial
            QuickEncounter.showTutorialJournalEntry();
        }
    }//end static runAddOrCreate()

    /* Method 1: createFromTokens
    * Delete the controlled (selected) tokens and record their tokenData in a created Journal Entry
    * Also embed Actors they represent (for clarity)
    **/
    static async createFrom(controlledAssets) {
        //Seems inelegant - especially since we'd like to update the journalEntry        
        let quickEncounter = QuickEncounter.createQuickEncounterAndAdd(controlledAssets);

        //Create a new JournalEntry - the corresponding map note gets automatically created too
        //0.9.1d Issue #61: Move the Encounter oppnents to the top of the JE
        let content = game.i18n.localize("QE.Instructions.CONTENT1");
        //0.7.0 extractedActors could be null if we have just tiles or other (non-Actor/token assets)
        if (quickEncounter.extractedActors) {
            for (const eActor of quickEncounter.extractedActors) {
                const actor = await QuickEncounter.getActor(eActor);
                const xp = QuickEncounter.getActorXP(actor);
                const xpString = xp ? `(${xp}XP each)` : "";
                content += `<li>${eActor.numActors}@Actor[${actor.id}]{${actor.name}} ${xpString}</li>`;
            }
        }
        content += game.i18n.localize("QE.Instructions.CONTENT2");
        //1.1.0d: Use a default folder if specified - show warning if a name is specified but not found
        const defaultFolderName = game.settings.get(MODULE_ID, "defaultQEFolder");
        const defaultFolder = game.folders?.getName(defaultFolderName);
        if (defaultFolderName && !defaultFolder) {
            ui.notifications.warn(game.i18n.format("QE.Notification.FolderNotFound.WARN", { defaultFolderName: defaultFolderName }));
        }
        const journalData = {
            folder: defaultFolder?.id,
            name: `Quick Encounter: ${game.scenes?.viewed?.name}`,
            content: content,
            type: "encounter",
            types: "base"
        }
        //0.9.2a: Per ironmonk88, activate:false tells Enhanced Journals to not pop up the new JE yet (because there's a sheet render below)
        let journalEntry = await getDocumentClass("JournalEntry").create(journalData, { activate: false });
        let qeJournalEntry = journalEntry; //the Journal Entry or JournalEntryPage we will store the QE with
        //1.0.4l: In Foundry v10, we want to make this the first JournalEntryPage
            //1.2.3f: In v10 and v11 there was a default page0; that doesn't seem to be true in v12
            let journalEntryPage0 = journalEntry.pages?.values()?.next()?.value;
            if (!journalEntryPage0) {
                const journalEntryData = {
                    name: journalEntry.name,
                    sort: 100000,
                    type: "text",
                    text: {
                        content: content,
                        format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML
                    }
                }
                //Issue #144: Should use getDocumentClass instead of class names directly
                journalEntryPage0 = await getDocumentClass("JournalEntryPage").create(journalEntryData, { parent: journalEntry, pack: null, renderSheet: false });
            }
            if (journalEntryPage0) { qeJournalEntry = journalEntryPage0; }
        

        //REFACTOR: Individual property setting and order is fragile        
        quickEncounter.serializeIntoJournalEntry(qeJournalEntry);
        //And create the Map Note - needs journalEntry.id to be set already
        const newNote = await EncounterNote.place(quickEncounter);
        //0.6.13: Record the Map Note data because we will use it to distinguish between the original and copied Scene Notes
        quickEncounter.originalNoteData = newNote?.data;

        //v0.6.1k Update the created/changed QuickEncounter into the Journal Entry
        quickEncounter.serializeIntoJournalEntry(qeJournalEntry);

        //v0.6.3: Show the Journal Sheet last so it can see the Map Note
        //v1.1.0c: Create a Journal Sheet from the parent Journal Entry (which will show the sub-page if there is one)
        const ejSheet = new foundry.appv1.sheets.JournalSheet(journalEntry);
        ejSheet.render(true);   //0.6.1: This will also pop-open a QE dialog if you have that setting
    }


    static createQuickEncounterAndAdd(controlledAssets) {
        let quickEncounter = new QuickEncounter();    //empty QuickEncounter   
        quickEncounter.add(controlledAssets);     //This will also update extractedActors etc.
        return quickEncounter;
    }

    static link(openJournalEntry, controlledAssets) {
        let quickEncounter = QuickEncounter.createQuickEncounterAndAdd(controlledAssets);
        //FIXME: add() already calls serializeIntoJournalEntry(), but here we are updating with the source journalEntry
        quickEncounter.serializeIntoJournalEntry(openJournalEntry);
        //Force a re-render which should pop up the QE dialog
        //FIXME: Is this necessary? I thought setFlag() would already force a re-render of the JE
        //1.1.4 If the sheet is showing, then re-render
        if (openJournalEntry.sheet) { openJournalEntry.sheet.render(true); }
    }


    async add(controlledAssets) {
        const controlledTokens = controlledAssets?.tokens;
        const controlledTiles = controlledAssets?.tiles;
        //Either tokens or tiles should be present
        if (!controlledTokens?.length && !controlledTiles?.length) return;

        //0.7.0 Either tokens or tiles are present, but not both (for now) - but we won't depend on this always being true
        if (controlledTokens?.length) {
            //0.6.2: If we don't already have coords, then use the tokens we just added
            //0.7.0d: Set QE coords (where tokens are generated around)
            if (!this.coords) {
                    this.coords = { x: controlledTokens[0].document.x, y: controlledTokens[0].document.y }
            }
            this.addTokens(controlledTokens);
        }
        if (controlledTiles?.length) {
            //0.7.0d: Set QE coords if not already set
            if (!this.coords) {
                    this.coords = { x: controlledTiles[0].document.x, y: controlledTiles[0].document.y }
                
            }
            this.addTiles(controlledTiles);

        }
        //v0.6.1k Update the created/changed QuickEncounter into the Journal Entry
        this.serializeIntoJournalEntry();
    }


    addTokens(controlledTokens) {
        if (!controlledTokens) return;

        //Add the new tokens to the existing ones (or creates new ones)
        //Use tokenData because tokens is too deep to store in flags
        let controlledTokensData;
            //1.0.4l: "data" replaced by "document" object
            controlledTokensData = controlledTokens.map(ct => { return ct.document.toObject() });
        
        //TODO: Is this necessary, or could we just remove controlledTokensData?
        const newSavedTokensData = foundry.utils.duplicate(controlledTokensData);

        //Find set of distinct actors - some/all of these may be new if the addTokens is being called from create
        let tokenActorIds = new Set();
        for (const tokenData of newSavedTokensData) {
            tokenActorIds.add(tokenData.actorId);
        }

        //And compare against the saved list of Actors to adjust numbers if necessary
        //v0.6.8 Allow for more than one instance of the Actor in the list (must have been originally created from a Journal Entry)
        for (const tokenActorId of tokenActorIds) {
            const tokensData = newSavedTokensData.filter(t => t.actorId === tokenActorId);

            //v0.6.8: Could be more than one instance of an actorId
            const extractedActorsOfThisActorId = this.extractedActors?.filter(eActor => eActor.actorID === tokenActorId);

            if (extractedActorsOfThisActorId?.length) {
                //We found this Actor - allocate the saved tokens
                for (const [i, eActor] of extractedActorsOfThisActorId.entries()) {
                    if (typeof eActor.numActors === "number") {
                        //Option 2: Add as many tokens as we need
                        const numNeededTokens = eActor.numActors - eActor.savedTokensData.length;
                        if (numNeededTokens > 0) {
                            //Note that we have to check min() because the weird behavior is that splice doesn't delete if numNeededTokens>length
                            const tokensDataToTransfer = tokensData.splice(0, Math.min(numNeededTokens, tokensData.length));
                            extractedActorsOfThisActorId[i].savedTokensData = eActor.savedTokensData.concat(tokensDataToTransfer);
                        }
                    } else {
                        //In this case the numActors is a diceroll, so we don't change numActors but assign all the tokens
                        //FIXME: Should just fill out to the maxRoll
                        extractedActorsOfThisActorId[i].savedTokensData = eActor.savedTokensData.concat(tokensData);
                        //v0.6.11 - was allocating here and then doing it again below
                        tokensData.length = 0;
                    }
                }//end for 
                //v0.6.9: If there are addedTokensData left over, add them to the 0th element and increase the numActors
                if (tokensData.length) {
                    //Should have savedTokensData already 
                    extractedActorsOfThisActorId[0].savedTokensData = extractedActorsOfThisActorId[0].savedTokensData.concat(tokensData);
                    if (typeof extractedActorsOfThisActorId[0].numActors === "number") {
                        extractedActorsOfThisActorId[0].numActors = extractedActorsOfThisActorId[0].savedTokensData.length;
                    }
                }
            } else {
                //Option 1. We don't find this actor - then add a new Actor with ALL of the relevant tokens
                const actor = game.actors.get(tokenActorId);
                const newExtractedActor = {
                    numActors: tokensData.length,
                    dataPackName: null,              //if non-null then this is a Compendium reference
                    actorID: tokenActorId,           //If Compendium sometimes this is the reference
                    name: actor?.name,
                    savedTokensData: tokensData
                }
                //v0.6.4 No longer setting extractedActors=[] in constructor
                if (!this.extractedActors) { this.extractedActors = []; }
                this.extractedActors.push(newExtractedActor);
            }
        }//end for tokenActorIds


        //0.9.0g: By default, delete the existing tokens (because they will be replaced) 
        // - but as an option (setting) you can leave the tokens on the map and they will be used instead of being generated
        // (You can still selectively delete them)
        const controlledTokensIds = controlledTokens.map(ct => { return ct.id });
            const deleteTokensAfterAdd = game.settings.get(MODULE_ID, "deleteTokensAfterAdd");
            if (deleteTokensAfterAdd) {
                canvas.scene.deleteEmbeddedDocuments("Token", controlledTokensIds);
            }

    }//end addTokens()

    addTiles(controlledTiles) {
        if (!controlledTiles) return;
        //Modelled after addTokens

        //Add the new tiles to the existing ones (or creates new ones)
        //Use tilesData because tiles is too deep to store in flags
        //v0.8.2b: Store whether this tile is background (default) or foreground - for Foundry 0.7.x should set ctd.layer="background"    
        let controlledTilesData = controlledTiles.map(ct => {
            //0.8.3c: Use the toObject() function to get a shallow copy (without prototypes) of controlledTiles.data
            let ctd = ct.data;
                ctd = ct.data.toObject();
            ctd.layer = ct.document?.layer?.options?.name ?? "background";
            return ctd;
        });

        if (!this.savedTilesData) { this.savedTilesData = []; }
        this.savedTilesData = this.savedTilesData.concat(Qfoundry.utils.duplicate(controlledTilesData));

        //Delete the existing tokens (because they will be replaced)
        const controlledTilesIds = controlledTiles.map(ct => { return ct.id });
            canvas.scene.deleteEmbeddedDocuments("Tile", controlledTilesIds);
        
    }



    static async showTutorialJournalEntry() {
        //0.5.0: Check if there's an existing open Tutorial
        const existingTutorial = QuickEncounter.findOpenQETutorial();
        if (existingTutorial) {
            existingTutorial.maximize();
            return;
        }

        //Create a new JournalEntry - with info on how to use Quick Encounters
        const howToUseJournalEntry = await foundry.applications.handlebars.renderTemplate('modules/quick-encounters/templates/how-to-use.html');
        const title = game.i18n.localize("QE.HowToUse.TITLE");
        const content = howToUseJournalEntry;

        const journalData = {
            folder: null,
            name: title,
            content: content,
            type: "encounter",
            types: "base"
        }
        const journalEntry = await getDocumentClass("JournalEntry").create(journalData);

        //v12.1.1: In Foundry v12 it doesn't appear to create a Journal Entry Page by default
        const journalEntryData = {
            name: journalEntry.name,
            sort: 100000,
            type: "text",
            text: {
                content: content,
                format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML
            }
        }
        const journalEntryPage = await getDocumentClass("JournalEntryPage").create(journalEntryData, { parent: journalEntry, pack: null, renderSheet: false });


        const ejSheet = new foundry.appv1.sheets.JournalSheet(journalEntry);
        ejSheet.render(true);
    }


    /* Method 2: Look through open Windows to find a Journal Entry with Actors and a Map Note
    *
    */
    static findQuickEncounter() {
        //Return either a Quick Encounter, a JournalPageSheet, a JournalEntryPage, or null (in order of priority)
        if (Object.keys(ui.windows).length !== 0) {
            let openJournalSheet = null;
            //1.1.4 FoundryV10 - look at the JournalPage children of each JournalSheet for a QuickEncounter
            //1.1.4d Look for any open QESheet firstly (if you have multiple, you'll get "the first" one)
            for (let w of Object.values(ui.windows)) {
                if (w instanceof QESheet) { return w.object; }
            }
            //1.1.4d Look for an open JournalPageSheet (this works in single- or multi-page mode)
            for (let w of Object.values(ui.windows)) {
                if (w instanceof JournalPageSheet) { return w.object; }
            }
            //1.1.4d Look for an open JournalSheet and pick the currently selected JournalEntryPage (in single-mode)
            for (let w of Object.values(ui.windows)) {
                if ((w instanceof JournalSheet) && (w.mode === 1)) {
                    //Get the currently selected JournalEntryPage
                    const journalEntryPage = w.pageIndex < w.object.pages.size ? Array.from(w.object.pages)[w.pageIndex] : null;
                    if (journalEntryPage) { return journalEntryPage; }
                }
            }
            //Otherwise look for JournalSheets, including Monks Enhanced Journal
            for (let w of (this instanceof JournalSheet ? [this] : Object.values(ui.windows))) {
                ////0.9.1a: (from ironmonk88) Check to see if this is an Enhanced Journal window and get the subsheet
                if (w.subsheet) { w = w.subsheet; }
                //Check open windows for a Journal Sheet with a Map Note and embedded Actors
                if (w instanceof JournalSheet) {
                    openJournalSheet = w;
                    const quickEncounter = QuickEncounter.extractQuickEncounter(w);
                    if (quickEncounter) { return quickEncounter; }
                }
                //1.1.4c Changed to return JE rather than sheet
                if (openJournalSheet) { return openJournalSheet.object; }
            }
        }
        return null;
    }

    static findOpenQETutorial() {
        if (Object.keys(ui.windows).length === 0) { return null; }
        else {
            let qeTutorial = null;
            for (let w of Object.values(ui.windows)) {
                //Check open windows for the tutorial Journal Entry
                if (w instanceof foundry.appv1.sheets.JournalSheet) {
                    const journalEntry = w.object;
                    if (journalEntry && (journalEntry.name === game.i18n.localize("QE.HowToUse.TITLE"))) {
                        qeTutorial = w;
                        break;
                    }
                }
            }
            return qeTutorial;
        }
    }



    static extractQuickEncounter(journalSheet, htmlElements) {
        const journalEntry = journalSheet?.object;
        console.log(journalEntry);
        return QuickEncounter.extractQuickEncounterFromJEOrEmbedded(journalEntry, htmlElements);
    }

    static extractQuickEncounterFromJEOrEmbedded(journalEntry, htmlElements) {
        //1.0.4: This should always be called with the correct JE or JEPage, except for when you are dropping a Note (and in that case it's called twice)
        if (!journalEntry) { return null; }

        let quickEncounter = QuickEncounter.deserializeFromJournalEntry(journalEntry);
        if (!quickEncounter) {
            console.log("serialize from journal entry failed, extract from embedded next");
            quickEncounter = QuickEncounter.extractQuickEncounterFromEmbedded(journalEntry, htmlElements);
        }
        return quickEncounter;
    }

    static extractQuickEncounterFromEmbedded(journalEntry, htmlElements) {
        if (!journalEntry) { return null; }
        let quickEncounter;
        console.log(journalEntry);
        //Extract it the old (v0.5) way - this also still applies if you create a Journal Entry with Actor or Compendium links
        //0.6 this now potentially includes Compendium links
        //1.0.4c: If journalEntry is actually a JournalEntryPage, then content is stored differently
        const computedHtmlElements = htmlElements ?? journalEntry.sheet.element;
        //v1.1.1b Extract RollTables as well (note these are not yet stored in the QuickEncounter, so if you modify the QE at all they will not be retained )
        const { extractedActors, extractedRollTables } = QuickEncounter.extractFromEmbedded(computedHtmlElements);
        const savedTokensData = journalEntry.getFlag(MODULE_ID, TOKENS_FLAG);
        //v0.6.1: Backwards compatibility - set the isSavedToken flag
        savedTokensData?.forEach(td => { td.isSavedToken = true; });

        //Minimum Quick Encounter has a Journal Entry, and tokens or actors (or 0.6 Compendium which turns into Actors)
        //If there isn't a map Note we may need to switch scenes
        if ((extractedActors && extractedActors.length) || (savedTokensData && savedTokensData.length) || (extractedRollTables && extractedRollTables.length)) {
            const qeData = {
                qeVersion: 0.5,
                journalEntry: journalEntry,        //1.0.4j: Preparatory to removing journalEntryId (could be JE or JE Page)
                journalEntryId: journalEntry.id,
                extractedActors: extractedActors,
                savedTokensData: savedTokensData,
                extractedRollTables: extractedRollTables
            }
            quickEncounter = new QuickEncounter(qeData);
        }

        console.log(quickEncounter);
        return quickEncounter;
    }

    static extractFromEmbedded(html) {
        const ACTOR_PERIOD = "Actor.";
        //1.1.1c Extract Rolltable; we would still need to filter in only those that referenced Actors
        const ROLLTABLE = "RollTable";
        const ROLLTABLE_PERIOD = "RollTable.";
        const extractActorRollTables = game.settings.get(MODULE_ID, "extractActorRollTables");

        //1.0.3a: Foundry v10 has changed the class (to content-link) and attributes used
        let searchTerms = {
                class: ".content-link",
                dataType: "data-type",
                dataID: "data-uuid"
        
        }

        const extractedActors = [];
        //1.1.1b Extract Rolltables
        const extractedRollTables = [];
        const INTREG = "([0-9]+)[^0-9]*$"; //Matches last "number followed by non-number at the end of a string"

        const entityLinks = html.find(searchTerms.class);
        if (!entityLinks || !entityLinks.length) { return { extractedActors, extractedRollTables }; }
        entityLinks.each((i, el) => {
            const element = $(el);
            const dataEntity = element.attr(searchTerms.dataType);
            let dataID = element.attr(searchTerms.dataID);
            const dataName = element.text();

            //1.1.1b Move extraction of multiplier here so it can be used in both Actor and Rolltable
            const prevSibling = element[0].previousSibling;
            let multiplier = 1;
            //v0.6 Check for a die roll entry
            if (prevSibling) {
                if (prevSibling.classList && prevSibling.classList.contains("inline-roll")) {
                    //Try to get it from the data-formula attribute
                    try {
                        multiplier = prevSibling.attributes["data-formula"].value;
                        if (!multiplier) { multiplier = 1; }
                    } catch {
                        //Otherwise try to parse it out
                        multiplier = prevSibling.textContent.match(dieRollReg);
                        multiplier = multiplier ? multiplier[0] : 1;
                    }
                } else {
                    const possibleInts = prevSibling.textContent.match(INTREG);
                    multiplier = parseInt(possibleInts ? possibleInts[0] : "1", 10);
                }
            }

            //0.6 If it's a Compendium we just have a data.pack attribute
            const dataPackName = element.attr("data-pack"); //Not used if Actor
            const dataLookup = element.attr("data-lookup");
            //Get the dataPack entity type (has to be Actor)
            const dataPack = game.packs.get(dataPackName);

            if ((dataEntity === ACTOR) || (dataPack && (dataPack.documentName === ACTOR))) {
                //1.0.4d: FOr Foundry v10 the new UUID format is "Actor.xxxx" but we are still doing just actor lookup later (including for backward compatibility)
                dataID = dataID.replace(ACTOR_PERIOD, ""); //remove Actor.

                //If this is a Compendium, then that may use either data-lookup or data-id depending on the index
                //Although in Foundry 0.7.4 I can't find _replaceCompendiumLink any more
                extractedActors.push({
                    numActors: multiplier ? multiplier : 1,
                    dataPackName: dataPackName,                    //if non-null then this is a Compendium reference
                    actorID: dataID ? dataID : dataLookup,           //If Compendium sometimes this is the reference
                    name: dataName
                });
            } else if (extractActorRollTables && (dataEntity === ROLLTABLE)) {
                dataID = dataID.replace(ROLLTABLE_PERIOD, ""); //remove Rolltable. (is this necessary since we are not trying to be backward compatible)
                extractedRollTables.push({
                    numActors: multiplier ? multiplier : 1,    //applied to each Actor in the RollTable
                    rollTableId: dataID,
                    name: dataName
                })
            }
        });

        return { extractedActors, extractedRollTables };
    }




    /* RUN the Quick Encounter (by using the embedded button or the side button)
        - Recall the saved tokens data
        - Generate additional token data from the number of Actors
        - Create and place the tokens
        - Add them to the Combat Tracker
    */

    async run(event, options = {}) {
        //0.4.0 Refactored so that both buttons (embedded or external) come here
        //You open the Journal and press the button
        //- Extract the actors (if any)
        //- Find the encounter location based on the Note position
        //- Create tokens (or use existing ones if they exist)
        //1.0.4j: Get journalEntry from QE property 
        //1.0.4k: Use parent (which is what is saved to the map) if this is JournalEntryPage
        //1.1.4c: Allowing for the possibility that JournalEntryPage is dragged to the map, revert to saving that and check later for Map Note
        const noteJournalEntry = this.journalEntry;
        if (!noteJournalEntry) { return; }

        //Check that we have something stored (actors, tokens, tiles, or rolltable)
        const extractedActors = this.extractedActors;
        const savedTokensData = this.savedTokensData;
        const savedTilesData = this.savedTilesData;
        const rollTables = this.rollTables;
        //Create tokens from embedded Actors - use saved tokens in their place if you have them
        //0.7.0b Need to have qeJournalEntry plus either Actors, tokens, rolltables, or tiles
        if (!(extractedActors?.length || savedTokensData?.length || savedTilesData?.length || rollTables?.length)) { return; }

        //1.0.1: If this is an Instant Encounter, then we ignore checking for a Map Note and just use the drop coordinates
        if (options?.isInstantEncounter) {
            this.sourceNoteData = {
                _id: null,
                x: options?.qeAnchor?.x,
                y: options?.qeAnchor?.y
            }
        } else {
            //Find the Map Note associated with this Journal Entry (or its parent if that exists) - if none then prompt to create one
            //0.6.13 If we have clickedNote specified we know we're in the right scene, otherwise see where there is one
            let mapNote = noteJournalEntry.clickedNote;
            if (!mapNote) {
                mapNote = await this.findMapNoteForJE(noteJournalEntry);
                if (!mapNote && (noteJournalEntry instanceof JournalEntryPage)) {
                    mapNote = await this.findMapNoteForJE(noteJournalEntry.parent);
                }
            }
            //1.1.5e If the above fails, then we need to offer to create a mapNote and then rerun this
            if (!mapNote) {
                //If there isn't a Map Note on any scene, prompt to create one in the center of the view
                //and then prompt to rerun the Run QE
                EncounterNote.noMapNoteDialog(this, event, options);
                return;
            }
            //1.1.5f: Fix deprecation warning in Foundry v10+
            this.sourceNoteData = mapNote?.document;
        }

        //v0.6.13 If sourceNote != originalNote, then translate the savedTokens
        //0.7.1 Move shift calculation here (from combineTokenData) so it can be passed to both combineTokenData() and createTiles()
        let shift = { x: 0, y: 0 };
        if ((this.sourceNoteData && this.originalNoteData) && (this.sourceNoteData._id !== this.originalNoteData._id)) {
            shift = {
                x: (this.sourceNoteData.x - this.originalNoteData.x),
                y: (this.sourceNoteData.y - this.originalNoteData.y)
            }
        }

        //Activate the Token layer and generate Actors and all tokens, and combine with saved tokens
        canvas.tokens.activate();

        //1.1.1 If we have rollTables, then roll them to generate additional extractedActors which we add temporarily 
        // (but only to extractedActors not to the property)
        //1.1.2c Issue #121: Check for rollTables
        if (rollTables) {
            for (const rollTable of rollTables) {
                const rollTableObject = game.tables.get(rollTable.rollTableId);
                if (rollTableObject) {
                    const { roll, results } = await rollTableObject.draw({ displayChat: false });
                    for (const tableResult of results) {
                        if (tableResult?.documentCollection === ACTOR) {
                            extractedActors.push({
                                numActors: rollTable.numActors,
                                dataPackName: null,        //only non-null if this were a compendium reference
                                actorID: tableResult.documentId,
                                name: tableResult.text
                            });
                        }
                    }
                }
            }
        }

        //0.6.1: createTokenDataFromActors() sets isSavedToken=false
        //0.6.8: Don't return extractedActorTokenData; add it (as generatedTokensData) to the extractedActors
        //v0.6.13 Use this.sourceNote instead of coords
        await this.generateFullExtractedActorTokenData();
        //0.6.8: combineTokenData now puts the combined generated and saved tokens in combinedTokensData on each eActor
        //0.6.13 Compare this.sourceNote with this.originalNote to see if we should translate savedTokens
        this.combineTokenData(shift);

        //Now create the Tokens
        //v0.6.1 If you used Alt-[Run] then pass that
        //v0.6.8 Make createTokens an instance method because it reference extractedActors
        const tokenOptions = {
            alt: event?.altKey,
            ctrl: event?.ctrlKey
        }
        //0.9.3d: encounterTokens is both created tokens and existing tokens left and not deleted (1.2.0d: including possibly player tokens )
        const encounterTokens = await this.createTokens(tokenOptions);

        //And add them to the Combat Tracker (wait 200ms for drawing to finish)
        setTimeout(() => {
            QuickEncounter.createCombat(encounterTokens);
        }, 200);

        if (savedTilesData) {
            //1.1.5c Switch back to single activation of Tiles layer
                canvas.tiles.activate();
                await this.createTiles(savedTilesData, shift, options);
            //0.7.3 Switch back to Basic Controls
            canvas.tokens.activate();
        }
    }

    async findMapNoteForJE(journalEntry) {
        if (!journalEntry) { return; }
        //0.6.13 If we have clickedNote specified we know we're in the right scene (the QE was opened by double-clicking the Map Note, rather than from the JE)
        //1.1.5e: Simplify
        if (journalEntry.clickedNote) { return journalEntry.clickedNote; }

        //Otherwise get the correct scene (which might not be the one we're in)
        // Switch to the correct scene if confirmed
        let qeScene = EncounterNote.getEncounterScene(journalEntry);
        //1.1.5e: Removed the creation of a new Map Note here, because we want to check whether the parent has it

        const isPlaced = await EncounterNote.mapNoteIsPlaced(qeScene, journalEntry);
        if (!isPlaced) { return; }
        //Something is desperately wrong if this is null
        return journalEntry.sceneNote;
    }

    combineTokenData(shift = { x: 0, y: 0 }) {
        //v0.5.1 If we have more actors than saved tokens, create more tokens
        //If we have fewer actors than saved tokens, skip some

        //v0.5.0 We will want to re-create tokens that have been saved but otherwise create them from Actors
        //So set a frozen flag on each saved token that doesn't allow further changes (so that saved tokens don't get re-rolled)
        //Setting directly rather than using setFlag because we don't need this saved between sessions
        //v0.5.1 Create both from the embedded Actors and any saved Tokens and then attempt to reconcile
        //First cut: If you have more actors than saved tokens of that actor (including none), then generate
        //If we have no savedTokens, do none of this checking
        //v0.6.1: savedTokensData is stored with each actor
        //v0.6.8: generatedTokensData and the resulting combinedTokensData is now also stored with each actor

        if (this.extractedActors?.length) {
            for (const [indexExtractedActor, ea] of this.extractedActors.entries()) {
                let combinedTokensData = [];
                //generatedTokensData is as many generated tokens as there are numActors; override them with real savedTokens
                if (ea.savedTokensData) {
                    let shiftedTokensData = ea.savedTokensData.map(std => {
                        std.x += shift.x;
                        std.y += shift.y;
                        const matchingToken = game.scenes.viewed.tokens.get(std._id); // returns undefined if not found
                        std.tokenExistsOnScene = (matchingToken !== undefined);
                        return std;
                    });
                    const numExcessActors = ea.generatedTokensData.length - shiftedTokensData.length;
                    if (numExcessActors >= 0) {
                        //if excessActors > 0 take all of the saved tokens and then as many as necessary from the extracted Actor tokens
                        combinedTokensData = shiftedTokensData.concat(ea.generatedTokensData.slice(0, numExcessActors));
                    } else if (numExcessActors < 0) {
                        //Take all possible saved tokens up to the number - if it's a dice roll, we rely on it being the max possible
                        combinedTokensData = shiftedTokensData.slice(0, ea.generatedTokensData.length);
                    }
                } else {
                    //No saved tokens - just use the Actor data
                    combinedTokensData = ea.generatedTokensData;
                }
                this.extractedActors[indexExtractedActor].combinedTokensData = combinedTokensData;
            }
        }
    }




    static async getNumActors(extractedActor, options = {}) {
        //Get the number of actors including rolling if options.rollRandom=true
        let multiplier = extractedActor.numActors;
        //If numActors didn't/doesn't convert then just create 1 token
        let numActors = 1;

        if (multiplier) {
            if (typeof multiplier === "number") {
                numActors = multiplier;
            } else if ((typeof multiplier === "string") && Roll.validate(multiplier)) {
                //v0.6.4: if options.rollType="full", then roll randomly; if ="template" then compute max
                //v0.6: Pass the multiplier to the roll formula, which allows for a digit or a formula
                let r = new Roll(multiplier);
                if (options?.rollType === "full") {
                    //1.2.3c: Change to await call because of effects of Roll() now having to be called async
                    await r.evaluate();
                } else {//template or other
                    //1.2.3c: Change to await call because of effects of Roll() now having to be called async
                    await r.evaluate({ minimize: false, maximize: true });
                }
                numActors = r.total ? r.total : 1;
            }
        }

        return numActors;
    }


    static async getActor(eActor) {
        //Could be from Actors or Compendium
        //v0.6 Need to check whether this is a direct Actor reference or from a Compendium
        let actor = null;
        if (eActor.dataPackName) {
            // if an actor with this name has already been imported, use it
            actor = game.actors.getName(eActor.name);
            // couldn't find actor, get compendium and import
            if (!actor) {
                const actorPack = game.packs.get(eActor.dataPackName);
                if (!actorPack) { return null; }
                //Import this actor because otherwise you won't be able to see character sheet etc.
                //1.1.0e: In Foundry v10 may need to strip off prepended Compendium name
                const strippedActorId = (eActor.actorID).split(".").pop();
                actor = await game.actors.importFromCompendium(actorPack, strippedActorId, {}, { renderSheet: false });
            }
        } else {
            actor = game.actors.get(eActor.actorID);
        }
        return actor;
    }


    async generateTemplateExtractedActorTokenData() {
        //0.6.1d: Create a template array so we can tell how many saved vs. generated tokens we will have at display time
        //(without actually extracting Actor/Compendium data every time)
        if (!this.extractedActors?.length) { return; }
        for (let [iExtractedActor, eActor] of this.extractedActors.entries()) {
            this.extractedActors[iExtractedActor].generatedTokensData = [];  //clear this every time
            //v0.6.4: For random rolls, need the max number returned here
            //1.2.3c: Change to await call because of effects of Roll() now having to be called async
            const numActors = await QuickEncounter.getNumActors(eActor, { rollType: "template" });
            //FIXME: Probably a more efficient way to fill an array 0..numActors-1            
            for (let iToken = 0; iToken < numActors; iToken++) {
                //0.6.8: Put the generatedTokensData on the extractedActor, just like the savedTokensData
                this.extractedActors[iExtractedActor].generatedTokensData.push({ actorId: eActor.actorID, isSavedToken: false });
            }
        }
    }

    async generateFullExtractedActorTokenData() {
        //v0.6.13: sourceNote is either the Scene Note we double-clicked, or the first one we find (if started from the Journal Entry)
        const coords = { x: this.sourceNoteData?.x, y: this.sourceNoteData?.y }

        if (!this.extractedActors?.length || !coords) { return; }
        const gridSize = canvas.dimensions.size;

        for (let [iExtractedActor, eActor] of this.extractedActors.entries()) {
            this.extractedActors[iExtractedActor].generatedTokensData = [];  //clear this every time
            const actor = await QuickEncounter.getActor(eActor);
            if (!actor) { continue; }     //possibly will happen with Compendium
            //FIXME: May have to update extractedActor with the imported actorId and then hopefully it won't re-import - see Issue #66
            //1.2.3c: Change to await call because of effects of Roll() now having to be called async
            const numActors = await QuickEncounter.getNumActors(eActor, { rollType: "full" });

            for (let iToken = 0; iToken < numActors; iToken++) {
                //Slightly vary the (x,y) coords so we don't pile all the tokens on top of each other and make them hard to find
                //1.1.5e: Round the coordinates to integers (because otherwise we get a Model validation error)
                let tokenData = {
                    name: eActor.name,
                    x: coords.x + Math.round((Math.random() * 2 * gridSize) - gridSize), //adjust position within +/- full grid increment,
                    y: coords.y + Math.round((Math.random() * 2 * gridSize) - gridSize), //adjust position within +/- full grid increment,
                    hidden: true
                }
                //Use the prototype token from the Actors
                let tempToken;
                    //0.8.0d: Use new TokenDocument constructor; does it handle token wildcarding? [probably didn't]
                    //0.8.2a: Per foundry.js#40276 use Actor.getTokenData (does handle token wildcarding)
                    //1.0.4b: Per https://github.com/foundryvtt/foundryvtt/issues/7766, getTokenData now returns a TokenDocument directly
                    let tempTokenData;
                    
                        //1.0.3b: .data is now merged into the object itself, so we have to strip off the prototype information 
                        //1.0.4b: And tempTokenData is actually a TokenDocument itself
                        tempTokenData = await actor.getTokenDocument(tokenData);
                        /* removed for 1.1.3
                        tokenData = tempTokenData;
                        Object.setPrototypeOf(tokenData, {});
                        */
                        //v1.1.3 Issue #125 re alpha of generated tokens (previously was getting an actual TokenDocument with the wrong base alpha)
                        tokenData = tempTokenData.toObject();
                    

                //If from a Compendium, we remember that and the original Compendium actorID
                if (eActor.dataPackName) { tokenData.compendiumActorId = eActor.actorID; }
                //0.6.8: Put the generatedTokensData on the extractedActor, just like the savedTokensData
                tokenData.isSavedToken = false; //0.8.2a: Moved here
                this.extractedActors[iExtractedActor].generatedTokensData.push(tokenData);
            }
        }
    }

    async createTokens(options) {
        if (!this.extractedActors?.length) { return; }

        //Have to also control tokens in order to add them to the combat tracker
        /* The normal token workflow (see TokenLayer._onDropActorData) includes:
        1. Get actor data from Compendium if that's what you used (this is probably worth doing)
        2. Positioning the token relative to the drop point (whereas we do it relative to a Map Note or previous position)
        3. Randomizing the token image if that is provided in the Prototype Token
        */

        let allCombinedTokensData = [];
        const showAddToCombatTrackerCheckbox = game.settings.get(MODULE_ID, "showAddToCombatTrackerCheckbox");
        for (const ea of this.extractedActors) {
            //0.9.3: FIX: Better way would be to keep the ExtractedActor structure all the way through to token creation and add to CT
            //but that would require a lot of changes
            //If showAddToCombatTrackerCheckbox === FALSE, then default addToCombatTracker to TRUE
            const addTokenToCombatTracker = showAddToCombatTrackerCheckbox ? ea.addToCombatTracker : true;
            for (const ctd of ea.combinedTokensData) {
                ctd.addToCombatTracker = addTokenToCombatTracker;
            }
            allCombinedTokensData = allCombinedTokensData.concat(ea.combinedTokensData);
        }

        //v0.5.0 Clone the token data so if the token is "frozen" change from TokenMold (for example) can be recovered
        //Also, use the ability of Token.create to handle an array
        //Annoyingly, Token.create returns a single token if you passed in a single element array
        //v0.8.2c: Pass options to force hidden/visible
        //0.6.1: If you use Alt-Run then create all tokens hidden regardless of how they were saved; Ctrl-Run make them visible
        //(generated tokens are hidden by default; saved tokens retain their original visibility unless overridden)
        let isHidden = null;
        if (options?.ctrl) { isHidden = false; }
        if (options?.alt) { isHidden = true; }
        if (isHidden !== null) {
            for (const ctd of allCombinedTokensData) { ctd.hidden = isHidden; }
        }
        //0.8.3c: Use duplicate here because allCombinedTokensData is a simple Object
        //0.9.0e: If the exact token is already on the scene (because we used the Leave option) then don't regenerate it
        //but in that case add the existing token to the existingTokens list
        let toCreateCombinedTokensData = [];
        let existingTokens = [];
        for (const ctd of allCombinedTokensData) {
            //if the exact-match token (by token._id) already exists on the Scene then don't recreate it
            const matchingToken = game.scenes.viewed.tokens.get(ctd._id);
            if (matchingToken) {
                //0.9.3d Remember if we should/shouldn't add to Combat Tracker
                matchingToken.addToCombatTracker = ctd.addToCombatTracker;
                existingTokens.push(matchingToken);
            } else {
                toCreateCombinedTokensData.push(foundry.utils.duplicate(ctd));
            }
        }

        //We do need to check that toCreateCombinedTokensData is not empty (if everything is already on the Scene)
        const origCombinedTokensData = foundry.utils.duplicate(toCreateCombinedTokensData);
        let tempCreatedTokens;

        //0.9.3f: Fix 0.8.0 deprecation warning: call canvas.scene.createEmbeddedDocuments() instead of Token.create()
            tempCreatedTokens = toCreateCombinedTokensData.length ? await canvas.scene.createEmbeddedDocuments("Token", toCreateCombinedTokensData) : [];
    

        //And Token.create unfortunately returns an element, not an array if you pass a length=1 array
        let encounterTokens;
        if (tempCreatedTokens.length === 0) {
            encounterTokens = []; //No tokens were created (perhaps because they all exist on the scene)
        } else {
            encounterTokens = Array.isArray(tempCreatedTokens) ? tempCreatedTokens : [tempCreatedTokens];
        }



        //0.9.0 Move if (freezeCapturedTokens) outside the loop
        //0.9.3 Move it back in because we're using the loop to remember addToCombatTracker also
        //v0.6.1d: If it's a savedToken (one that was "captured" then check if it should be frozen as is or regenerated for example by Token Mold)
        //Actor-generated tokens are always generated
        //v0.5.3d: Check the value of setting "freezeCapturedTokens"
        const freezeCapturedTokens = game.settings.get(MODULE_ID, "freezeCapturedTokens");
        for (let i = 0; i < toCreateCombinedTokensData.length; i++) {
            //v0.5.0: Now reset the token data in case it was adjusted (e.g. by Token Mold), just for those that are frozen
            //v0.6.1d: If freezeCapturedTokens = true, then reset the savedTokens
            if (freezeCapturedTokens && toCreateCombinedTokensData[i].isSavedToken) {
                //Ignore errors that happen during this update
                try {
                    //0.9.1b: Update back to the original data (in case it was changed by TokenMold or other)
                    //1.0.5b: If there are no updates then update() returns the (empty) list of changes leaving createdTokens[i] undefined
                    await encounterTokens[i].update(origCombinedTokensData[i]);
                } catch { }
            }
            //0.9.3d Remember if we should/shouldn't add to Combat Tracker
            //FIX: This doesn't handle if any of the token creations fail - to do that we would have to handle token creation individually
            encounterTokens[i].addToCombatTracker = origCombinedTokensData[i].addToCombatTracker;
        }

        //0.9.3d Fixed: We can't add the existing tokens until we've taken care of the reset against origCombinedTokensData[] (=toCreateCombinedTokensData[])
        //0.9.0e: Add back the QE tokens already on the scene
        encounterTokens = encounterTokens.concat(existingTokens);

        //1.2.0d: See if we are meant to add Player tokens; doing in createTokens() here because of the (future) possibility we might create player tokens
        const addPlayerTokensToCT = game.settings.get(MODULE_ID, "addPlayerTokensToCT");
        if (["inScene", "loggedIn"].includes(addPlayerTokensToCT)) {
            //Get scene tokens (documents) that are associated with players
            let playerTokens = canvas.tokens.placeables.filter(t => t.actor?.hasPlayerOwner === true).map(t => {
                const tokenDocument = t.document;
                tokenDocument.addToCombatTracker = true;    //have to set this because non-player tokens can be selectively added
                return tokenDocument;
            });
            if ("loggedIn" === addPlayerTokensToCT) {
                //To filter the playerTokens for only those logged-in:
                //Get the list of "active users": game.users.filter(u => u.active === true); also filter out the GM-user
                //1.2.1c: Thanks to "DrMcCoy"; Look at playerTokens.filter(pt => pt.actor) and see which actors match the user.character (primary assigned character)
                const activeUsers = game.users.filter(u => (u.active === true) && (u.role <= CONST.USER_ROLES.TRUSTED));
                playerTokens = playerTokens.filter(pt => {
                    for (const user of activeUsers) {
                        if (user.character === pt.actor) { return true; }
                    }
                    return false;
                });
            }
            encounterTokens = encounterTokens.concat(playerTokens);
        }

        return encounterTokens;
    }//end async createTokens()

    async createTiles(savedTilesData, shift = { x: 0, y: 0 }, options = null) {
        if (!savedTilesData?.length) { return; }
        //0.7.1: Translate tiles if appropriate (copy/pasted the Map Note)
        let shiftedTilesData = savedTilesData.map(std => {
            std.x += shift.x;
            std.y += shift.y;
            return std;
        });

        //0.6.1/0.7.1: If you use Alt-Run then create all tiles hidden regardless of how they were saved; Ctrl-Run make them visible
        //saved tiles retain their original visibility unless overridden
        for (let i = 0; i < shiftedTilesData.length; i++) {
            if (options?.ctrl) { shiftedTilesData[i].hidden = false; }
            if (options?.alt) { shiftedTilesData[i].hidden = true; }
        }
        //0.9.9a: Tile.create() has been deprecated - must have reverted to this code from somewhere else
        let createdTiles;
            createdTiles = shiftedTilesData.length ? await canvas.scene.createEmbeddedDocuments("Tile", shiftedTilesData) : [];
        

        return createdTiles;
    }

    static async createCombat(encounterTokens) {
        if (!encounterTokens || !encounterTokens.length) { return; }
        const tabApp = ui.combat;

            //In v12, don't control tokens and toggle combat state - just use createCombatant()
            //Modeled after Foundry v12 deprecated toggleCombat
            TokenDocument.implementation.createCombatants(encounterTokens.filter(t => t.addToCombatTracker));

        

        //Pop-open the floating combat tracker
        //0.6: Moved after toggling combat in case that actually creates the combat entity
        tabApp.renderPopout(tabApp);

    }

    static async onDeleteCombat(combat, options, userId) {
        if (!combat || !game.user.isGM) { return; }

        //v0.9.0c: This has always been hostile NPCs
        //Get list of hostile NPCs
        let hostileNPCCombatants;
        let defeatedHostileNPCCombatants;
        //1.1.1 Check for Foundry 10
            hostileNPCCombatants = combat.turns?.filter(t => ((t.token?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE) && (!t.actor || !t.players?.length)));
            defeatedHostileNPCCombatants = combat.turns?.filter(t => (t.defeated &&
                (t.token?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE) && (!t.actor || !t.players?.length)));
        

        //And of player-owned tokens
        const pcTokens = combat.turns?.filter(t => (t.actor && t.players?.length));

        //If the "Display XP" option is set, work out how many defeated foes and how many Player tokens
        //v0.9.0: Moved to displayXP
        //Only works with 5e - the setting is only displayed if that's true
        const shouldDisplayXPAfterCombat = game.settings.get(MODULE_ID, "displayXPAfterCombat");
        if (shouldDisplayXPAfterCombat) { await QuickEncounter.displayXP(hostileNPCCombatants, pcTokens); }

        //If the "Delete Tokens after Combat" option is set, ask with a two option dialog
        const showDeleteTokensDialogAfterCombat = game.settings.get(MODULE_ID, "showDeleteTokensDialogAfterCombat");
        if (showDeleteTokensDialogAfterCombat) { await QuickEncounter.deleteTokensAfterCombatDialog(hostileNPCCombatants, defeatedHostileNPCCombatants); }

    }

    static async displayXP(hostileNPCCombatants, pcTokens) {
        //Now compute total XP and XP per player
        if (!hostileNPCCombatants || !hostileNPCCombatants.length || !pcTokens) { return; }
        const totalXP = QuickEncounter.computeTotalXPFromTokens(hostileNPCCombatants);
        if (!totalXP) { return; }
        const xpPerPlayer = pcTokens.length ? Math.round(totalXP / pcTokens.length) : null;
        let content = game.i18n.localize("QE.XPtoAward.TOTAL") + totalXP;
        if (xpPerPlayer) { content += (game.i18n.localize("QE.XPtoAward.PERPLAYER") + xpPerPlayer); }

        EncounterNote.dialogPrompt({
            title: game.i18n.localize("QE.XPtoAward.TITLE"),
            content: content,
            label: "",
            callback: () => { console.log(`XP to award ${content}`); },
            options: {
                top: window.innerHeight - 350,
                left: window.innerWidth - 720,
                width: 400,
                jQuery: false
            }
        });
    }

    static async deleteTokensAfterCombatDialog(hostileNPCCombatants, defeatedHostileNPCCombatants) {
        Dialog3.buttons3({
            title: game.i18n.localize("QE.DeleteTokensAfterCombat.TITLE"),
            content: game.i18n.localize("QE.DeleteTokensAfterCombat.CONTENT"),
            button1cb: () => {//All
                //in QE v0.9.x we're only supporting Foundry 0.8.+
                const tokensToDeleteIds = hostileNPCCombatants.map(ct => { return ct.token.id });
                canvas.scene.deleteEmbeddedDocuments("Token", tokensToDeleteIds);
            },
            button2cb: () => {//Defeated Only
                //in QE v0.9.x we're only supporting Foundry 0.8.+
                const tokensToDeleteIds = defeatedHostileNPCCombatants.map(ct => { return ct.token.id });
                canvas.scene.deleteEmbeddedDocuments("Token", tokensToDeleteIds);
            },
            button3cb: null,
            buttonLabels: ["QE.DeleteTokensAfterCombat.DELETEALL", "QE.DeleteTokensAfterCombat.DELETEDEFEATED"]
        });
    }


    static getActorXP(actor) {
        if ((game.system.id !== "dnd5e") || !actor) { return null; }
        try {
                return actor.system?.details?.xp?.value;
            
        } catch (err) {
            return null;
        }
    }

    static computeTotalXPFromTokens(tokens) {
        if ((game.system.id !== "dnd5e") || !tokens) { return; }
        let totalXP = null;
        for (const token of tokens) {
            totalXP += QuickEncounter.getActorXP(token.actor);
        }
        return totalXP;
    }

    computeTotalXP() {
        //Compute total XP from non-character, fixed-number (non-die-roll) extracted actors
        //The final XP depends on who was non-friendly, computed from what tokens you pass to computeTotalXPFromTokens
        const extractedActors = this.extractedActors;
        let totalXP = null;
        if (extractedActors?.length) {
            for (const eActor of extractedActors) {
                const actor = game.actors.get(eActor.actorID);
                const actorXP = QuickEncounter.getActorXP(actor);
                //Only include non-character tokens in XP
                if (actorXP && ((actor.type === "npc") || (actor.data.type === "npc"))) {
                    if (!totalXP) { totalXP = 0; }
                    //Allow for numActors being a roll (e.g. [[/r 1d4]]) in which case we ignore the XP
                    //although we probably should provide a range or average
                    if (typeof eActor.numActors === "number") {
                        totalXP += eActor.numActors * actorXP;
                    }
                }
            }
        }
        return totalXP;
    }

    renderTotalXPLine() {
        const totalXP = this.computeTotalXP();
        if (!totalXP) { return null; }
        return `${game.i18n.localize("QE.TotalXP.CONTENT")} ${totalXP}XP<br>`;
    }

    /* Hook on JournalSheet Header buttons */
    static async getJournalSheetHeaderButtons(journalSheet, buttons) {
        //0.7.3: Add a Show QE button if this JE has a Quick Encounter and showQEAutomatically is false OR the QE has been hidden
        const quickEncounter = QuickEncounter.extractQuickEncounter(journalSheet);
        console.log("hook works");
        console.log(!game.settings.get(MODULE_ID, "showQEAutomatically"));
        console.log(quickEncounter?.hideQE);
        //1.1.0b: Issue #108 (https://github.com/spetzel2020/quick-encounters/issues/108) - hack solution to always show the Show button in Foundry 10
        const displayShowQEButton = !game.settings.get(MODULE_ID, "showQEAutomatically") || quickEncounter?.hideQE;
        //If this is an inferred QE (from the presence of Actors), quickEncounter=null because the the journalSheet HTML hasn't been built yet
        if (displayShowQEButton) {
            console.log("displayShowQEButton");
            buttons.unshift({
                label: "QE.JEBorder.ShowQE",
                class: "showQE",
                //1.1.3c Issue 105: Replace raised-fist with crossed-swords to be consistent with CT
                icon: "fas fa-swords",
                onclick: async ev => {
                    // 1.1.0b: If Foundry v10 then show all QEs 
                        for (let journalEntryPageId of journalSheet.object?.pages?.keys()) {
                            const journalPageSheet = journalSheet.getPageSheet(journalEntryPageId);
                            //Also reset the hide toggle (because otherwise this will never show automatically)
                            const qe2 = QuickEncounter.extractQuickEncounter(journalPageSheet);
                            if (qe2 && journalPageSheet?.qeDialog) {
                                qe2.hideQE = null;
                                qe2.serializeIntoJournalEntry();
                                journalPageSheet.qeDialog.render(true);
                            }
                        }
                }
            });
        }
    }

    // Hook on renderJournalPageSheet for Foundry v10 multi-page Journals
    static async onRenderJournalPageSheet(journalPageSheet, html) {
        //Should never get into onRenderJournalPageSheet unless v10 but test anyway
        //1.0.5g: Suppress this hook if this an editor window (because that duplicates the QE, and incorrectly)
        if (!game.user.isGM || journalPageSheet?.isEditable) { return; }
        /* 1.0.4e: To handle new (Foundry v10) and pre-multi-page Journals we check:
            1. Is there an embedded Quick Encounter in the Journal Page Sheet
            2. Is there an embedded Quick Encounter in the parent Journal Sheet
            3. Is there a Quick Encounter which can be generated from the embedded Actors in the Page
            4. (Not in this hook, but for Foundry <=v9) Extract QE from embedded Actors in the Journal Sheet
        */
        //Option 1: Is there embedded Quick Encounter in the Journal Page Sheet?
        //FIX: Would prefer to use DOM Selector here, but we're already using JQuery
        const journalEntryPage = journalPageSheet?.object;
        let quickEncounter = QuickEncounter.deserializeFromJournalEntry(journalEntryPage);

        if (!quickEncounter) {
            //Option 2: Is there an embedded Quick Encounter in the parent Journal Sheet?
            //(This won't return one with isMigratedToV10 set)
            const journalEntry = journalPageSheet?.object?.parent;
            quickEncounter = QuickEncounter.deserializeFromJournalEntry(journalEntry);

            if (quickEncounter) {
                //v1.0.5c: On-demand migration: If this is JournalPage0 (the default one created from pre-v10), then associate this QE with it
                const journalEntryPage0 = journalEntry.pages?.values()?.next()?.value;
                if (journalEntryPage === journalEntryPage0) {
                    quickEncounter.serializeIntoJournalEntry(journalEntryPage0);
                    //1.0.5f: Set isMigratedToV10 on the original JE-level QE so that it won't be read again in Foundry v10
                    quickEncounter.isMigratedToV10 = true;
                    quickEncounter.serializeIntoJournalEntry(journalEntry);
                    delete quickEncounter.isMigratedToV10;  //Don't want to filter out QEs from JournalEntryPages
                } else {
                    //If this isn't page0, then ignore the QE associated with the JE (this allows us to pick QEs generated from embedded actors)
                    quickEncounter = null;
                }
            }
        }

        if (!quickEncounter) {
            //Option 3: Extract a Quick Encounter from embedded Actors
            const header = html[0];
            const parentElement = $(header.parentElement);
            quickEncounter = QuickEncounter.extractQuickEncounterFromEmbedded(journalEntryPage, parentElement);
        }

        //Build and show the QE Dialog and add to the displayed Journal Entry
        if (quickEncounter) {
            quickEncounter.displayQEDialog(journalPageSheet, html);
        }

    }

    displayQEDialog(journalSheet, html) {
        const qeJournalEntry = journalSheet.object;
        //0.6.13: If we opened this from a Scene Note, then remember that (because you could move off to another Note)
        //But once the Journal Entry is open we don't reset it, even if subsequently we re-render (e.g. adding another Actor)
        //Allows for .entry to be null (if you deleted the Note by itself)
        if (!qeJournalEntry.clickedNote && (QuickEncounter.hoveredNote?.entry?.id === journalSheet.object.id)) {
            qeJournalEntry.clickedNote = QuickEncounter.hoveredNote;
        }
        //0.6.13: If originalNoteData is not set (pre-0.6.13) then we may be able to recover it from a saved Token
        if (this.checkAndFixOriginalNoteData(qeJournalEntry.clickedNote)) {
            this.serializeIntoJournalEntry();
        }
        const totalXPLine = this.renderTotalXPLine();

        //If there's no Map Note, include a warning
        let noMapNoteWarning = null;
        const qeScene = EncounterNote.getEncounterScene(qeJournalEntry);
        if (!qeScene) {
            noMapNoteWarning = `${game.i18n.localize("QE.AddToCombatTracker.NoMapNote")}`;
        }

        //v0.6.1: Also pop open a companion dialog with details about what tokens have been placed and XP
        //0.7.0 Remove option to not use the QE Dialog
        //v0.6.10: First attempt to reuse the existing QE dialog (not using app.id)
        let qeDialog = journalSheet.qeDialog;
        if (qeDialog) {
            qeDialog.update(this);    //have to update since we extract a new one each time
        } else {
            //0.8.0: If this is being viewed out of a Compendium, present a different read-only Quick Encounter Dialog with instructions
            //0.8.0d: Relax the null test for qeJournalEntry.compendium
            //1.0.4j: Pass qeJournalEntry so we don't need the journalEntryId to do a QuickEncounter.remove()
            qeDialog = new QESheet(this, { qeJournalEntry: qeJournalEntry, title: journalSheet.title, isFromCompendium: qeJournalEntry.compendium });
            journalSheet.qeDialog = qeDialog;
        }

        //0.7.3 OPen the QE automatically (default) in general unless you have hidden it
        let showQEDialog = game.settings.get(MODULE_ID, "showQEAutomatically");

        if (showQEDialog || qeJournalEntry?.showQEOnce) {
            delete qeJournalEntry.showQEOnce;
            qeDialog.render(true);
        }

        const qeJournalEntryIntro = noMapNoteWarning;
        //qeJournalEntryIntro = await renderTemplate('modules/quick-encounters/templates/qeJournalEntryIntro.html', {totalXPLine, noMapNoteWarning});

        html.find('.editor-content').prepend(qeJournalEntryIntro);
        //If there's an embedded button, then add a listener
        html.find('button[name="addToCombatTracker"]').click(event => {
            this.run(event);
        });
    }


}

export class Dialog3 extends Dialog {
    //1.0.2: Pass the event through to the button callback
    static async buttons3({ title, content, button1cb, button2cb, button3cb, buttonLabels, options = {} }) {
        //Also can function as a generic 2-button dialog by passing button3b=null
        return new Promise((resolve, reject) => {
            const dialog = new this({
                title: title,
                content: content,
                buttons: {
                    button1: {
                        icon: null,
                        label: game.i18n.localize(buttonLabels[0]),
                        callback: (html, event = null) => {
                            const result = button1cb ? button1cb(html, event) : true;
                            resolve(result);
                        }
                    },
                    button2: {
                        icon: null,
                        label: game.i18n.localize(buttonLabels[1]),
                        callback: (html, event = null) => {
                            const result = button2cb ? button2cb(html, event) : false;
                            resolve(result);
                        }
                    },
                    button3: {
                        icon: null,
                        label: game.i18n.localize(buttonLabels[2]),
                        callback: (html, event = null) => {
                            const result = button3cb ? button3cb(html, event) : false;
                            resolve(result);
                        }
                    }
                },
                default: "button1",
                close: () => reject
            }, options);

            if (!button3cb) {
                delete dialog.data.buttons.button3;
            }
            dialog.render(true);
        });
    }

    //1.0.2: Override the click and submit so we can pass the event (and eventually determine if Ctrl- or Alt- were used)
    //override
    _onClickButton(event) {
        const id = event.currentTarget.dataset.button;
        const button = this.data.buttons[id];
        this.submit(button, event);
    }
    //override
    submit(button, event = null) {
        try {
            if (button.callback) button.callback(this.options.jQuery ? this.element : this.element[0], event);
            this.close();
        } catch (err) {
            ui.notifications.error(err);
            throw new Error(err);
        }
    }
}