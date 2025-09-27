/**
 * Team routes index - refactored entry point
 */

import { Express } from 'express';
import { requireAuth, requireTeamAccess } from '../../../auth/middleware';
import {
  handleListTeams,
  handleCreateTeam,
  handleGetTeam,
  handleUpdateTeam,
  handleDeleteTeam,
  handleSendInvite,
  handleAcceptInvite,
  handleCancelInvite,
  handleUpdateMemberRole,
  handleRemoveMember,
  handleLeaveTeam,
  handleTransferOwnership,
} from './handlers';

export default function mount(app: Express) {
  // Team management routes
  app.get('/teams', requireAuth, handleListTeams);
  app.post('/teams', requireAuth, handleCreateTeam);
  app.get('/teams/:teamId', requireAuth, requireTeamAccess(), handleGetTeam);
  app.patch('/teams/:teamId', requireAuth, requireTeamAccess('admin'), handleUpdateTeam);
  app.delete('/teams/:teamId', requireAuth, requireTeamAccess('owner'), handleDeleteTeam);

  // Invite management routes
  app.post('/teams/:teamId/invites', requireAuth, requireTeamAccess('admin'), handleSendInvite);
  app.post('/teams/accept-invite', requireAuth, handleAcceptInvite);
  app.delete('/teams/:teamId/invites/:inviteId', requireAuth, requireTeamAccess('admin'), handleCancelInvite);

  // Member management routes
  app.patch('/teams/:teamId/members/:memberId', requireAuth, requireTeamAccess('admin'), handleUpdateMemberRole);
  app.delete('/teams/:teamId/members/:memberId', requireAuth, requireTeamAccess('admin'), handleRemoveMember);
  app.post('/teams/:teamId/leave', requireAuth, requireTeamAccess(), handleLeaveTeam);

  // Ownership transfer route
  app.post('/teams/:teamId/transfer-ownership', requireAuth, requireTeamAccess('owner'), handleTransferOwnership);
}