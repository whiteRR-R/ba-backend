import User from './User';
import Challenge from './Challenge';
import Participant from './Participant';
import Task from './Task';
import Submission from './Submission';
import Vote from './Vote';
import FamilyMember from './FamilyMember';
import FamilyEvent from './FamilyEvent';
import FamilyInvite from './FamilyInvite';
import ChallengeInvite from './ChallengeInvite';
import Message from './Message';
import Notification from './Notification';



User.hasMany(Challenge, { foreignKey: 'creatorId', as: 'createdChallenges' });
Challenge.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });

Challenge.hasMany(Participant, { foreignKey: 'challengeId', as: 'participants' });
Participant.belongsTo(Challenge, { foreignKey: 'challengeId' });

User.hasMany(Participant, { foreignKey: 'userId', as: 'participations' });
Participant.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Challenge.hasMany(Task, { foreignKey: 'challengeId', as: 'tasks' });
Task.belongsTo(Challenge, { foreignKey: 'challengeId' });

Task.hasMany(Submission, { foreignKey: 'taskId', as: 'submissions' });
Submission.belongsTo(Task, { foreignKey: 'taskId' });

User.hasMany(Submission, { foreignKey: 'userId', as: 'submissions' });
Submission.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Submission.hasMany(Vote, { foreignKey: 'submissionId', as: 'votes' });
Vote.belongsTo(Submission, { foreignKey: 'submissionId' });

User.hasMany(Vote, { foreignKey: 'voterId', as: 'givenVotes' });
Vote.belongsTo(User, { foreignKey: 'voterId', as: 'voter' });

User.hasMany(FamilyMember, { foreignKey: 'userId', as: 'familyMembers' });
FamilyMember.belongsTo(User, { foreignKey: 'userId' });

FamilyMember.hasMany(FamilyMember, { foreignKey: 'parentId', as: 'children' });
FamilyMember.belongsTo(FamilyMember, { foreignKey: 'parentId', as: 'parent' });

User.hasMany(FamilyEvent, { foreignKey: 'userId', as: 'familyEvents' });
FamilyEvent.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(FamilyInvite, { foreignKey: 'toUserId', as: 'receivedFamilyInvites' });
FamilyInvite.belongsTo(User, { foreignKey: 'fromUserId', as: 'sender' });
FamilyInvite.belongsTo(User, { foreignKey: 'toUserId', as: 'receiver' });

Challenge.hasMany(ChallengeInvite, { foreignKey: 'challengeId', as: 'challengeInvites' });
ChallengeInvite.belongsTo(Challenge, { foreignKey: 'challengeId' });
ChallengeInvite.belongsTo(User, { foreignKey: 'fromUserId', as: 'inviteSender' });
ChallengeInvite.belongsTo(User, { foreignKey: 'toUserId', as: 'inviteReceiver' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User, Challenge, Participant, Task, Submission,
  Vote, FamilyMember, FamilyEvent, FamilyInvite,
  ChallengeInvite, Message, Notification
};