import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import {
  FeedbackAPI,
  type FeedbackDerivedState,
  feedbackPrivateStateKey,
  type FeedbackProviders,
  type DeployedFeedbackContract,
  type PrivateStateId,
} from '../../api/src/index';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ledger, type Ledger } from '../../contract/src/managed/feedback/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { randomBytes } from '../../api/src/utils';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils';
import { generateDust } from './generate-dust';
import { FeedbackPrivateState } from '../../contract/src/witnesses.js';

// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export const getFeedbackLedgerState = async (
  providers: FeedbackProviders,
  contractAddress: ContractAddress,
): Promise<Ledger | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null ? ledger(contractState.data as any) : null;
};

const DEPLOY_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Deploy a new feedback contract
  2. Join an existing feedback contract
  3. Exit
Which would you like to do? `;

const deployOrJoin = async (providers: FeedbackProviders, rli: Interface, logger: Logger): Promise<FeedbackAPI | null> => {
  let api: FeedbackAPI | null = null;

  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1':
        api = await FeedbackAPI.deploy(providers, logger);
        logger.info(`Deployed contract at address: ${api.deployedContractAddress}`);
        return api;
      case '2':
        api = await FeedbackAPI.join(providers, await rli.question('What is the contract address (in hex)? '), logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const displayLedgerState = async (
  providers: FeedbackProviders,
  deployedFeedbackContract: DeployedFeedbackContract,
  logger: Logger,
): Promise<void> => {
  const contractAddress = deployedFeedbackContract.deployTxData.public.contractAddress;
  const ledgerState = await getFeedbackLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(`There is no feedback contract deployed at ${contractAddress}`);
  } else {
    const count = Number(ledgerState.feedback_count);
    const sum = Number(ledgerState.rating_sum);
    const avg = count > 0 ? sum / count : 0;
    const latestComment = !ledgerState.latest_comment.is_some ? 'none' : ledgerState.latest_comment.value;
    const latestRating = ledgerState.latest_rating;

    logger.info(`Feedback Count: ${count}`);
    logger.info(`Rating Sum: ${sum}`);
    logger.info(`Average Rating: ${avg.toFixed(2)}`);
    logger.info(`Latest Comment: '${latestComment}'`);
    logger.info(`Latest Rating: ${latestRating}`);
    logger.info(`Board Owner PK: '${toHex(ledgerState.board_owner)}'`);
  }
};

const displayPrivateState = async (providers: FeedbackProviders, logger: Logger): Promise<void> => {
  const privateState = await providers.privateStateProvider.get(feedbackPrivateStateKey);
  if (privateState === null) {
    logger.info(`There is no existing feedback private state`);
  } else {
    logger.info(`Current secret key is: ${toHex(privateState.secretKey)}`);
  }
};

const displayDerivedState = (ledgerState: FeedbackDerivedState | undefined, logger: Logger) => {
  if (ledgerState === undefined) {
    logger.info(`No feedback state currently available`);
  } else {
    logger.info(`Feedback Count: ${ledgerState.feedback_count}`);
    logger.info(`Average Rating: ${ledgerState.average_rating.toFixed(2)}`);
    logger.info(`Latest Comment: '${ledgerState.latest_comment ?? 'none'}'`);
    logger.info(`Latest Rating: ${ledgerState.latest_rating}`);
    logger.info(`Are you the Owner? ${ledgerState.isOwner ? 'yes' : 'no'}`);
  }
};

const MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Submit feedback (rating & comment)
  2. Clear latest feedback (owner only)
  3. Display the current ledger state (known by everyone)
  4. Display the current private state (known only to this DApp instance)
  5. Display the current derived state (known only to this DApp instance)
  6. Exit
Which would you like to do? `;

const mainLoop = async (providers: FeedbackProviders, rli: Interface, logger: Logger): Promise<void> => {
  const feedbackApi = await deployOrJoin(providers, rli, logger);
  if (feedbackApi === null) {
    return;
  }
  let currentState: FeedbackDerivedState | undefined;
  const stateObserver = {
    next: (state: FeedbackDerivedState) => (currentState = state),
  };
  const subscription = feedbackApi.state$.subscribe(stateObserver);
  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      try {
        switch (choice) {
          case '1': {
            const ratingStr = await rli.question(`Enter rating (1 to 5): `);
            const rating = parseInt(ratingStr, 10);
            if (isNaN(rating) || rating < 1 || rating > 5) {
              logger.error('Invalid rating. Must be an integer between 1 and 5.');
              break;
            }
            const comment = await rli.question(`Enter feedback comment: `);
            await feedbackApi.submitFeedback(rating, comment);
            break;
          }
          case '2':
            await feedbackApi.clearFeedback();
            logger.info('Feedback cleared.');
            break;
          case '3':
            await displayLedgerState(providers, feedbackApi.deployedContract, logger);
            break;
          case '4':
            await displayPrivateState(providers, logger);
            break;
          case '5':
            displayDerivedState(currentState, logger);
            break;
          case '6':
            logger.info('Exiting...');
            return;
          default:
            logger.error(`Invalid choice: ${choice}`);
        }
      } catch (e) {
        logError(logger, e);
        logger.info('Returning to main menu...');
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) {
    return GENESIS_MINT_WALLET_SEED;
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return toHex(randomBytes(32));
      case '2':
        return await rli.question('Enter your wallet seed: ');
      case '3':
        logger.info('Exiting...');
        return undefined;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToBeStopped: MidnightWalletProvider[] = [];
  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);
    const seed = await buildWallet(config, rli, logger);
    if (seed === undefined) {
      return;
    }
    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToBeStopped.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;

    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(logger, walletFacade, envConfiguration, unshieldedToken());
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    if (nightBalance === undefined) {
      logger.info('No funds received, exiting...');
      return;
    }
    logger.info(`Your NIGHT wallet balance is: ${nightBalance}`);

    if (config.generateDust) {
      const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (dustGeneration) {
        logger.info(`Submitted dust generation registration transaction: ${dustGeneration}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const zkConfigProvider = new NodeZkConfigProvider<'submitFeedback' | 'clearFeedback'>(config.zkConfigPath);
    const providers: FeedbackProviders = {
      privateStateProvider: levelPrivateStateProvider<PrivateStateId, FeedbackPrivateState>({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => {
          return 'Feedback-Test-2026!';
        },
        accountId: seed,
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider: zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider: walletProvider,
      midnightProvider: walletProvider,
    };
    await mainLoop(providers, rli, logger);
  } catch (e) {
    logError(logger, e);
    logger.info('Exiting...');
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logError(logger, e);
    } finally {
      try {
        for (const wallet of providersToBeStopped) {
          logger.info('Stopping wallet...');
          await wallet.stop();
        }
        if (testEnv) {
          logger.info('Stopping test environment...');
          await testEnv.shutdown();
        }
      } catch (e) {
        logError(logger, e);
      }
    }
  }
};

function logError(logger: Logger, e: unknown) {
  if (e instanceof Error) {
    logger.error(`Found error '${e.message}'`);
    logger.debug(`${e.stack}`);
  } else {
    logger.error(`Found error (unknown type)`);
  }
}
