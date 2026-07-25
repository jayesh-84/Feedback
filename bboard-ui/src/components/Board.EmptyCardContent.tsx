import React, { useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { CardActions, CardContent, Button, Typography, Box } from '@mui/material';
import BoardAddIcon from '@mui/icons-material/RateReviewOutlined';
import CreateBoardIcon from '@mui/icons-material/AddCircleOutlined';
import JoinBoardIcon from '@mui/icons-material/Link';
import { TextPromptDialog } from './TextPromptDialog';

/**
 * The props required by the {@link EmptyCardContent} component.
 *
 * @internal
 */
export interface EmptyCardContentProps {
  /** A callback that will be called to create a new bulletin board. */
  onCreateBoardCallback: () => void;
  /** A callback that will be called to join an existing bulletin board. */
  onJoinBoardCallback: (contractAddress: ContractAddress) => void;
}

/**
 * Used when there is no board deployment to render a UI allowing the user to join or deploy bulletin boards.
 *
 * @internal
 */
export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({
  onCreateBoardCallback,
  onJoinBoardCallback,
}) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 460, justifyContent: 'center' }}>
      <CardContent sx={{ textAlign: 'center', mb: 3 }}>
        <Box
          sx={{
            display: 'inline-flex',
            p: 3,
            borderRadius: '50%',
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            color: '#c084fc',
            mb: 3,
            boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)',
          }}
        >
          <BoardAddIcon sx={{ fontSize: 48 }} />
        </Box>
        <Typography variant="h4" sx={{ color: '#f8fafc', fontWeight: 700, mb: 1, letterSpacing: -0.5 }}>
          Private Feedback Board
        </Typography>
        <Typography data-testid="board-posted-message" align="center" variant="body2" sx={{ color: '#94a3b8', maxW: '80%', mx: 'auto', lineHeight: 1.6 }}>
          Deploy a privacy-preserving smart contract to collect anonymous ratings and feedback, or connect to an existing one.
        </Typography>
      </CardContent>
      <CardActions sx={{ flexDirection: 'column', gap: 2, px: 0 }}>
        <Button
          variant="contained"
          data-testid="board-deploy-btn"
          startIcon={<CreateBoardIcon />}
          fullWidth
          onClick={onCreateBoardCallback}
          sx={{
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            color: '#f8fafc',
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            py: 1.5,
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)',
            '&:hover': {
              background: 'linear-gradient(135deg, #be185d 0%, #a855f7 100%)',
              boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4)',
            },
          }}
        >
          Deploy Feedback Board
        </Button>
        <Button
          variant="outlined"
          data-testid="board-join-btn"
          startIcon={<JoinBoardIcon />}
          fullWidth
          onClick={() => {
            setTextPromptOpen(true);
          }}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            py: 1.5,
            color: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Join Existing Board
        </Button>
      </CardActions>
      <TextPromptDialog
        prompt="Enter contract address"
        isOpen={textPromptOpen}
        onCancel={() => {
          setTextPromptOpen(false);
        }}
        onSubmit={(text) => {
          setTextPromptOpen(false);
          onJoinBoardCallback(text);
        }}
      />
    </Box>
  );
};
