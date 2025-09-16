import {QuickEncounter} from './QuickEncounter.js';
import { MODULE_ID } from './constants.js';
import {dieRollReg} from './constants.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api


//export class QESheet extends FormApplication {
export class QESheet extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(quickEncounter, options = {}) {
        //1.0.4g: This call has always been wrong; was being called as super(options)
        super(quickEncounter, options); //sets this.object
        if (!game.user.isGM || !quickEncounter) {return;}

        game.users.apps.push(this)
    }

    /** @override */
//FIXME: Probably would be better to reference the Journal Entry this is for    
	get id() {
	    return `${MODULE_ID}-${this.appId}`;
    }

    /** @override */
    //1.0.4g: Override the title to the name of the JE Page (especially important when we are displaying in flow mode)
    get title() {
        return this.options?.title;
    }

    update(quickEncounter) {
        if (quickEncounter) this.object = quickEncounter;
    }

    ///** @override  */
    //WARNING: Do not add submitOnClose=true because that will create a submit loop
    //static get defaultOptions() {
    //    let mergedObject = foundry.utils.mergeObject(super.defaultOptions, {
    //            //no longer setting id here because it gives the same element all the time- override get id() so we can have multiple QE JEs open
    //            popOut : true
    //        });
    //    return mergedObject;
    //}

    static DEFAULT_OPTIONS = {
        tag: 'form',
        position: {
                width : 530,
                height : "auto"
        },
        form: {
            closeOnSubmit : false,
            submitOnClose : false
        },
        actions: {
            addToCombatTracker: this.#addToCombatTracker,
            qeRemoveActor: this.#qeRemoveActor,
            qeTileContainer: this.#qeRemoveTile,
            qeRolltableContainer: this.#qeRemoveRolltable,
            addTokensTiles: this.#addTokensTiles
        }
    }

    static PARTS = {
        form: {
            template : "modules/quick-encounters/templates/qe-sheet.html"
        }
    }


    /** @override */
    async _render(force, options={}) {
        return super._render(force, options);
    }

    /** @override */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        let closeButtonIndex = buttons.findIndex(button => button.label === "Close");
        // 1.1.0b: Don't have a Hide button in Foundry v10 and leave the button saying Close (as a replacement) - see Issue #108 for why
        return buttons;
    }

    /** @override 
    activateListeners(html) {
        super.activateListeners(html);
        if (!this.object?.isFromCompendium) {
            //html.find('button[name="addToCombatTracker"]').click(event => {
                // FIX: Need to submit the form first and then run; await this.submit({preventClose: true})
                //this.submit({preventClose: true}).then(this.object?.run(event));
            //});
            //0.7.0: Listeners for when you click "-" (minus)" in actor or tile
            html.find("#QEContainers .actor-container").each((i, thumbnail) => {
                //thumbnail.setAttribute("draggable", true);
                //thumbnail.addEventListener("dragstart", this._onDragStart, false);
                thumbnail.addEventListener("click", this._onClickActor.bind(this));
            });
            html.find("#QEContainers .tile-container").each((i, thumbnail) => {
                //thumbnail.setAttribute("draggable", true);
                //thumbnail.addEventListener("dragstart", this._onDragStart, false);
                thumbnail.addEventListener("click", this._onClickTile.bind(this));
            });
            html.find("#QEContainers .rolltable-container").each((i, thumbnail) => {
                thumbnail.addEventListener("click", this._onClickRollTable.bind(this));
            });
        }
        html.find('button[name="addTokensTiles"]').click(event => {
            this.submit({preventClose: true}).then(QuickEncounter.runAddOrCreate(event, this.object));
        });
    }*/


    /**
     * @this {QESheet}
     * @param {PointerEvent} event    The initiating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     */
    static async #addToCombatTracker(event, target) {
        this.submit({preventClose: true});
        await this.document?.run(event);
    }

    /**
     * @this {QESheet}
     * @param {PointerEvent} event    The initiating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     */
    static async #qeRemoveActor(event, target) {
        event.stopPropagation();

        const srcClass = target.classList.value;
        const isPortrait = srcClass === "actor-portrait";
        const isHoverIcon = (srcClass === "actor-subtract") || (srcClass === "fas fa-minus");
        if ((isPortrait) || (isHoverIcon)) {
            const rowNum = target.id;

            //Handle this by clearing the appropriate combatant field and re-rendering
            if ((rowNum >= 0) && (rowNum < this.combatants.length)) {
                this.combatants.splice(rowNum,1);
            }
            this._onChange();
        }
    }
    
    /**
     * @this {QESheet}
     * @param {PointerEvent} event    The initiating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     */
    static async #qeRemoveTile(event, target) {
        event.stopPropagation();

        const srcClass = target.classList.value;
        const isPortrait = srcClass === "actor-portrait";
        const isHoverIcon = (srcClass === "actor-subtract") || (srcClass === "fas fa-minus");
        if ((isPortrait) || (isHoverIcon)) {
            const rowNum = target.id;

            //Handle this by clearing the appropriate combatant field and re-rendering
            if ((rowNum >= 0) && (rowNum < this.object?.savedTilesData.length)) {
                this.object.savedTilesData.splice(rowNum,1);
            }
            this._onChange();
        }
    }

    /**
     * @this {QESheet}
     * @param {PointerEvent} event    The initiating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     */
    static async #qeRemoveRolltable(event, target) {
        event.stopPropagation();

        const srcClass = target.classList.value;
        const isPortrait = srcClass === "actor-portrait";
        const isHoverIcon = (srcClass === "actor-subtract") || (srcClass === "fas fa-minus");
        if ((isPortrait) || (isHoverIcon)) {
            const rowNum = target.id;

            //Handle this by clearing the appropriate combatant field and re-rendering
            if ((rowNum >= 0) && (rowNum < this.object?.rollTables.length)) {
                this.object.rollTables.splice(rowNum,1);
            }
            this._onChange();
        }
    }



    /**
     * @this {QESheet}
     * @param {PointerEvent} event    The initiating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     */
    static async #addTokensTiles(event, target) {
        this.submit({preventClose: true});
        QuickEncounter.runAddOrCreate(event, this.document)
    }

    /** @override */
    async _prepareContext(options) {
        //v0.6.10: Because the qeDialog is not (now) being re-created each time, instead we have to recompute combatants here
        await this.computeCombatantsForDisplay();

        //We don't have to store totalXPLine, but this.combatants needs to be referenced in _updateData()
        return {
           combatants: this.combatants,
           tilesData: this.object?.savedTilesData,
           rollTables: this.object?.rollTables,
           totalXPLine : this.totalXPLine,
           isFromCompendium : this.object?.isFromCompendium,    //FIX: This setting should be on a combatant basis, not one
           //0.9.3 Setting to show this checkbox (checked by default)
           showAddToCombatTrackerCheckbox : game.settings.get(MODULE_ID, "showAddToCombatTrackerCheckbox")
        };
    }

    async computeCombatantsForDisplay() {
        //This version of the Quick Encounter is what is extracted from in the Journal Entry
        //1.2.3c: Change to await call because of effects of Roll() now having to be called async
        await this.object.generateTemplateExtractedActorTokenData();     //this is just sparse array with the correct numbers
        this.object.combineTokenData();

        let combatants = [];
        if (this.object.extractedActors) {
            for (const [i,eActor] of this.object.extractedActors.entries()) {
                const combatant = {
                    rowNum : i,
                    numActors : eActor.numActors,
                    actorName: eActor.name,             //default
                    actorId: eActor.actorID,
                    //0.9.3d Add addToCombatTracker to structure (defaults to true and may not be shown)
                    addToCombatTracker: eActor.addToCombatTracker ?? true,
                    dataPackName : eActor.dataPackName, //non-null if a Compendium entry
                    tokens: eActor.combinedTokensData,
                    numType : typeof eActor.numActors
                }

                if (eActor.dataPackName) {   
                    //Compendium: for display just use the index (can only get name, id, index)
                    const pack = game.packs.get(eActor.dataPackName);
                    //0.8.0a: Block on getting the name and image information, fortunately from the index
                    //FIXME: Probably could be improved by getting all the indexes in one group so not doing this multiple times for the same index
                    const index = await pack.getIndex();
                    //1.1.0e: In Foundry v10 may need to strip off prepended Compendium name
                    const strippedActorId = (combatant.actorId).split(".").pop();
                    const entry = index.find(e => e._id === strippedActorId);
                    combatant.img = entry?.img || CONST.DEFAULT_TOKEN;
                    combatant.actorName = entry?.name;
                } else {      //regular actor
                    const actor = game.actors.get(eActor.actorID);
                    //0.4.1: 5e specific: find XP for this number of this actor
                    const xp = QuickEncounter.getActorXP(actor);
                    const xpString = xp ? `(${xp}XP each)`: "";
                    combatant.img = actor?.img;
                    combatant.actorName = actor?.name;
                    combatant.xp = xpString;
                }

                combatants.push(combatant);
            }
        }

        this.combatants = combatants;
        this.totalXPLine = this.object.renderTotalXPLine();
    }

    /** @override */
    async _updateObject(event, formData) {
        const checkIntReg = /^[0-9]*$/;   
        //Capture changes in the number of Actors or new Actors added (currently not possible through this dialog)
        let wasChanged = false;
        //0.9.3: Changed format of formData names to rowNum.fieldName
        for (let [rowFieldName, fieldValue] of Object.entries(formData)) {
            let fieldWasChanged = false;
            const elements = rowFieldName.split(".");
            if ((elements.length ?? 0) < 2) {continue;}   //ignore if the split doesn't work
            const rowNum = elements[0];
            const fieldName = elements[1];
            if (fieldName === "numRollTableActors") {//1.1.1 only used for RollTables
                const numActors = fieldValue.trim();   //trim off whitespace
                fieldWasChanged = (this.object?.rollTables[rowNum].numActors !== numActors);
                if (fieldWasChanged) {
                    //Validate that the change is ok
                    //Option 1: You cleared the field or spaced it out
                    if ((numActors === null) || (numActors === "")) {
                        this.object.rollTables[rowNum].numActors = 0;
                    } else if (Roll.validate(numActors)) {
                        //Option 2: This is a dice roll (not guaranteed because it could just contain a dieRoll)
                        this.object.rollTables[rowNum].numActors = numActors;
                    } else if (checkIntReg.test(numActors)) {
                        const multiplier = parseInt(numActors,10);
                        if (!Number.isNaN(multiplier)) {
                            this.object.rollTables[rowNum].numActors = multiplier;
                        }
                    } else {
                        //otherwise leave unchanged - should pop up a dialog or highlight the field in red
                        const warning = game.i18n.localize("QE.QuickEncounterDialog.InvalidNumActors.WARNING") + " " + numActors;
                        ui.notifications.warn(warning);
                    }
                }
            } else if (rowNum >= this.combatants.length) {
                //New combatant - not possible in the dialog yet, but will be with drag-and-drop
                fieldWasChanged = true;
            } else if (fieldName === "numActors") {//1.1.1 only used for Extracted Actors
                const numActors = fieldValue.trim();   //trim off whitespace
                fieldWasChanged = (this.combatants[rowNum].numActors !== numActors);
                if (fieldWasChanged) {
                    //Validate that the change is ok
                    //Option 1: You cleared the field or spaced it out
                    if ((numActors === null) || (numActors === "")) {
                        this.combatants[rowNum].numActors = 0;
                    } else if (Roll.validate(numActors)) {
                        //Option 2: This is a dice roll (not guaranteed because it could just contain a dieRoll)
                        this.combatants[rowNum].numActors = numActors;
                    } else if (checkIntReg.test(numActors)) {
                        const multiplier = parseInt(numActors,10);
                        if (!Number.isNaN(multiplier)) {
                             this.combatants[rowNum].numActors = multiplier;
                        }
                    } else {
                        //otherwise leave unchanged - should pop up a dialog or highlight the field in red
                        const warning = game.i18n.localize("QE.QuickEncounterDialog.InvalidNumActors.WARNING") + " " + numActors;
                        ui.notifications.warn(warning);
                    }
                }
            } else if (fieldName === "addToCombatTracker") {
                fieldWasChanged = (this.combatants[rowNum].addToCombatTracker !== fieldValue);
                this.combatants[rowNum].addToCombatTracker = fieldValue;
            }
            wasChanged = wasChanged || fieldWasChanged;
        }//end for over all formData entries

        //If wasChanged, then update the info into the Quick Encounter
        if (wasChanged) {
            this._onChange();
        }
//TODO: Capture tokens removed
    }

    //0.7.0 Split off changed check so that we can call it from the clicking the - on an Actor or Tile
    async _onChange() {
        //Reconstitute extractedActors and update it, removing those with numActors=0
        //Accept any non-numeric; blank has been replaced with 0
        const extractedActors = this.combatants.filter(c => (typeof c.numActors !== "number") || (c.numActors > 0)).map(c => {
            return {
                numActors : c.numActors,
                dataPackName : c.dataPackName, //if non-null then this is a Compendium reference
                actorID : c.actorId,           //If Compendium sometimes this is the reference
                name : c.actorName,
                addToCombatTracker : c.addToCombatTracker,  //remembered checked/cleared setting (will only display if overall setting shows the dialog box)
                savedTokensData : c.tokens.filter(td => td.isSavedToken)
            }
        });
        //0.6.1o: The saved tokens for a removed ExtractedActor will now be discarded also

        //1.1.1: Check for changes in RollTables
        //We updated directly above so the only additional check would be to remove entries if they are zeroed out


        //If we removed all the Actors and (0.7.0) all the Tiles and (1.1.1) all the RollTables, then remove the whole Quick Encounter
        if (extractedActors.length || this.object?.savedTilesData?.length || this.object?.rollTables?.length) {
            this.object?.update({extractedActors : extractedActors});
        } else {
            //1.0.4j: Pass qeJournalEntry so we don't have to look it up via ID
            this.object?.remove(this.options.qeJournalEntry);
            //And close this sheet
            this.close();
        }
    }

    /*_onClickActor(event) {
        event.stopPropagation();

        const srcClass = event.srcElement.classList.value;
        const isPortrait = srcClass === "actor-portrait";
        const isHoverIcon = (srcClass === "actor-subtract") || (srcClass === "fas fa-minus");
        if ((isPortrait) || (isHoverIcon)) {
            const rowNum = event.srcElement.id;

            //Handle this by clearing the appropriate combatant field and re-rendering
            if ((rowNum >= 0) && (rowNum < this.combatants.length)) {
                this.combatants.splice(rowNum,1);
            }
            this._onChange();
        }
    }
    _onClickTile(event) {
        event.stopPropagation();

        const srcClass = event.srcElement.classList.value;
        const isPortrait = srcClass === "actor-portrait";
        const isHoverIcon = (srcClass === "actor-subtract") || (srcClass === "fas fa-minus");
        if ((isPortrait) || (isHoverIcon)) {
            const rowNum = event.srcElement.id;

            //Handle this by clearing the appropriate combatant field and re-rendering
            if ((rowNum >= 0) && (rowNum < this.object?.savedTilesData.length)) {
                this.object.savedTilesData.splice(rowNum,1);
            }
            this._onChange();
        }
            
    }
    _onClickRollTable(event) {
        event.stopPropagation();

        const srcClass = event.srcElement.classList.value;
        const isPortrait = srcClass === "actor-portrait";
        const isHoverIcon = (srcClass === "actor-subtract") || (srcClass === "fas fa-minus");
        if ((isPortrait) || (isHoverIcon)) {
            const rowNum = event.srcElement.id;

            //Handle this by clearing the appropriate combatant field and re-rendering
            if ((rowNum >= 0) && (rowNum < this.object?.rollTables.length)) {
                this.object.rollTables.splice(rowNum,1);
            }
            this._onChange();
        }
            
    }*/

}//end class QESHeet


