# TESTING v1.2.3 WITH FOUNDRY 12 Stable (Build 325)

## BASIC
### METHOD 1 - create JE from selected tokens 
1. Select one friendly token and press QE button -> should ask if you want to add to JE                 TESTED in 1.2.3
2. Select multiple friendly and neutral tokens -> should ask...						                    TEST in 1.2.3
3. Select one hostile token and press QE button -> creates JE & QE                                      TEST in 1.2.3
4. Select multiple hostile and neutral tokens and press QE button -> creates JE & QE			        TEST in 1.2.3

### METHOD 2 - add Actors/Tokens to blank JE
1. Embed actor references in a vanilla Journal Entry ; should re-render with QE dialog                  TEST in 1.2.3
2. Open a vanilla Journal Entry, select tokens, and press the QE button to turn this into a QE -> ADD vs. CREATE dialog   TEST in 1.2.3
3. Add a Compendium Entry "Dire Wolf" to the Journal Entry		                                       	TEST in 1.2.3

### METHOD 3 - add/remove tokens                                                        
1. Open an existing QE with 1xActor; select 3 of the same tokens - should increase the number to 4      TEST in 1.2.3
2. Change # to random (1d4+2)                                                                           TEST in 1.2.3
3. Hover over Token in QE dialog and remove                                                             TEST in 1.2.3
4. Hover over Tile in QE dialog and remove		                                                        TEST in 1.2.3

## NEW FOUNDRY FEATURE: Multi-Page Journal Entries
- Store a QE with a JE page (check stored per page)                                                     TEST in 1.2.3
- Generate a QE from separate pages (check replaces old one)                                            TEST in 1.2.3
- In JE "flow mode", all QEs should display                                                             TEST in 1.2.3
- If a JE had a QE, that should display with the first page and be marked as "used"                     TEST in 1.2.3
- If a JE had a QE, it shouldn't display with subsequent pages                                          TEST in 1.2.3

### RUNNING QEs
1. Open QE with QE Dialog and Run                                                                       TEST in 1.2.3
2. Close Combat encounter: Show total XP and XP per player token to GM                                  TEST in 1.2.3
3. Alt- or Ctrl- Run to force invisible or visible                                                      TESTED in 1.2.3
4. Turn on "Show Add to CT" Module setting; clear for one Actor and check not included in CT            TEST in 1.2.3
5. Turn off "Show Add to CT" Module setting and check all now included in CT                            TEST in 1.2.3
6. Check Tiles being added to Encounter                                                                 TEST in 1.2.3

### MAP NOTES
1. Delete Note; should warn there is no Note when you open the Journal Entry                            TEST in 1.2.3
2. Move Note - Generated Actor tokens (but not Saved) should be created at the position of the Note     TEST in 1.2.3
3. Start on another Scene and run an Encounter - should switch scenes     					            TEST in 1.2.3 
5. Delete the original Map Note and launch from a different Map Note (move Saved tokens)                TEST in 1.2.3
7. Launch from the Journal Entry - should find a random Note or prompt to create one                    TEST in 1.2.3 (but doesn't run the QE)
8. Delete the QE Journal Entry - should delete all the related Notes                                    TEST in 1.2.3
### Hide/Show and ShowAuto setting                                                                      CHANGED in 1.1.0
1. ShowAuto = Yes:
1.1 New QE should show QE first and second time								
1.2 Hide QE; now should not show until you click Show again and then should show always				
2. ShowAuto=No
2.1 Existing QE should not show QE unless you use Show button							
2.2 Linked or Created QE should force show the first time
## 0.9 NEW FEATURES
1. Uncheck "Delete tokens after Add/Link" and verify manual deletion                                        TEST in 1.2.3
2. Check "Show delete dialog after Combat" and verify All/Defeated delete                                   TEST in 1.2.3

## NEW FEATURE: Instant Encounter
### Create JE with embedded Actors; drag to Scene and verify two choices:
- Drag JE to the map; run Instant Encounter behaves as if you ran QE from a Note (runs first QE)         TEST in 1.2.3
- Open the QE, press [Run QE] and see if creates the default Note at the center of your view             TEST in 1.2.3
- Create QE Note creates a note (Silently) which can be run                                              TEST in 1.2.3
- Open the QE and use the Run Quick Encounter (should run around the Note)                               TEST in 1.2.3
### Create a QE with some captured Tokens and some generated Tokens (will place a Note)
- When you drag the QE and Run Instant Encounter, it should place the captured Tokens and move the generated TEST in 1.2.3

## OLDER TESTING (only on major release)
### BACKWARD COMPATIBILITY
- Create a QE in v0.9 and make sure it mostly works in Foundry v10
### BUG FIXES
1. Create 10 saved tokens - check that QE positions saved tokens correctly                                  TEST in 1.2.3
2. Reduce 10 to 5 - check that QE positions saved tokens correctly                                          TEST in 1.2.3
3. Increase 5 back to 10 - extra 5 tokens should be generated next to Map Note                              TEST in 1.2.3
### TUTORIAL
1. Press Quick Encounter button with nothing selected -> should pop up Tutorial					 			TEST in 1.2.3
2. With Tutorial open, repeat #1 -> should keep existing Tutorial         						        	TEST in 1.2.3
3. Close Tutorial -> should delete the Journal Entry                          						        TEST in 1.2.3
4. Open some Journal Entries with no embedded Actors, press QE button -> should open Tutorial               TEST in 1.2.3
5. Open multiple Journal Entries with embedded Actors, press QE button -> should run the Encounter          TEST in 1.2.3
6. Leave Tutorial Window open; create another Journal Entry, Save, and then close - should be kept		    TEST in 1.2.3	
    - was being deleted in 0.5.2 because it was finding the Tutorial Window

## NO LONGER TESTING
### TEST WITH Foundry 0.7.9
May need to test for version:
- Test CONST.TOKEN_DISPOSITIONS
### USE OLD EMBEDDED METHOD - DEPRECATED
Verify above tests with Use Companion Dialog = TRUE and Use Companion Dialog = FALSE
1. Check that previously created encounters work with new Setting = TRUE
2. Check that previously created encounters work with new Setting = FALSE
3. Create a new Encounter with the "Use new Companion Dialog" = FALSE

