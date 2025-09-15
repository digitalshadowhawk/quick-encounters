import { QuickEncounter } from "../QuickEncounter.js"

export function registerUIHooks() {
    const addTool = (toolsContainer, tool) => {
        try {
            if (!toolsContainer || !tool?.name) return;
            if (Array.isArray(toolsContainer)) toolsContainer.push(tool);
            else if (typeof toolsContainer === 'object') toolsContainer[tool.name] = tool;
        } catch (_) { }
    };


    Hooks.on('getSceneControlButtons', (controls) => {
        if (!game.user.isGM) return;
        try {
            const groups = Array.isArray(controls) ? controls : Object.values(controls || {});

            // === TOKEN TOOL ADDITIONS ===
            const tokens = groups.find((c) => c?.name === 'tokens' || c?.name === 'token');
            if (tokens) {
                addTool(tokens.tools, {
                    name: 'linkEncounter',
                    title: game.i18n.localize("QE.CreateQuickEncounter.BUTTON"),
                    icon: 'fas fa-swords',
                    toggle: false,
                    button: true,
                    visible: game.user.isGM,
                    onChange: event => QuickEncounter.runAddOrCreate(event)
                });
            } else {
                console.warn(
                    '[quick-encounter] Tokens tool not found. Control groups:',
                    groups.map((c) => c?.name),
                );
            }

            const tiles = groups.find((c) => c?.name === 'tiles' || c?.name === 'tile');
            if (tiles) {
                addTool(tiles.tools, {
                    name: 'linkEncounter',
                    title: game.i18n.localize("QE.CreateQuickEncounter.BUTTON"),
                    icon: 'fas fa-swords',
                    toggle: false,
                    button: true,
                    visible: game.user.isGM,
                    onChange: event => QuickEncounter.runAddOrCreate(event)
                });
            } else {
                console.warn(
                    '[quick-encounter] Tiles tool not found. Control groups:',
                    groups.map((c) => c?.name),
                );
            }
        } catch (_) {
            console.error('[quick-encounter] getSceneControlButtons error', _);
        }
    });
}