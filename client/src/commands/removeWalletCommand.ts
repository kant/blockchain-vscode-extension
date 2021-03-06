/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/
'use strict';
import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import { WalletTreeItem } from '../explorer/wallets/WalletTreeItem';
import { UserInputUtil, IBlockchainQuickPickItem } from './UserInputUtil';
import { VSCodeBlockchainOutputAdapter } from '../logging/VSCodeBlockchainOutputAdapter';
import { LogType } from '../logging/OutputAdapter';
import { FabricWalletRegistryEntry } from '../fabric/FabricWalletRegistryEntry';
import { FabricWalletRegistry } from '../fabric/FabricWalletRegistry';
import { FabricGatewayRegistry } from '../fabric/FabricGatewayRegistry';
import { FabricGatewayRegistryEntry } from '../fabric/FabricGatewayRegistryEntry';
import { FabricWalletUtil } from '../fabric/FabricWalletUtil';

export async function removeWallet(treeItem: WalletTreeItem): Promise<void> {
    const outputAdapter: VSCodeBlockchainOutputAdapter = VSCodeBlockchainOutputAdapter.instance();
    outputAdapter.log(LogType.INFO, undefined, `removeWallet`);

    let walletRegistryEntry: FabricWalletRegistryEntry;
    if (!treeItem) {
        // If called from command palette
        // Ask for wallet to remove
        // First check there is at least one that isn't local_fabric_wallet
        let wallets: Array<FabricWalletRegistryEntry> = [];
        wallets = FabricWalletRegistry.instance().getAll();
        if (wallets.length === 0) {
            outputAdapter.log(LogType.ERROR, `No wallets to remove. ${FabricWalletUtil.LOCAL_WALLET} cannot be removed.`, `No wallets to remove. ${FabricWalletUtil.LOCAL_WALLET} cannot be removed.`);
            return;
        }

        const chosenWallet: IBlockchainQuickPickItem<FabricWalletRegistryEntry> = await UserInputUtil.showWalletsQuickPickBox('Choose the wallet that you want to remove');
        if (!chosenWallet) {
            return;
        }

        walletRegistryEntry = chosenWallet.data;
    } else {
        walletRegistryEntry = FabricWalletRegistry.instance().get(treeItem.name);
    }

    const deleteFsWallet: vscode.MessageItem = await vscode.window.showWarningMessage(`This will remove ${walletRegistryEntry.name} from Fabric Wallets. Do you want to delete this wallet from your file system?`, { title: 'Yes' }, { title: 'No' });

    if (deleteFsWallet === undefined) { // warning box was cancelled - do nothing
        return;
    } else if (deleteFsWallet.title === 'Yes') {
        await fs.remove(walletRegistryEntry.walletPath);
        await FabricWalletRegistry.instance().delete(walletRegistryEntry.name);

        const gateways: FabricGatewayRegistryEntry[] =  FabricGatewayRegistry.instance().getAll();
        for (const gateway of gateways) {
            if (gateway.associatedWallet === walletRegistryEntry.name) {
                gateway.associatedWallet = ''; // If the gateway uses the newly removed wallet, dissociate it from the gateway
                await FabricGatewayRegistry.instance().update(gateway);
            }
        }

        outputAdapter.log(LogType.SUCCESS, `Successfully deleted ${walletRegistryEntry.walletPath}`, `Successfully deleted ${walletRegistryEntry.walletPath}`);

    } else {
        await FabricWalletRegistry.instance().delete(walletRegistryEntry.name);

        outputAdapter.log(LogType.SUCCESS, `Successfully removed ${walletRegistryEntry.name} from Fabric Wallets view`, `Successfully removed ${walletRegistryEntry.name} from Fabric Wallets view`);

    }
}
