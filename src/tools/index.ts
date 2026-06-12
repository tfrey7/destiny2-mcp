import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBuildTools } from "./builds/index.js";
import { registerEquipItem } from "./equip_item.js";
import { registerEquipItems } from "./equip_items.js";
import { registerEquipLoadout } from "./equip_loadout.js";
import { registerGetArtifact } from "./get_artifact.js";
import { registerGetEquipped } from "./get_equipped.js";
import { registerHowToAcquire } from "./how_to_acquire.js";
import { registerInsertPlug } from "./insert_plug.js";
import { registerInspectItem } from "./inspect_item.js";
import { registerInspectSockets } from "./inspect_sockets.js";
import { registerListCharacters } from "./list_characters.js";
import { registerListInventory } from "./list_inventory.js";
import { registerListLoadouts } from "./list_loadouts.js";
import { registerLogin } from "./login.js";
import { registerSearchItems } from "./search_items.js";
import { registerShowArtifact } from "./show_artifact.js";
import { registerShowEquipped } from "./show_equipped.js";
import { registerShowLoadout } from "./show_loadout.js";
import { registerSnapshotLoadout } from "./snapshot_loadout.js";
import { registerTransferItem } from "./transfer_item.js";
import { registerUpdateLoadoutIdentifiers } from "./update_loadout_identifiers.js";
import { registerVaultInventory } from "./vault_inventory.js";

export function registerTools(server: McpServer): void {
  registerLogin(server);

  registerListCharacters(server);
  registerListLoadouts(server);
  registerShowLoadout(server);
  registerGetEquipped(server);
  registerShowEquipped(server);
  registerListInventory(server);
  registerInspectItem(server);
  registerInspectSockets(server);
  registerHowToAcquire(server);
  registerSearchItems(server);
  registerGetArtifact(server);
  registerShowArtifact(server);

  registerEquipLoadout(server);
  registerSnapshotLoadout(server);
  registerUpdateLoadoutIdentifiers(server);
  registerEquipItem(server);
  registerEquipItems(server);
  registerInsertPlug(server);
  registerTransferItem(server);
  registerVaultInventory(server);

  registerBuildTools(server);
}
