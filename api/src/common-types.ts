// Feedback DApp common types and abstractions.

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { FeedbackPrivateState } from '../../contract/src/index';

export const feedbackPrivateStateKey = 'feedbackPrivateState';
export type PrivateStateId = typeof feedbackPrivateStateKey;

/**
 * Represents a feedback contract.
 */
export type FeedbackContract = any;

/**
 * The keys of the circuits exported from {@link FeedbackContract}.
 */
export type FeedbackCircuitKeys = 'submitFeedback' | 'clearFeedback';

/**
 * The providers required by {@link FeedbackContract}.
 */
export type FeedbackProviders = MidnightProviders<FeedbackCircuitKeys, PrivateStateId, FeedbackPrivateState>;

/**
 * A {@link FeedbackContract} that has been deployed to the network.
 */
export type DeployedFeedbackContract = FoundContract<FeedbackContract>;

/**
 * A type that represents the derived combination of public (or ledger), and private state.
 */
export type FeedbackDerivedState = {
  readonly rating_sum: bigint;
  readonly feedback_count: bigint;
  readonly average_rating: number;
  readonly latest_comment: string | undefined;
  readonly latest_rating: bigint;

  /**
   * A readonly flag that determines if the current user is the owner/creator of the feedback board.
   */
  readonly isOwner: boolean;
};
