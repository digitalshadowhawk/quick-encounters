import { QuickEncounter } from './QuickEncounter.js'

export class AddToEncounter extends foundry.applications.api.DialogV2 { 
    constructor(event, openQuickEncounter, controlledAssets) {
    super({
      title: game.i18n.localize("QE.AddToQuickEncounter.TITLE"),
      content: game.i18n.localize("QE.AddToQuickEncounter.CONTENT"),
      buttons: {
        run: {
          label: "QE.AddToQuickEncounter.RUN",
          callback: () => openQuickEncounter.run(event)//console.log("Run!"),
        },
        add: {
          label: "QE.AddToQuickEncounter.ADD",
          callback: () => openQuickEncounter.add(controlledAssets) //console.log("Added!"),
        },
        create: {
          label: "QE.AddToQuickEncounter.CREATE",
          callback: () => QuickEncounter.createFrom(controlledAssets) //console.log("Created!"),
        }
      }
    });
  }
}

export class LinkToEncounter extends foundry.applications.api.DialogV2 {
    constructor(event, openJournalEntry, controlledAssets) {
    super({
      title: game.i18n.localize("QE.LinkToQuickEncounter.TITLE"),
      content: game.i18n.localize("QE.LinkToQuickEncounter.CONTENT"),
      buttons: {
        link: {
          label: "QE.LinkToQuickEncounter.LINK",
          callback: () => QuickEncounter.link(openJournalEntry, controlledAssets)//console.log("Linked!"),
        },
        create: {
          label: "QE.AddToQuickEncounter.CREATE",
          callback: () => QuickEncounter.createFrom(controlledAssets) //console.log("Created!"),
        }
      }
    });
  }
}