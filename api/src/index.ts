// Feedback DApp API implementation.

import * as Feedback from '../../contract/src/managed/feedback/contract/index.js';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type FeedbackDerivedState,
  type FeedbackContract,
  type FeedbackProviders,
  type DeployedFeedbackContract,
  feedbackPrivateStateKey,
} from './common-types.js';
import { CompiledFeedbackContractContract } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { FeedbackPrivateState, createFeedbackPrivateState } from '../../contract/src/witnesses.js';

/**
 * An API for a deployed feedback contract.
 */
export interface DeployedFeedbackAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<FeedbackDerivedState>;

  submitFeedback: (rating: number, comment: string) => Promise<void>;
  clearFeedback: () => Promise<void>;
}

/**
 * Provides an implementation of {@link DeployedFeedbackAPI} by adapting a deployed feedback contract.
 */
export class FeedbackAPI implements DeployedFeedbackAPI {
  /** @internal */
  private constructor(
    public readonly deployedContract: DeployedFeedbackContract,
    providers: FeedbackProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        // Combine public (ledger) state with...
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => Feedback.ledger(contractState.data as any)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  ...ledgerState,
                  rating_sum: ledgerState.rating_sum,
                  feedback_count: ledgerState.feedback_count,
                  latest_rating: ledgerState.latest_rating,
                  board_owner: toHex(ledgerState.board_owner),
                },
              },
            }),
          ),
        ),
        // ...private state
        from(providers.privateStateProvider.get(feedbackPrivateStateKey) as Promise<FeedbackPrivateState>),
      ],
      // Combine them to produce the derived state.
      (ledgerState, privateState) => {
        const hashedSecretKey = Feedback.pureCircuits.publicKey(
          privateState.secretKey,
        );

        const count = Number(ledgerState.feedback_count);
        const sum = Number(ledgerState.rating_sum);
        const average_rating = count > 0 ? sum / count : 0;

        return {
          rating_sum: ledgerState.rating_sum,
          feedback_count: ledgerState.feedback_count,
          average_rating,
          latest_comment: ledgerState.latest_comment.is_some ? ledgerState.latest_comment.value : undefined,
          latest_rating: ledgerState.latest_rating,
          isOwner: toHex(ledgerState.board_owner) === toHex(hashedSecretKey),
        };
      },
    );
  }

  /**
   * Gets the address of the current deployed contract.
   */
  readonly deployedContractAddress: ContractAddress;

  /**
   * Gets an observable stream of state changes based on the current public (ledger) and private state data.
   */
  readonly state$: Observable<FeedbackDerivedState>;

  /**
   * Submits a feedback rating and comment.
   */
  async submitFeedback(rating: number, comment: string): Promise<void> {
    this.logger?.info(`submitting feedback: rating=${rating}, comment=${comment}`);
    const txData = await (this.deployedContract.callTx as any).submitFeedback(BigInt(rating), comment);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'submitFeedback',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  /**
   * Clears the latest feedback. Only callable by the board owner.
   */
  async clearFeedback(): Promise<void> {
    this.logger?.info('clearing feedback');
    const txData = await (this.deployedContract.callTx as any).clearFeedback();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'clearFeedback',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  /**
   * Deploys a new feedback contract to the network.
   */
  static async deploy(providers: FeedbackProviders, logger?: Logger): Promise<FeedbackAPI> {
    logger?.info('deployFeedbackContract');

    const deployedFeedbackContract = await deployContract(providers, {
      compiledContract: CompiledFeedbackContractContract,
      privateStateId: feedbackPrivateStateKey,
      initialPrivateState: createFeedbackPrivateState(utils.randomBytes(32)),
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedFeedbackContract.deployTxData.public,
      },
    });

    return new FeedbackAPI(deployedFeedbackContract, providers, logger);
  }

  /**
   * Finds an already deployed feedback contract on the network and joins it.
   */
  static async join(providers: FeedbackProviders, contractAddress: ContractAddress, logger?: Logger): Promise<FeedbackAPI> {
    logger?.info({
      joinFeedbackContract: {
        contractAddress,
      },
    });

    const deployedFeedbackContract = await findDeployedContract<FeedbackContract>(providers, {
      contractAddress,
      compiledContract: CompiledFeedbackContractContract,
      privateStateId: feedbackPrivateStateKey,
      initialPrivateState: await FeedbackAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedFeedbackContract.deployTxData.public,
      },
    });

    return new FeedbackAPI(deployedFeedbackContract, providers, logger);
  }

  private static async getPrivateState(
    providers: FeedbackProviders,
    contractAddress: ContractAddress,
  ): Promise<FeedbackPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(feedbackPrivateStateKey);
    return existingPrivateState ?? createFeedbackPrivateState(utils.randomBytes(32));
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
